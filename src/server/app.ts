import express, { type Request, type Response, type NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import sharp from 'sharp';
import path from 'node:path';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import type pg from 'pg';
import { z } from 'zod';
import { pool, transaction } from './db.js';
import { AppError } from './errors.js';
import { ensureBrochure, getSessionData, regenerateBrochure, saveBrochure } from './brochures.js';
import { loginSchema, regenerationSchema, saveSchema, uuidSchema } from './validation.js';

declare global { namespace Express { interface Request { userId?: string } } }
const hash=(s:string|Buffer)=>createHash('sha256').update(s).digest('hex');
const route=(fn:(req:Request,res:Response)=>Promise<unknown>)=>(req:Request,res:Response,next:NextFunction)=>{void fn(req,res).catch(next);};
const limits=multer({storage:multer.memoryStorage(),limits:{fileSize:5*1024*1024,files:1,fields:0,parts:2}});
export function imageMagic(buffer:Buffer):string|null {
  if(buffer.length>=8&&buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png';
  if(buffer.length>=3&&buffer[0]===255&&buffer[1]===216&&buffer[2]===255)return 'image/jpeg';
  if(buffer.length>=12&&buffer.toString('ascii',0,4)==='RIFF'&&buffer.toString('ascii',8,12)==='WEBP')return 'image/webp';
  return null;
}
export async function normalizeImage(buffer:Buffer,mime:string):Promise<Buffer> {
  if(!imageMagic(buffer)||imageMagic(buffer)!==mime)throw new AppError(415,'invalid_image','JPEG・PNG・WebP形式の画像を選んでください。');
  try {
    const input=sharp(buffer,{limitInputPixels:24_000_000,animated:false,failOn:'warning'});
    const meta=await input.metadata();
    if(!meta.width||!meta.height||meta.width>6000||meta.height>6000||(meta.pages??1)>1)throw new Error('dimensions');
    // EXIF/GPSを含むmetadataを引き継がず、実デコード後に安全な単一形式へ変換する。
    return await input.rotate().resize({width:2000,height:2000,fit:'inside',withoutEnlargement:true}).webp({quality:86}).toBuffer();
  } catch { throw new AppError(415,'invalid_image','画像を読み込めません。縦横6000px以内・2400万画素以内の静止画を選んでください。'); }
}

export function createApp(db:pg.Pool=pool,uploadDir=path.resolve(process.env.UPLOAD_DIR??'uploads')) {
  const app=express();app.disable('x-powered-by');
  const root=path.resolve(uploadDir);
  const filePath=(key:string)=>{
    if(!/^[a-f0-9-]{36}\.webp$/.test(key))throw new AppError(404,'not_found','写真が見つかりません。');
    const p=path.resolve(root,key);if(path.dirname(p)!==root)throw new AppError(404,'not_found','写真が見つかりません。');return p;
  };
  const removeFile=async(key:string)=>{try{await unlink(filePath(key));}catch{/*孤児ファイルの整理はdocsに記載。公開配信はしない。*/}};
  app.use((_req,res,next)=>{
    res.set({'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'no-referrer',
      'Permissions-Policy':'camera=(), microphone=(), geolocation=()',
      'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; object-src 'none'"});next();
  });
  app.use('/api',(req,res,next)=>{
    res.set('Cache-Control','no-store');
    if(!['127.0.0.1','localhost','[::1]','::1'].includes(req.hostname))return next(new AppError(403,'local_only','このデモはローカル端末から利用してください。'));
    if(!['GET','HEAD','OPTIONS'].includes(req.method)) {
      const allowed=new Set([process.env.WEB_ORIGIN??'http://127.0.0.1:5173',`http://${req.get('host')}`]);
      if(req.get('X-Requested-With')!=='kondo'||!allowed.has(req.get('origin')??''))return next(new AppError(403,'origin_rejected','画面を再読み込みしてから操作してください。'));
    }next();
  });
  app.use(express.json({limit:'512kb',strict:true}));app.use(cookieParser());
  const attempts=new Map<string,{count:number,until:number}>();
  app.get('/api/health',route(async(_req,res)=>{await db.query('SELECT 1');res.json({ok:true});}));
  app.post('/api/login',route(async(req,res)=>{
    const key=req.ip??'local',now=Date.now();
    for(const [ip,entry] of attempts)if(entry.until<now)attempts.delete(ip);
    const attempt=attempts.get(key)??{count:0,until:now+60_000};
    attempt.count++;attempts.set(key,attempt);
    if(attempt.count>30)throw new AppError(429,'login_limited','操作が続いています。1分ほど待ってからログインしてください。');
    const {email,code}=loginSchema.parse(req.body);
    if(!timingSafeEqual(Buffer.from(code),Buffer.from('1111')))throw new AppError(401,'invalid_code','認証コードが違います。ローカルデモのコードは1111です。');
    const result=await db.query(`SELECT id FROM users WHERE email=$1 UNION SELECT user_id AS id FROM auth_aliases WHERE email=$1`,[email]);
    if(result.rows.length!==1)throw new AppError(404,'user_not_found','対象のパンフレットがありません。登録されたメール、またはデモ用メールをご確認ください。');
    const userId=result.rows[0].id,token=randomBytes(32).toString('hex');
    await db.query('DELETE FROM sessions WHERE expires_at < now()');
    await db.query(`INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '12 hours')`,[hash(token),userId]);
    res.cookie('kondo_session',token,{httpOnly:true,sameSite:'strict',secure:false,maxAge:12*60*60*1000,path:'/'});
    res.json(await getSessionData(db,userId));
  }));
  app.use('/api',(req,res,next)=>{
    if(req.path==='/health')return next();
    const token=req.cookies.kondo_session;
    if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))return next(new AppError(401,'login_required','ログインしてください。'));
    void db.query('SELECT user_id FROM sessions WHERE token_hash=$1 AND expires_at>now()',[hash(token)])
      .then(r=>{if(!r.rows[0])return next(new AppError(401,'session_expired','ログインの有効期限が切れました。もう一度ログインしてください。'));req.userId=r.rows[0].user_id;next();}).catch(next);
  });
  app.get('/api/session',route(async(req,res)=>res.json(await getSessionData(db,req.userId!))));
  app.post('/api/logout',route(async(req,res)=>{await db.query('DELETE FROM sessions WHERE token_hash=$1',[hash(req.cookies.kondo_session)]);res.clearCookie('kondo_session',{path:'/',sameSite:'strict',httpOnly:true});res.json({ok:true});}));
  app.post('/api/brochure/ensure',route(async(req,res)=>{z.object({}).strict().parse(req.body);const brochure=await transaction(c=>ensureBrochure(c,req.userId!),db);res.json({brochure});}));
  app.put('/api/brochure',route(async(req,res)=>{const draft=saveSchema.parse(req.body);const brochure=await transaction(c=>saveBrochure(c,req.userId!,draft),db);res.json({brochure});}));
  app.post('/api/brochure/regenerate',route(async(req,res)=>{const {draft,settings,mode}=regenerationSchema.parse(req.body);const brochure=await transaction(c=>regenerateBrochure(c,req.userId!,draft,settings,mode),db);res.json({brochure});}));
  app.post('/api/items/:id/photo',limits.single('photo'),route(async(req,res)=>{
    const itemId=uuidSchema.parse(req.params.id);
    const owned=await db.query('SELECT i.id FROM brochure_items i JOIN brochures b ON b.id=i.brochure_id WHERE i.id=$1 AND b.user_id=$2',[itemId,req.userId]);
    if(!owned.rowCount)throw new AppError(404,'not_found','スポットが見つかりません。');
    if(!req.file)throw new AppError(400,'photo_required','写真ファイルを選んでください。');
    const buffer=await normalizeImage(req.file.buffer,req.file.mimetype);
    const key=`${randomUUID()}.webp`,photoId=randomUUID();
    await mkdir(root,{recursive:true});await writeFile(filePath(key),buffer,{flag:'wx'});
    let oldKey:string|undefined;
    try {
      await transaction(async c=>{
        const lock=await c.query('SELECT b.id FROM brochures b JOIN brochure_items i ON i.brochure_id=b.id WHERE i.id=$1 AND b.user_id=$2 FOR UPDATE OF b',[itemId,req.userId]);
        if(!lock.rowCount)throw new AppError(404,'not_found','スポットが見つかりません。');
        oldKey=(await c.query('SELECT storage_key FROM item_photos WHERE item_id=$1',[itemId])).rows[0]?.storage_key;
        await c.query(`INSERT INTO item_photos(id,item_id,storage_key,mime,byte_size,sha256) VALUES($1,$2,$3,'image/webp',$4,$5)
          ON CONFLICT(item_id) DO UPDATE SET id=EXCLUDED.id,storage_key=EXCLUDED.storage_key,byte_size=EXCLUDED.byte_size,sha256=EXCLUDED.sha256`,[photoId,itemId,key,buffer.length,hash(buffer)]);
      },db);
    } catch(error){await removeFile(key);throw error;}
    if(oldKey)await removeFile(oldKey);
    res.json({photoUrl:`/api/photos/${photoId}`});
  }));
  app.delete('/api/items/:id/photo',route(async(req,res)=>{
    const id=uuidSchema.parse(req.params.id);
    const key=await transaction(async c=>{
      const owned=await c.query('SELECT b.id FROM brochures b JOIN brochure_items i ON i.brochure_id=b.id WHERE i.id=$1 AND b.user_id=$2 FOR UPDATE OF b',[id,req.userId]);
      if(!owned.rowCount)throw new AppError(404,'not_found','スポットが見つかりません。');
      return (await c.query('DELETE FROM item_photos WHERE item_id=$1 RETURNING storage_key',[id])).rows[0]?.storage_key as string|undefined;
    },db);
    if(key)await removeFile(key);res.json({photoUrl:null});
  }));
  app.get('/api/photos/:id',route(async(req,res)=>{
    const id=uuidSchema.parse(req.params.id);
    const r=(await db.query('SELECT p.storage_key FROM item_photos p JOIN brochure_items i ON i.id=p.item_id JOIN brochures b ON b.id=i.brochure_id WHERE p.id=$1 AND b.user_id=$2',[id,req.userId])).rows[0];
    if(!r)throw new AppError(404,'not_found','写真が見つかりません。');
    let bytes:Buffer;try{bytes=await readFile(filePath(r.storage_key));}catch{throw new AppError(404,'not_found','写真ファイルがありません。もう一度写真を追加してください。');}
    res.type('image/webp').send(bytes);
  }));
  app.use('/api',(_req,_res,next)=>next(new AppError(404,'not_found','指定された操作はありません。')));
  app.use(express.static(path.resolve('dist/web'),{index:false,dotfiles:'deny'}));
  app.get(/.*/,(_req,res,next)=>{res.sendFile(path.resolve('dist/web/index.html'),e=>{if(e)next(new AppError(503,'web_not_built','画面をビルドするか、開発サーバーを起動してください。'));});});
  app.use((error:unknown,_req:Request,res:Response,_next:NextFunction)=>{
    if(res.headersSent)return;
    if(error instanceof AppError)return res.status(error.status).json({error:{code:error.code,message:error.message}});
    if(error instanceof z.ZodError)return res.status(400).json({error:{code:'invalid_input',message:'入力内容を確認してください。コメントは200字以内、選択肢は画面に表示された値を使用してください。'}});
    if(error instanceof multer.MulterError)return res.status(error.code==='LIMIT_FILE_SIZE'?413:400).json({error:{code:'upload_limit',message:'写真は5MB以内で1枚ずつ選んでください。'}});
    if((error as {type?:string})?.type==='entity.too.large')return res.status(413).json({error:{code:'input_limit',message:'入力サイズが大きすぎます。'}});
    if(error instanceof SyntaxError)return res.status(400).json({error:{code:'invalid_json',message:'送信内容を読み取れません。画面から再送してください。'}});
    console.error('処理に失敗しました。接続または保存先の状態を確認してください。');
    return res.status(503).json({error:{code:'service_unavailable',message:'保存先に接続できません。入力はそのままに、DBと画像保存先を確認して再試行してください。'}});
  });
  return app;
}

