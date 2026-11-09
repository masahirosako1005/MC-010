import { Router } from 'express';
import { randomInt, randomUUID } from 'node:crypto';
import type pg from 'pg';
import { z } from 'zod';
import type { CouponDisplay, GiftClaim, GiftClaimPage, SpotDetail } from '../shared/admin-types.js';
import type { Spot } from '../shared/types.js';
import { transaction } from './db.js';
import { AppError } from './errors.js';
import { uuidSchema } from './validation.js';

type DB = Pick<pg.PoolClient, 'query'>;
function mapSpot(row: pg.QueryResultRow): Spot {
  return { id: row.id, name: row.name, category: row.category, description: row.description,
    companionTags: row.companion_tags, themeTags: row.theme_tags, image: row.image,
    source: row.source, sourceUrl: row.source_url, active: row.active, hasGift: row.has_gift };
}
function mapClaim(row: pg.QueryResultRow): GiftClaim {
  return { id: row.id, spotId: row.spot_id, claimedAt: row.claimed_at.toISOString() };
}
async function ownedSpot(db: DB, userId: string, spotId: string) {
  const row = (await db.query(`SELECT s.* FROM spots s JOIN brochure_items i ON i.spot_id=s.id
    JOIN brochures b ON b.id=i.brochure_id WHERE b.user_id=$1 AND s.id=$2 LIMIT 1`, [userId, spotId])).rows[0];
  if (!row) throw new AppError(404, 'not_found', 'パンフレットのスポットが見つかりません。');
  return row;
}

async function couponCode(db: DB, userId: string, spotId: string): Promise<string> {
  const existingCode = async () => (await db.query('SELECT code FROM spot_coupon_codes WHERE user_id=$1 AND spot_id=$2', [userId, spotId])).rows[0]?.code as string | undefined;
  const existing = await existingCode();
  if (existing) return existing;
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join('');
    const inserted = (await db.query(`INSERT INTO spot_coupon_codes(user_id,spot_id,code) VALUES($1,$2,$3)
      ON CONFLICT DO NOTHING RETURNING code`, [userId, spotId, code])).rows[0];
    if (inserted) return inserted.code;
    const concurrent = await existingCode();
    if (concurrent) return concurrent;
  }
  throw new AppError(503, 'coupon_unavailable', 'クーポンを表示できませんでした。もう一度お試しください。');
}

export function createGiftRouter(db: pg.Pool) {
  const router = Router();
  router.use('/spots', (req, _res, next) => {
    if (req.accountRole !== 'visitor') return next(new AppError(403, 'visitor_required', 'クーポンの表示・利用は利用者アカウント専用です。'));
    next();
  });
  router.get('/spots/:id/detail', async (req, res) => {
    const spotId = uuidSchema.parse(req.params.id), row = await ownedSpot(db, req.userId!, spotId);
    const claim = (await db.query('SELECT id,spot_id,claimed_at FROM spot_gift_claims WHERE user_id=$1 AND spot_id=$2', [req.userId, spotId])).rows[0];
    res.json({ spot: mapSpot(row), giftClaim: claim ? mapClaim(claim) : null } satisfies SpotDetail);
  });
  router.post('/spots/:id/coupon', async (req, res) => {
    const spotId = uuidSchema.parse(req.params.id); z.object({}).strict().parse(req.body);
    const result = await transaction(async client => {
      await client.query('SELECT pg_advisory_xact_lock_shared(6821452)');
      const spot = await ownedSpot(client, req.userId!, spotId);
      const existing = (await client.query('SELECT id,spot_id,claimed_at FROM spot_gift_claims WHERE user_id=$1 AND spot_id=$2', [req.userId, spotId])).rows[0];
      if (existing) return { couponCode: null, giftClaim: mapClaim(existing) };
      if (!spot.active || !spot.has_gift) throw new AppError(409, 'gift_unavailable', '現在、このスポットのクーポンは利用できません。詳細を開き直してご確認ください。');
      return { couponCode: await couponCode(client, req.userId!, spotId), giftClaim: null };
    }, db);
    res.json(result satisfies CouponDisplay);
  });
  router.post('/spots/:id/gift-claim', async (req, res) => {
    const spotId = uuidSchema.parse(req.params.id); z.object({}).strict().parse(req.body);
    const result = await transaction(async client => {
      await client.query('SELECT pg_advisory_xact_lock_shared(6821452)');
      const spot = await ownedSpot(client, req.userId!, spotId);
      const existing = (await client.query('SELECT id,spot_id,claimed_at FROM spot_gift_claims WHERE user_id=$1 AND spot_id=$2', [req.userId, spotId])).rows[0];
      if (existing) return { giftClaim: mapClaim(existing), alreadyClaimed: true };
      if (!spot.active || !spot.has_gift) throw new AppError(409, 'gift_unavailable', '現在、このスポットのクーポンは利用できません。詳細を開き直してご確認ください。');
      if (!(await client.query('SELECT 1 FROM spot_coupon_codes WHERE user_id=$1 AND spot_id=$2', [req.userId, spotId])).rowCount) {
        throw new AppError(409, 'coupon_not_displayed', 'クーポンを表示し直してからご利用ください。');
      }
      const inserted = (await client.query(`INSERT INTO spot_gift_claims(id,user_id,spot_id) VALUES($1,$2,$3)
        ON CONFLICT(user_id,spot_id) DO NOTHING RETURNING id,spot_id,claimed_at`, [randomUUID(), req.userId, spotId])).rows[0];
      const claim = inserted ?? (await client.query('SELECT id,spot_id,claimed_at FROM spot_gift_claims WHERE user_id=$1 AND spot_id=$2', [req.userId, spotId])).rows[0];
      return { giftClaim: mapClaim(claim), alreadyClaimed: !inserted };
    }, db);
    res.json(result);
  });
  return router;
}

export function createGiftAdminRouter(db: pg.Pool) {
  const router = Router();
  router.use((req, _res, next) => {
    if (req.accountRole !== 'town_admin') return next(new AppError(403, 'admin_required', '町側アカウントでログインしてください。'));
    next();
  });
  router.get('/gift-claims', async (req, res) => {
    const { scope, spotId, page } = z.object({
      scope: z.enum(['all', 'organizer', 'fixture']).default('all'), spotId: uuidSchema.optional(),
      page: z.coerce.number().int().min(1).max(100000).default(1),
    }).strict().parse(req.query);
    const pageSize = 25;
    const result = await transaction(async client => {
      await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
      const params = [scope, spotId ?? null];
      const from = `FROM spot_gift_claims c JOIN users u ON u.id=c.user_id JOIN spots s ON s.id=c.spot_id
        WHERE ($1='all' OR u.source=$1) AND ($2::uuid IS NULL OR c.spot_id=$2)`;
      const totals = (await client.query(`SELECT count(*)::int AS total,count(DISTINCT c.user_id)::int AS users ${from}`, params)).rows[0];
      const currentPage = Math.min(page, Math.max(1, Math.ceil(totals.total / pageSize)));
      const rows = (await client.query(`SELECT c.id,c.spot_id,c.claimed_at,c.user_id,u.source,s.name AS spot_name ${from}
        ORDER BY c.claimed_at DESC,c.id LIMIT $3 OFFSET $4`, [...params, pageSize, (currentPage - 1) * pageSize])).rows;
      return { rows: rows.map(row => ({ ...mapClaim(row), userId: row.user_id, source: row.source, spotName: row.spot_name })),
        total: totals.total, users: totals.users, page: currentPage, pageSize } satisfies GiftClaimPage;
    }, db);
    res.json(result);
  });
  return router;
}
