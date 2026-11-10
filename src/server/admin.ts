import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { z } from 'zod';
import { SPOT_IMAGES, THEME_TAGS, type AdminOverview, type AdminSpot, type RegistrationPage } from '../shared/admin-types.js';
import { COMPANIONS } from '../shared/types.js';
import { EXPERIENCE_CATEGORIES, spotSupportsExperienceCategory } from '../shared/experience-categories.js';
import { transaction } from './db.js';
import { AppError } from './errors.js';
import { uuidSchema } from './validation.js';
import { createAdminDetailRouter } from './admin-details.js';

const scopeSchema = z.enum(['all', 'organizer', 'fixture']).default('all');
const listSchema = z.object({
  scope: scopeSchema, status: z.enum(['all', 'created', 'missing']).default('all'),
  history: z.enum(['all', 'yes', 'no']).default('all'),
  page: z.coerce.number().int().min(1).max(100000).default(1),
}).strict();
const spotFields = {
  name: z.string().trim().min(1).max(100), category: z.string().trim().min(1).max(40),
  description: z.string().trim().min(1).max(1000), active: z.boolean(),
  hasGift: z.boolean().optional(),
  themeTags: z.array(z.enum(THEME_TAGS)).min(1).max(THEME_TAGS.length).refine(a => new Set(a).size === a.length),
  companionTags: z.array(z.enum(COMPANIONS)).min(1).max(COMPANIONS.length).refine(a => new Set(a).size === a.length),
  image: z.string().refine(value => SPOT_IMAGES.some(image => image.value === value) || /^\/api\/spot-photos\/[a-f0-9-]{36}$/.test(value)),
};
const createSchema = z.object({ ...spotFields, requestId: uuidSchema.optional() }).strict();
const updateSchema = z.object({ ...spotFields, revision: z.number().int().positive() }).strict();
const parseSpot = <T>(schema: z.ZodType<T>, body: unknown): T => {
  const result = schema.safeParse(body);
  if (!result.success) throw new AppError(400, 'invalid_spot', '名称・分類・説明・画像・タグ・同行者を確認してください。');
  return result.data;
};

export async function auditSpot(db: Pick<pg.PoolClient, 'query'>, actor: string, spotId: string, action: string) {
  await db.query('INSERT INTO admin_audit_logs(id,actor_id,action,spot_id) VALUES($1,$2,$3,$4)', [randomUUID(), actor, action, spotId]);
}

export async function getAdminSpots(db: Pick<pg.PoolClient, 'query'>): Promise<AdminSpot[]> {
  const { rows } = await db.query(`SELECT s.*,
    (SELECT count(*)::int FROM visits v WHERE v.spot_id=s.id) AS visit_count,
    (SELECT count(DISTINCT v.user_id)::int FROM visits v WHERE v.spot_id=s.id) AS visitor_count,
    (SELECT count(*)::int FROM brochure_items i WHERE i.spot_id=s.id AND i.selected) AS brochure_count,
    (SELECT count(*)::int FROM spot_gift_claims c WHERE c.spot_id=s.id) AS gift_claim_count,
    COALESCE(likes.count,0)::int AS like_count
    FROM spots s LEFT JOIN (
      SELECT l.spot_id,count(*)::int AS count FROM share_spot_likes l
      JOIN brochure_shares sh ON sh.id=l.share_id JOIN brochures b ON b.id=sh.brochure_id JOIN users u ON u.id=b.user_id
      WHERE u.account_role='visitor' GROUP BY l.spot_id
    ) likes ON likes.spot_id=s.id ORDER BY s.active DESC,s.external_id`);
  return rows.map(r => ({ id: r.id, name: r.name, category: r.category, description: r.description,
    companionTags: r.companion_tags, themeTags: r.theme_tags, image: r.image, source: r.source, sourceUrl: r.source_url,
    active: r.active, hasGift: r.has_gift, giftClaimCount: r.gift_claim_count, revision: r.revision, updatedAt: r.updated_at.toISOString(),
    visitCount: r.visit_count, visitorCount: r.visitor_count, brochureCount: r.brochure_count, likeCount: r.like_count }));
}

export function createAdminRouter(db: pg.Pool) {
  const router = Router();
  router.use((req, _res, next) => {
    if (req.accountRole !== 'town_admin') return next(new AppError(403, 'admin_required', '町側アカウントでログインしてください。'));
    next();
  });
  router.use(createAdminDetailRouter(db));

  router.get('/overview', async (req, res) => {
    const { scope } = z.object({ scope: scopeSchema }).strict().parse(req.query);
    const totals = (await db.query(`WITH visitors AS (
      SELECT id FROM users WHERE account_role='visitor' AND ($1='all' OR source=$1)
    ) SELECT
      (SELECT count(*)::int FROM visitors) AS users,
      (SELECT count(*)::int FROM visitors u WHERE EXISTS(SELECT 1 FROM visits v WHERE v.user_id=u.id)) AS users_with_visits,
      (SELECT count(*)::int FROM brochures b JOIN visitors u ON u.id=b.user_id) AS brochures,
      (SELECT count(*)::int FROM brochures b JOIN visitors u ON u.id=b.user_id WHERE EXISTS(SELECT 1 FROM visits v WHERE v.user_id=u.id)) AS eligible_brochures,
      (SELECT count(*)::int FROM spots WHERE active) AS active_spots,
      (SELECT count(*)::int FROM spots WHERE NOT active) AS stopped_spots`, [scope])).rows[0];
    const categoryRows = (await db.query(`SELECT i.pickup_category, count(*)::int AS count
      FROM brochure_items i JOIN brochures b ON b.id=i.brochure_id JOIN users u ON u.id=b.user_id
      WHERE i.selected AND u.account_role='visitor' AND ($1='all' OR u.source=$1) GROUP BY i.pickup_category`, [scope])).rows;
    const popular = (await db.query(`SELECT s.id,s.name,count(*)::int AS count FROM brochure_items i
      JOIN brochures b ON b.id=i.brochure_id JOIN users u ON u.id=b.user_id JOIN spots s ON s.id=i.spot_id
      WHERE i.selected AND u.account_role='visitor' AND ($1='all' OR u.source=$1)
      GROUP BY s.id,s.name ORDER BY count DESC,s.id LIMIT 5`, [scope])).rows;
    const result: AdminOverview = { users: totals.users, usersWithVisits: totals.users_with_visits,
      brochures: totals.brochures, eligibleBrochures: totals.eligible_brochures,
      activeSpots: totals.active_spots, stoppedSpots: totals.stopped_spots,
      categories: EXPERIENCE_CATEGORIES.map(c => ({ category: c.id, count: categoryRows.find(r => r.pickup_category === c.id)?.count ?? 0 })),
      popularSpots: popular };
    res.json(result);
  });

  router.get('/registrations', async (req, res) => {
    const { scope, status, history, page } = listSchema.parse(req.query);
    const pageSize = 25;
    // 条件は固定SQL、値だけをパラメータで渡す。件数とページを同一snapshotで取得。
    const result = await transaction(async client => {
      await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
      const params = [scope, status, history];
      const where = `u.account_role='visitor' AND ($1='all' OR u.source=$1)
        AND ($2='all' OR ($2='created' AND b.id IS NOT NULL) OR ($2='missing' AND b.id IS NULL))
        AND ($3='all' OR ($3='yes' AND EXISTS(SELECT 1 FROM visits v WHERE v.user_id=u.id))
          OR ($3='no' AND NOT EXISTS(SELECT 1 FROM visits v WHERE v.user_id=u.id)))`;
      const total = (await client.query(`SELECT count(*)::int AS total FROM users u LEFT JOIN brochures b ON b.user_id=u.id WHERE ${where}`, params)).rows[0].total as number;
      const currentPage = Math.min(page, Math.max(1, Math.ceil(total / pageSize)));
      const rows = (await client.query(`SELECT u.id,u.source,b.id AS brochure_id,b.created_at,b.updated_at,
        (SELECT count(*)::int FROM visits v WHERE v.user_id=u.id) AS visits,
        (SELECT count(*)::int FROM brochure_items i WHERE i.brochure_id=b.id AND i.selected) AS selected_spots,
        (SELECT count(*)::int FROM brochure_items i JOIN item_photos p ON p.item_id=i.id WHERE i.brochure_id=b.id AND i.selected) AS photos,
        (SELECT count(*)::int FROM brochure_items i WHERE i.brochure_id=b.id AND i.selected AND i.comment<>'') AS comments
        FROM users u LEFT JOIN brochures b ON b.user_id=u.id WHERE ${where}
        ORDER BY b.updated_at DESC NULLS LAST,u.id LIMIT $4 OFFSET $5`, [...params, pageSize, (currentPage - 1) * pageSize])).rows;
      return { rows: rows.map(r => ({ userId: r.id, source: r.source, visits: r.visits, brochureId: r.brochure_id,
        createdAt: r.created_at?.toISOString() ?? null, updatedAt: r.updated_at?.toISOString() ?? null,
        selectedSpots: r.selected_spots, photos: r.photos, comments: r.comments })), total, page: currentPage, pageSize } satisfies RegistrationPage;
    }, db);
    res.json(result);
  });

  router.get('/spots', async (_req, res) => res.json({ spots: await getAdminSpots(db) }));
  router.post('/spots', async (req, res) => {
    const input = parseSpot(createSchema, req.body);
    if (!SPOT_IMAGES.some(image => image.value === input.image)) throw new AppError(400, 'invalid_image', '新規登録時は同梱画像を選び、登録後に写真を追加してください。');
    const id = input.requestId ?? randomUUID();
    const replayed = await transaction(async client => {
      await client.query('SELECT pg_advisory_xact_lock(6821452)');
      if ((await client.query('SELECT 1 FROM spots WHERE id=$1', [id])).rowCount) {
        const createdByActor = await client.query("SELECT 1 FROM admin_audit_logs WHERE spot_id=$1 AND actor_id=$2 AND action='create'", [id, req.userId]);
        if (!createdByActor.rowCount) throw new AppError(409, 'operation_conflict', '登録操作が競合しました。一覧から登録状況を確認してください。');
        return true;
      }
      await client.query(`INSERT INTO spots(id,external_id,name,category,description,companion_tags,theme_tags,image,source,active,has_gift)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,'town',$9,$10)`, [id, `town:${id}`, input.name, input.category, input.description, input.companionTags, input.themeTags, input.image, input.active, input.hasGift ?? false]);
      await auditSpot(client, req.userId!, id, 'create');
      return false;
    }, db);
    res.status(201).json({ spot: (await getAdminSpots(db)).find(s => s.id === id), replayed });
  });
  router.put('/spots/:id', async (req, res) => {
    const id = uuidSchema.parse(req.params.id), input = parseSpot(updateSchema, req.body);
    await transaction(async client => {
      await client.query('SELECT pg_advisory_xact_lock(6821452)');
      const current = (await client.query('SELECT revision,image FROM spots WHERE id=$1 FOR UPDATE', [id])).rows[0];
      if (!current) throw new AppError(404, 'not_found', 'スポットが見つかりません。');
      if (current.revision !== input.revision) throw new AppError(409, 'revision_conflict', '他の画面で更新されました。入力を控えてから一覧を読み直してください。');
      if (!SPOT_IMAGES.some(image => image.value === input.image) && input.image !== current.image) throw new AppError(400, 'invalid_image', '画像は同梱画像またはこのスポットの保存済み写真を選んでください。');
      const used = (await client.query('SELECT DISTINCT pickup_category FROM brochure_items WHERE spot_id=$1 AND selected AND pickup_category IS NOT NULL', [id])).rows;
      if (used.some(row => !spotSupportsExperienceCategory(input, row.pickup_category))) throw new AppError(409, 'category_in_use', '使用中のパンフレットに必要な体験タグは外せません。タグを残すか、公開停止にしてください。');
      await client.query(`UPDATE spots SET name=$1,category=$2,description=$3,companion_tags=$4,theme_tags=$5,image=$6,active=$7,has_gift=COALESCE($9::boolean,has_gift),revision=revision+1,updated_at=now() WHERE id=$8`,
        [input.name, input.category, input.description, input.companionTags, input.themeTags, input.image, input.active, id, input.hasGift ?? null]);
      await auditSpot(client, req.userId!, id, input.active ? 'update' : 'update_stopped');
    }, db);
    res.json({ spot: (await getAdminSpots(db)).find(s => s.id === id) });
  });
  return router;
}
