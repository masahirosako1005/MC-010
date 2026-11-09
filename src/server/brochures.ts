import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import type { Brochure, BrochureItem, SavePayload, SessionData, Spot, TripSettings, Visit } from '../shared/types.js';
import { spotSupportsExperienceCategory, type ExperienceCategory } from '../shared/experience-categories.js';
import { AppError } from './errors.js';
import { candidateReason, makeCopy, selectCategoryPicks, surveyTags, type CategoryPick, type Survey } from './generator.js';
type DB = Pick<pg.PoolClient,'query'>;

export async function getSpots(db:DB):Promise<Spot[]> {
  const {rows}=await db.query('SELECT * FROM spots ORDER BY external_id');
  return rows.map(r=>({id:r.id,name:r.name,category:r.category,description:r.description,companionTags:r.companion_tags,themeTags:r.theme_tags,image:r.image,source:r.source,sourceUrl:r.source_url,active:r.active}));
}
export async function getVisits(db:DB,userId:string):Promise<Visit[]> {
  const {rows}=await db.query('SELECT * FROM visits WHERE user_id=$1 ORDER BY visited_at DESC,id',[userId]);
  return rows.map(r=>({id:r.id,spotId:r.spot_id,visitedAt:r.visited_at.toISOString(),stamp:r.stamp,satisfaction:null,goodPoints:null,previousCompanion:null}));
}
export async function getSurvey(db:DB,userId:string):Promise<Survey|null> {
  const r=(await db.query('SELECT * FROM surveys WHERE user_id=$1',[userId])).rows[0];
  return r?{satisfaction:r.satisfaction,goodPoints:r.good_points,tags:r.tags,previousCompanion:r.previous_companion}:null;
}
export async function getBrochure(db:DB,userId:string):Promise<Brochure|null> {
  const r=(await db.query('SELECT * FROM brochures WHERE user_id=$1',[userId])).rows[0];
  if(!r)return null;
  const {rows}=await db.query(`SELECT i.*,p.id AS photo_id FROM brochure_items i LEFT JOIN item_photos p ON p.item_id=i.id WHERE i.brochure_id=$1 ORDER BY i.sort_order,i.id`,[r.id]);
  return {id:r.id,revision:r.revision,companion:r.companion,duration:r.duration,tripStyle:r.trip_style,template:r.template,title:r.title,theme:r.theme,invitation:r.invitation,updatedAt:r.updated_at.toISOString(),
    items:rows.map(i=>({id:i.id,spotId:i.spot_id,kind:i.kind,selected:i.selected,isMemory:i.is_memory,order:i.sort_order,comment:i.comment,photoUrl:i.photo_id?`/api/photos/${i.photo_id}`:null,reason:i.reason,pickupCategory:i.pickup_category??null}))};
}
export async function getSessionData(db:DB,userId:string):Promise<SessionData> {
  const user=(await db.query('SELECT id,display_name,source,account_role FROM users WHERE id=$1',[userId])).rows[0];
  if(!user)throw new AppError(401,'session_expired','もう一度ログインしてください。');
  const identity={id:user.id,displayName:user.display_name,source:user.source,role:user.account_role};
  if(user.account_role==='town_admin')return {user:identity,spots:[],visits:[],brochure:null,survey:null};
  const survey=await getSurvey(db,userId);
  return {user:identity,spots:await getSpots(db),visits:await getVisits(db,userId),brochure:await getBrochure(db,userId),survey:survey?{satisfaction:survey.satisfaction,goodPoints:survey.goodPoints,previousCompanion:survey.previousCompanion}:null};
}
export async function ensureBrochure(db:DB,userId:string,requestedSettings?:TripSettings):Promise<Brochure> {
  await db.query('SELECT pg_advisory_xact_lock_shared(6821452)');
  await db.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[userId]);
  const existing=await getBrochure(db,userId); if(existing)return existing;
  const spots=await getSpots(db),visits=await getVisits(db,userId),survey=await getSurvey(db,userId);
  if(!visits.length)throw new AppError(422,'history_missing','訪問履歴がないため、パンフレットを作れません。スタンプラリーの記録をご確認ください。');
  const settings:TripSettings=requestedSettings??{companion:'友人',duration:'day',tripStyle:'slow',visitedSpotIds:[visits[0]!.spotId]};
  const visited=new Set(visits.map(v=>v.spotId));
  if(!settings.visitedSpotIds.length||new Set(settings.visitedSpotIds).size!==settings.visitedSpotIds.length||settings.visitedSpotIds.some(id=>!visited.has(id)))throw new AppError(400,'invalid_visits','再訪先は前回の訪問履歴から選んでください。');
  const picks=selectCategoryPicks(spots,visits,survey,settings);
  if(!picks.length)throw new AppError(422,'spots_unavailable','公開中の候補スポットがありません。町側の登録状況をご確認ください。');
  const pickBySpot=new Map(picks.map((pick,index)=>[pick.spotId,{...pick,order:index}]));
  const id=randomUUID();
  const items:BrochureItem[]=spots.map(s=>{const pick=pickBySpot.get(s.id);return {id:randomUUID(),spotId:s.id,kind:visited.has(s.id)?'visited':'candidate',selected:Boolean(pick),isMemory:settings.visitedSpotIds.includes(s.id),order:pick?.order??0,comment:'',photoUrl:null,pickupCategory:pick?.pickupCategory??null,
    reason:visited.has(s.id)?'前回のスタンプラリーで訪れた場所です。':candidateReason(s,settings.companion,settings.tripStyle,surveyTags(survey))};});
  const copy=makeCopy(spots,items,settings);
  await db.query(`INSERT INTO brochures(id,user_id,companion,duration,trip_style,template,title,theme,invitation) VALUES($1,$2,$3,$4,$5,'colorful',$6,$7,$8)`,[id,userId,settings.companion,settings.duration,settings.tripStyle,copy.title,copy.theme,copy.invitation]);
  for(const item of items)await db.query(`INSERT INTO brochure_items(id,brochure_id,spot_id,kind,selected,is_memory,sort_order,comment,reason,pickup_category) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,[item.id,id,item.spotId,item.kind,item.selected,item.isMemory,item.order,item.comment,item.reason,item.pickupCategory]);
  return (await getBrochure(db,userId))!;
}
async function lockAndCheck(db:DB,userId:string,draft:SavePayload) {
  const r=(await db.query('SELECT id,revision FROM brochures WHERE user_id=$1 FOR UPDATE',[userId])).rows[0];
  if(!r)throw new AppError(404,'not_found','パンフレットがありません。');
  if(r.revision!==draft.revision)throw new AppError(409,'revision_conflict','別の画面で更新されました。入力を控えてから再読み込みしてください。');
  const current=(await getBrochure(db,userId))!;
  const ids=new Set(current.items.map(i=>i.id));
  if(draft.items.length!==ids.size||new Set(draft.items.map(i=>i.id)).size!==ids.size||draft.items.some(i=>!ids.has(i.id)))throw new AppError(400,'invalid_items','スポットの指定が正しくありません。');
  const selected=draft.items.filter(i=>i.selected);
  const categories=selected.map(i=>i.pickupCategory);
  if(!selected.length||selected.length>5||categories.some(category=>category===null)||new Set(categories).size!==selected.length||new Set(selected.map(i=>i.order)).size!==selected.length)throw new AppError(400,'invalid_route','体験カテゴリごとに1か所を選び、訪問順を重複なく指定してください。');
  if(draft.items.some(item=>!item.selected&&item.pickupCategory!==null))throw new AppError(400,'invalid_category','選択していないスポットには体験カテゴリを指定できません。');
  const spotsById=new Map((await getSpots(db)).map(spot=>[spot.id,spot]));
  if(selected.some(item=>{const saved=current.items.find(entry=>entry.id===item.id)!;return !saved.selected&&spotsById.get(saved.spotId)?.active===false;}))throw new AppError(409,'spot_stopped','選んだスポットは公開停止になりました。再読み込みして候補を選び直してください。');
  if(selected.some(item=>{const currentItem=current.items.find(entry=>entry.id===item.id)!;const spot=spotsById.get(currentItem.spotId);return !spot||!spotSupportsExperienceCategory(spot,item.pickupCategory!);}))throw new AppError(400,'invalid_category','スポットに対応していない体験カテゴリが指定されています。');
  if(draft.items.some(i=>i.isMemory&&current.items.find(c=>c.id===i.id)!.kind!=='visited'))throw new AppError(400,'invalid_memory','思い出には実際に訪れたスポットを選んでください。');
  return current;
}
async function applyDraft(db:DB,current:Brochure,draft:SavePayload) {
  for(const item of draft.items)await db.query('UPDATE brochure_items SET selected=$1,is_memory=$2,sort_order=$3,comment=$4,pickup_category=$5 WHERE id=$6 AND brochure_id=$7',[item.selected,item.isMemory,item.order,item.comment,item.pickupCategory,item.id,current.id]);
  await db.query('UPDATE brochures SET companion=$1,duration=$2,trip_style=$3,template=$4 WHERE id=$5',[draft.companion,draft.duration,draft.tripStyle,draft.template,current.id]);
}
async function refreshCopy(db:DB,userId:string) {
  const brochure=(await getBrochure(db,userId))!,spots=await getSpots(db);
  const copy=makeCopy(spots,brochure.items,brochure);
  await db.query('UPDATE brochures SET title=$1,theme=$2,invitation=$3,revision=revision+1,updated_at=now() WHERE user_id=$4',[copy.title,copy.theme,copy.invitation,userId]);
  return (await getBrochure(db,userId))!;
}
export async function saveBrochure(db:DB,userId:string,draft:SavePayload):Promise<Brochure> {
  await db.query('SELECT pg_advisory_xact_lock_shared(6821452)');
  const current=await lockAndCheck(db,userId,draft);await applyDraft(db,current,draft);return refreshCopy(db,userId);
}
export async function regenerateBrochure(db:DB,userId:string,draft:SavePayload,settings:TripSettings,mode:'all'|'candidates'):Promise<Brochure> {
  await db.query('SELECT pg_advisory_xact_lock_shared(6821452)');
  let current=await lockAndCheck(db,userId,draft);
  const visits=await getVisits(db,userId),visited=new Set(visits.map(v=>v.spotId));
  if(new Set(settings.visitedSpotIds).size!==settings.visitedSpotIds.length||settings.visitedSpotIds.some(id=>!visited.has(id)))throw new AppError(400,'invalid_visits','再訪先は前回の訪問履歴から選んでください。');
  await applyDraft(db,current,draft);
  const spots=await getSpots(db),survey=await getSurvey(db,userId);
  for(const spot of spots.filter(spot=>!current.items.some(item=>item.spotId===spot.id))) {
    await db.query(`INSERT INTO brochure_items(id,brochure_id,spot_id,kind,reason) VALUES($1,$2,$3,$4,$5) ON CONFLICT(brochure_id,spot_id) DO NOTHING`,
      [randomUUID(),current.id,spot.id,visited.has(spot.id)?'visited':'candidate',visited.has(spot.id)?'前回のスタンプラリーで訪れた場所です。':candidateReason(spot,settings.companion,settings.tripStyle,surveyTags(survey))]);
  }
  current=(await getBrochure(db,userId))!;
  const count=(await db.query('UPDATE brochures SET regeneration_count=regeneration_count+1 WHERE id=$1 RETURNING regeneration_count',[current.id])).rows[0].regeneration_count;
  const retained:CategoryPick[]=mode==='candidates'?current.items.flatMap(item=>{const submitted=draft.items.find(entry=>entry.id===item.id);return submitted?.selected&&submitted.pickupCategory&&item.kind==='visited'?[{spotId:item.spotId,pickupCategory:submitted.pickupCategory}]:[];}):[];
  const picks=selectCategoryPicks(spots,visits,survey,settings,count,retained);
  if(!picks.length)throw new AppError(422,'spots_unavailable','公開中の候補スポットがありません。現在の編集は保存されていません。');
  const pickBySpot=new Map(picks.map(pick=>[pick.spotId,pick]));
  const retainedOrder=draft.items.filter(i=>i.selected).sort((a,b)=>a.order-b.order).map(i=>current.items.find(c=>c.id===i.id)!.spotId).filter(id=>pickBySpot.has(id));
  const route=[...retainedOrder,...picks.map(pick=>pick.spotId).filter(id=>!retainedOrder.includes(id))];
  await db.query('UPDATE brochure_items SET selected=false,pickup_category=NULL WHERE brochure_id=$1',[current.id]);
  for(const item of current.items) {
    const order=route.indexOf(item.spotId);
    const pick=pickBySpot.get(item.spotId);
    const spot=spots.find(s=>s.id===item.spotId)!;
    await db.query('UPDATE brochure_items SET selected=$1,sort_order=$2,reason=$3,pickup_category=$4,is_memory=$5 WHERE id=$6 AND brochure_id=$7',[Boolean(pick),Math.max(0,order),item.kind==='visited'?item.reason:candidateReason(spot,settings.companion,settings.tripStyle,surveyTags(survey)),pick?.pickupCategory??null,settings.visitedSpotIds.includes(item.spotId),item.id,current.id]);
  }
  await db.query('UPDATE brochures SET companion=$1,duration=$2,trip_style=$3 WHERE id=$4',[settings.companion,settings.duration,settings.tripStyle,current.id]);
  return refreshCopy(db,userId);
}

