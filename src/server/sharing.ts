import { Router, type Request } from 'express';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type pg from 'pg';
import { z } from 'zod';
import type { AdminSharePage, ShareSettings, SharedBrochure } from '../shared/sharing-types.js';
import { getBrochure, getSpots, getVisits } from './brochures.js';
import { transaction } from './db.js';
import { AppError } from './errors.js';
import { uuidSchema } from './validation.js';

type DB = Pick<pg.PoolClient, 'query'>;
const exposedItem = `(i.selected OR (i.kind='visited' AND i.is_memory))`;
const notFound = () => new AppError(404, 'share_not_found', '共有パンフレットが見つからないか、公開が停止されています。');
function shareSettings(row: pg.QueryResultRow): ShareSettings {
  return { path: `/share/${row.token}`, active: row.active, viewCount: row.view_count,
    createdAt: row.created_at.toISOString(), lastViewedAt: row.last_viewed_at?.toISOString() ?? null };
}
async function publicShare(db: DB, token: unknown, lock = false) {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) throw notFound();
  const row = (await db.query(`SELECT s.*,b.user_id FROM brochure_shares s JOIN brochures b ON b.id=s.brochure_id
    WHERE s.token=$1 AND s.active${lock ? ' FOR UPDATE OF s' : ''}`, [token])).rows[0];
  if (!row) throw notFound();
  return row;
}
async function optionalViewer(db: DB, req: Request): Promise<string | null> {
  const token: unknown = req.cookies.kondo_session;
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return null;
  const row = (await db.query(`SELECT s.user_id FROM sessions s JOIN users u ON u.id=s.user_id
    WHERE s.token_hash=$1 AND s.expires_at>now() AND u.account_role='visitor'`, [createHash('sha256').update(token).digest('hex')])).rows[0];
  return row?.user_id ?? null;
}

export function createPublicShareRouter(db: pg.Pool, uploadDir: string) {
  const router = Router(), root = path.resolve(uploadDir);
  router.get('/shared/:token', async (req, res) => {
    const result = await transaction(async client => {
      await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
      const share = await publicShare(client, req.params.token);
      const viewerIsOwner = await optionalViewer(client, req) === share.user_id;
      const saved = await getBrochure(client, share.user_id);
      if (!saved) throw notFound();
      const items = saved.items.filter(item => item.selected || (item.kind === 'visited' && item.isMemory));
      const spotIds = new Set(items.map(item => item.spotId));
      const photoBase = `/api/shared/${share.token}`;
      const spots = (await getSpots(client)).filter(spot => spotIds.has(spot.id)).map(spot => ({
        ...spot, hasGift: viewerIsOwner && Boolean(spot.hasGift),
        image: spot.image.replace(/^\/api\/spot-photos\//, `${photoBase}/spot-photos/`),
      }));
      const memoryIds = new Set(items.filter(item => item.kind === 'visited' && item.isMemory).map(item => item.spotId));
      const latestVisits = new Map<string, SharedBrochure['memoryVisits'][number]>();
      for (const visit of await getVisits(client, share.user_id)) {
        if (memoryIds.has(visit.spotId) && !latestVisits.has(visit.spotId)) {
          latestVisits.set(visit.spotId, { spotId: visit.spotId, visitedAt: visit.visitedAt, stamp: visit.stamp });
        }
      }
      return { brochure: { ...saved, items: items.map(item => ({ ...item,
        photoUrl: item.photoUrl?.replace(/^\/api\/photos\//, `${photoBase}/photos/`) ?? null,
      })) }, spots, memoryVisits: [...latestVisits.values()], viewerIsOwner } satisfies SharedBrochure;
    }, db);
    res.json(result);
  });
  router.post('/shared/:token/views', async (req, res) => {
    const { requestId } = z.object({ requestId: uuidSchema }).strict().parse(req.body);
    await transaction(async client => {
      const share = await publicShare(client, req.params.token, true);
      const inserted = await client.query(`INSERT INTO share_page_views(share_id,request_id) VALUES($1,$2)
        ON CONFLICT DO NOTHING RETURNING share_id`, [share.id, requestId]);
      if (inserted.rowCount) await client.query('UPDATE brochure_shares SET view_count=view_count+1,last_viewed_at=now() WHERE id=$1', [share.id]);
    }, db);
    res.json({ ok: true });
  });

  async function photo(req: Request, official: boolean): Promise<Buffer> {
    const share = await publicShare(db, req.params.token), id = uuidSchema.parse(req.params.id);
    const from = official
      ? 'spot_photos p JOIN brochure_items i ON i.spot_id=p.spot_id'
      : 'item_photos p JOIN brochure_items i ON i.id=p.item_id';
    const row = (await db.query(`SELECT p.storage_key FROM ${from}
      WHERE p.id=$1 AND i.brochure_id=$2 AND ${exposedItem} LIMIT 1`, [id, share.brochure_id])).rows[0];
    if (!row || !/^[a-f0-9-]{36}\.webp$/.test(row.storage_key)) throw new AppError(404, 'photo_not_found', '共有写真が見つかりません。');
    try { return await readFile(path.join(root, row.storage_key)); }
    catch { throw new AppError(404, 'photo_not_found', '共有写真を読み込めません。'); }
  }
  router.get('/shared/:token/photos/:id', async (req, res) => { res.type('image/webp').send(await photo(req, false)); });
  router.get('/shared/:token/spot-photos/:id', async (req, res) => { res.type('image/webp').send(await photo(req, true)); });
  return router;
}

export function createOwnerShareRouter(db: pg.Pool) {
  const router = Router();
  router.use('/brochure/share', (req, _res, next) => {
    if (req.accountRole !== 'visitor') return next(new AppError(403, 'visitor_required', '共有URLの管理は作成した利用者アカウント専用です。'));
    next();
  });
  router.get('/brochure/share', async (req, res) => {
    const row = (await db.query(`SELECT s.* FROM brochure_shares s JOIN brochures b ON b.id=s.brochure_id WHERE b.user_id=$1`, [req.userId])).rows[0];
    res.json({ share: row ? shareSettings(row) : null });
  });
  router.post('/brochure/share', async (req, res) => {
    z.object({}).strict().parse(req.body);
    const row = (await db.query(`INSERT INTO brochure_shares(id,brochure_id,token)
      SELECT $1,id,$2 FROM brochures WHERE user_id=$3
      ON CONFLICT(brochure_id) DO UPDATE SET active=true RETURNING *`, [randomUUID(), randomBytes(32).toString('hex'), req.userId])).rows[0];
    if (!row) throw new AppError(404, 'not_found', '保存済みのパンフレットがありません。');
    res.json({ share: shareSettings(row) });
  });
  router.delete('/brochure/share', async (req, res) => {
    z.object({}).strict().parse(req.body);
    const row = (await db.query(`UPDATE brochure_shares s SET active=false FROM brochures b
      WHERE b.id=s.brochure_id AND b.user_id=$1 RETURNING s.*`, [req.userId])).rows[0];
    res.json({ share: row ? shareSettings(row) : null });
  });
  return router;
}

export function createShareAdminRouter(db: pg.Pool) {
  const router = Router();
  router.use((req, _res, next) => {
    if (req.accountRole !== 'town_admin') return next(new AppError(403, 'admin_required', '町側アカウントでログインしてください。'));
    next();
  });
  router.get('/shares', async (req, res) => {
    const { scope, page } = z.object({ scope: z.enum(['all', 'organizer', 'fixture']).default('all'),
      page: z.coerce.number().int().min(1).max(100000).default(1) }).strict().parse(req.query);
    const result = await transaction(async client => {
      await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
      const from = `FROM brochure_shares s JOIN brochures b ON b.id=s.brochure_id JOIN users u ON u.id=b.user_id
        WHERE ($1='all' OR u.source=$1)`;
      const totals = (await client.query(`SELECT count(*)::int AS total,count(*) FILTER(WHERE s.active)::int AS active,
        COALESCE(sum(s.view_count),0)::float8 AS views ${from}`, [scope])).rows[0];
      const pageSize = 25, currentPage = Math.min(page, Math.max(1, Math.ceil(totals.total / pageSize)));
      const rows = (await client.query(`SELECT s.id,b.user_id,u.source,s.active,s.view_count,s.created_at,s.last_viewed_at ${from}
        ORDER BY s.created_at DESC,s.id LIMIT $2 OFFSET $3`, [scope, pageSize, (currentPage - 1) * pageSize])).rows;
      return { rows: rows.map(row => ({ id: row.id, userId: row.user_id, source: row.source, active: row.active,
        viewCount: row.view_count, createdAt: row.created_at.toISOString(), lastViewedAt: row.last_viewed_at?.toISOString() ?? null })),
        total: totals.total, active: totals.active, totalViews: totals.views, page: currentPage, pageSize } satisfies AdminSharePage;
    }, db);
    res.json(result);
  });
  return router;
}
