import { Router } from 'express';
import type pg from 'pg';
import { z } from 'zod';
import type { AdminRegistrationDetail, AdminSpotAnalytics, AnalyticsBreakdown, SpotAnalyticsDay } from '../shared/admin-detail-types.js';
import type { DataScope } from '../shared/admin-types.js';
import { resolvePeriod, type Period } from './analytics.js';
import { transaction } from './db.js';
import { AppError } from './errors.js';
import { uuidSchema } from './validation.js';

const scope = z.enum(['all', 'organizer', 'fixture']).default('all');
const scopeQuery = z.object({ scope }).strict();
const calendarDate = z.iso.date().refine(value => value >= '1900-01-01' && value <= '2100-12-31', '日付は1900年から2100年の範囲で指定してください。');
const periodQuery = z.object({ scope, from: calendarDate.optional(), to: calendarDate.optional() }).strict();
type Reader = Pick<pg.PoolClient, 'query'>;
const iso = (value: Date | null): string | null => value?.toISOString() ?? null;

async function read<T>(db: pg.Pool, callback: (client: Reader) => Promise<T>) {
  return transaction(async client => {
    await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
    await client.query("SET LOCAL statement_timeout='8s'");
    return callback(client);
  }, db);
}

async function registrationDetail(db: Reader, id: string, source: DataScope): Promise<AdminRegistrationDetail> {
  const row = (await db.query(`SELECT u.id,u.source,b.id AS brochure_id,b.revision,b.companion,b.duration,b.trip_style,b.template,
    b.created_at,b.updated_at,b.regeneration_count,
    (SELECT count(*)::int FROM visits v WHERE v.user_id=u.id) AS visits,
    (SELECT count(DISTINCT v.spot_id)::int FROM visits v WHERE v.user_id=u.id) AS visited_spots,
    (SELECT count(*)::int FROM visits v WHERE v.user_id=u.id AND v.stamp) AS stamps,
    (SELECT max(v.visited_at) FROM visits v WHERE v.user_id=u.id) AS last_visited_at
    FROM users u LEFT JOIN brochures b ON b.user_id=u.id
    WHERE u.id=$1 AND u.account_role='visitor' AND ($2='all' OR u.source=$2)`, [id, source])).rows[0];
  if (!row) throw new AppError(404, 'not_found', 'このデータ範囲に対象の登録が見つかりません。');
  const result: AdminRegistrationDetail = { registration: { userId: row.id, source: row.source, visits: row.visits,
    visitedSpots: row.visited_spots, stamps: row.stamps, lastVisitedAt: iso(row.last_visited_at) }, brochure: null, items: [], share: null };
  if (!row.brochure_id) return result;
  const items = (await db.query(`SELECT i.id,i.spot_id,s.name,s.active,i.kind,i.selected,i.is_memory,i.sort_order,i.pickup_category,
    EXISTS(SELECT 1 FROM item_photos p WHERE p.item_id=i.id) AS has_photo,
    (i.comment<>'') AS has_comment,char_length(i.comment)::int AS comment_length
    FROM brochure_items i JOIN spots s ON s.id=i.spot_id
    WHERE i.brochure_id=$1 AND (i.selected OR (i.kind='visited' AND i.is_memory))
    ORDER BY i.selected DESC,i.sort_order,s.name,i.id`, [row.brochure_id])).rows;
  result.items = items.map(item => ({ id: item.id, spotId: item.spot_id, name: item.name, active: item.active,
    kind: item.kind, selected: item.selected, isMemory: item.kind === 'visited' && item.is_memory, order: item.sort_order,
    pickupCategory: item.pickup_category, hasPhoto: item.has_photo, hasComment: item.has_comment, commentLength: item.comment_length }));
  const selected = result.items.filter(item => item.selected);
  result.brochure = { id: row.brochure_id, revision: row.revision, companion: row.companion, duration: row.duration, tripStyle: row.trip_style,
    template: row.template, createdAt: iso(row.created_at)!, updatedAt: iso(row.updated_at)!, regenerationCount: row.regeneration_count,
    selectedSpots: selected.length, memorySpots: result.items.filter(item => item.isMemory).length,
    photos: selected.filter(item => item.hasPhoto).length, comments: selected.filter(item => item.hasComment).length };
  const shared = (await db.query(`SELECT s.active,s.view_count,s.copy_count,s.created_at,s.last_viewed_at,s.last_copied_at,
    (SELECT count(*)::int FROM share_spot_likes l WHERE l.share_id=s.id) AS like_count
    FROM brochure_shares s WHERE s.brochure_id=$1`, [row.brochure_id])).rows[0];
  if (shared) result.share = { active: shared.active, viewCount: shared.view_count, copyCount: shared.copy_count, likeCount: shared.like_count,
    createdAt: iso(shared.created_at)!, lastViewedAt: iso(shared.last_viewed_at), lastCopiedAt: iso(shared.last_copied_at) };
  return result;
}

async function spotAnalytics(db: Reader, id: string, source: DataScope, period: Period): Promise<AdminSpotAnalytics> {
  const spot = (await db.query('SELECT id,name,category,description,image,source,active,has_gift,theme_tags FROM spots WHERE id=$1', [id])).rows[0];
  if (!spot) throw new AppError(404, 'not_found', 'スポットが見つかりません。');
  const params = [id, source];
  const total = (await db.query(`WITH audience AS (
      SELECT id FROM users WHERE account_role='visitor' AND ($2='all' OR source=$2)
    ), picked AS (
      SELECT i.brochure_id,i.id,i.kind,i.comment FROM brochure_items i JOIN brochures b ON b.id=i.brochure_id
      JOIN audience a ON a.id=b.user_id WHERE i.spot_id=$1 AND i.selected
    ), recorded_visits AS (SELECT v.user_id,v.visited_at FROM visits v JOIN audience a ON a.id=v.user_id WHERE v.spot_id=$1)
    SELECT
      (SELECT count(*)::int FROM recorded_visits) AS visits,
      (SELECT count(DISTINCT user_id)::int FROM recorded_visits) AS visitors,
      (SELECT min(visited_at) FROM recorded_visits) AS first_visited_at,
      (SELECT max(visited_at) FROM recorded_visits) AS last_visited_at,
      (SELECT count(*)::int FROM picked) AS brochures,
      (SELECT count(*)::int FROM brochures b JOIN audience a ON a.id=b.user_id) AS all_brochures,
      (SELECT count(*)::int FROM brochure_items i JOIN brochures b ON b.id=i.brochure_id JOIN audience a ON a.id=b.user_id
        WHERE i.spot_id=$1 AND i.kind='visited' AND i.is_memory) AS memory_brochures,
      (SELECT count(*)::int FROM picked WHERE kind='visited') AS visited_selections,
      (SELECT count(*)::int FROM picked WHERE kind='candidate') AS candidate_selections,
      (SELECT count(*)::int FROM picked i JOIN item_photos p ON p.item_id=i.id) AS photos,
      (SELECT count(*)::int FROM picked WHERE comment<>'') AS comments,
      (SELECT count(*)::int FROM spot_gift_claims c JOIN audience a ON a.id=c.user_id WHERE c.spot_id=$1) AS coupon_uses,
      (SELECT count(*)::int FROM brochure_shares s JOIN picked i ON i.brochure_id=s.brochure_id) AS shared_pages,
      (SELECT count(*)::int FROM brochure_shares s JOIN picked i ON i.brochure_id=s.brochure_id WHERE s.active) AS active_shared_pages,
      (SELECT COALESCE(sum(s.view_count),0)::float8 FROM brochure_shares s JOIN picked i ON i.brochure_id=s.brochure_id) AS share_views,
      (SELECT COALESCE(sum(s.copy_count),0)::float8 FROM brochure_shares s JOIN picked i ON i.brochure_id=s.brochure_id) AS share_copies,
      (SELECT count(*)::int FROM share_spot_likes l JOIN brochure_shares s ON s.id=l.share_id
        JOIN brochures b ON b.id=s.brochure_id JOIN audience a ON a.id=b.user_id WHERE l.spot_id=$1) AS like_count`, params)).rows[0];
  const groups = (await db.query(`SELECT d.dimension,d.key,count(*)::int AS count FROM brochure_items i
    JOIN brochures b ON b.id=i.brochure_id JOIN users u ON u.id=b.user_id
    CROSS JOIN LATERAL (VALUES ('companion',b.companion),('duration',b.duration),('style',b.trip_style),('category',COALESCE(i.pickup_category,'unassigned'))) AS d(dimension,key)
    WHERE i.spot_id=$1 AND i.selected AND u.account_role='visitor' AND ($2='all' OR u.source=$2)
    GROUP BY d.dimension,d.key ORDER BY count DESC,d.key`, params)).rows;
  const group = (dimension: string): AnalyticsBreakdown[] => groups.filter(row => row.dimension === dimension).map(row => ({ key: row.key, count: row.count }));
  const days: SpotAnalyticsDay[] = (await db.query(`WITH audience AS (
      SELECT id FROM users WHERE account_role='visitor' AND ($2='all' OR source=$2)
    ), picked AS (
      SELECT b.id,b.created_at FROM brochure_items i JOIN brochures b ON b.id=i.brochure_id JOIN audience a ON a.id=b.user_id
      WHERE i.spot_id=$1 AND i.selected
    ), events AS (
      SELECT v.visited_at AS event_at,'visit' AS kind FROM visits v JOIN audience a ON a.id=v.user_id
        WHERE v.spot_id=$1 AND v.visited_at >= $3 AND v.visited_at < $4
      UNION ALL SELECT b.created_at,'brochure' FROM picked b WHERE b.created_at >= $3 AND b.created_at < $4
      UNION ALL SELECT c.claimed_at,'coupon' FROM spot_gift_claims c JOIN audience a ON a.id=c.user_id
        WHERE c.spot_id=$1 AND c.claimed_at >= $3 AND c.claimed_at < $4
      UNION ALL SELECT v.viewed_at,'share' FROM share_page_views v JOIN brochure_shares s ON s.id=v.share_id JOIN picked b ON b.id=s.brochure_id
        WHERE v.viewed_at >= $3 AND v.viewed_at < $4
      UNION ALL SELECT c.copied_at,'copy' FROM share_url_copies c JOIN brochure_shares s ON s.id=c.share_id JOIN picked b ON b.id=s.brochure_id
        WHERE c.copied_at >= $3 AND c.copied_at < $4
    ), daily AS (
      SELECT (event_at AT TIME ZONE 'Asia/Tokyo')::date AS day,count(*) FILTER(WHERE kind='visit')::int AS visits,
        count(*) FILTER(WHERE kind='brochure')::int AS brochures,count(*) FILTER(WHERE kind='coupon')::int AS coupon_uses,
        count(*) FILTER(WHERE kind='share')::int AS share_views,count(*) FILTER(WHERE kind='copy')::int AS share_copies FROM events GROUP BY 1
    ) SELECT to_char(d.day,'YYYY-MM-DD') AS date,COALESCE(v.visits,0)::int AS visits,COALESCE(v.brochures,0)::int AS brochures,
      COALESCE(v.coupon_uses,0)::int AS coupon_uses,COALESCE(v.share_views,0)::int AS share_views,COALESCE(v.share_copies,0)::int AS share_copies
      FROM generate_series($5::date::timestamp,$6::date::timestamp,interval '1 day') AS d(day)
      LEFT JOIN daily v ON v.day=d.day::date ORDER BY d.day`, [...params, period.start, period.end, period.from, period.to])).rows.map(row => ({
    date: row.date, visits: row.visits, brochures: row.brochures, couponUses: row.coupon_uses, shareViews: row.share_views, shareCopies: row.share_copies,
  }));
  const recent = (await db.query(`SELECT b.id,u.id AS user_id,u.source,b.companion,b.duration,b.trip_style,b.created_at,b.updated_at
    FROM brochure_items i JOIN brochures b ON b.id=i.brochure_id JOIN users u ON u.id=b.user_id
    WHERE i.spot_id=$1 AND i.selected AND u.account_role='visitor' AND ($2='all' OR u.source=$2)
    ORDER BY b.updated_at DESC,b.id LIMIT 10`, params)).rows;
  return { scope: source, spot: { id: spot.id, name: spot.name, category: spot.category, description: spot.description, image: spot.image,
    source: spot.source, active: spot.active, hasGift: spot.has_gift, themeTags: spot.theme_tags },
    totals: { visits: total.visits, visitors: total.visitors, firstVisitedAt: iso(total.first_visited_at), lastVisitedAt: iso(total.last_visited_at),
      brochures: total.brochures, allBrochures: total.all_brochures, memoryBrochures: total.memory_brochures,
      visitedSelections: total.visited_selections, candidateSelections: total.candidate_selections, photos: total.photos, comments: total.comments,
      couponUses: total.coupon_uses, sharedPages: total.shared_pages, activeSharedPages: total.active_shared_pages, shareViews: total.share_views, shareCopies: total.share_copies, likeCount: total.like_count },
    breakdowns: { companions: group('companion'), durations: group('duration'), tripStyles: group('style'), categories: group('category') },
    period: { from: period.from, to: period.to, days, totals: days.reduce((sum, day) => ({ visits: sum.visits + day.visits,
      brochures: sum.brochures + day.brochures, couponUses: sum.couponUses + day.couponUses, shareViews: sum.shareViews + day.shareViews,
      shareCopies: sum.shareCopies + day.shareCopies }), { visits: 0, brochures: 0, couponUses: 0, shareViews: 0, shareCopies: 0 }) },
    recentBrochures: recent.map(row => ({ id: row.id, userId: row.user_id, source: row.source, companion: row.companion, duration: row.duration,
      tripStyle: row.trip_style, createdAt: iso(row.created_at)!, updatedAt: iso(row.updated_at)! })) };
}

// createAdminRouterの町権限middleware配下からのみmountする。
export function createAdminDetailRouter(db: pg.Pool) {
  const router = Router();
  router.get('/registrations/:id', async (req, res) => {
    const id = uuidSchema.parse(req.params.id), query = scopeQuery.parse(req.query);
    res.json(await read(db, client => registrationDetail(client, id, query.scope)));
  });
  router.get('/spots/:id/analytics', async (req, res) => {
    const id = uuidSchema.parse(req.params.id), query = periodQuery.parse(req.query), period = resolvePeriod(query);
    res.json(await read(db, client => spotAnalytics(client, id, query.scope, period)));
  });
  return router;
}
