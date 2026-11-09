import type pg from 'pg';
import { z } from 'zod';
import { transaction } from './db.js';
import { AppError } from './errors.js';
import type { DataScope } from '../shared/admin-types.js';
import { EXPERIENCE_CATEGORIES } from '../shared/experience-categories.js';

export const scopeInput = { scope: z.enum(['organizer', 'fixture', 'all']).default('organizer').describe('利用者の出所。organizer=提供データ、fixture=デモ、all=両方。省略時は提供データ。') };
export const periodInput = {
  ...scopeInput,
  from: z.iso.date().optional().describe('JSTの開始日 YYYY-MM-DD。toと同時指定。省略時は直近30日。'),
  to: z.iso.date().optional().describe('JSTの終了日 YYYY-MM-DD（当日を含む）。最大366日。fromと同時指定。'),
};
export const periodSchema = z.object(periodInput).strict();
type PeriodInput = z.infer<typeof periodSchema>;
export interface Period { from: string; to: string; start: string; end: string }
export function resolvePeriod(input: Pick<PeriodInput, 'from' | 'to'>): Period {
  if (Boolean(input.from) !== Boolean(input.to)) throw new AppError(400, 'invalid_period', 'fromとtoは一緒に指定してください。');
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date());
  const to = input.to ?? today;
  const from = input.from ?? new Date(Date.parse(`${to}T00:00:00Z`) - 29 * 86400000).toISOString().slice(0, 10);
  const span = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  if (!Number.isFinite(span) || span < 0 || span > 365 * 86400000) throw new AppError(400, 'invalid_period', '開始日から終了日までは最大366日で指定してください。');
  const next = new Date(Date.parse(`${to}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
  return { from, to, start: `${from}T00:00:00+09:00`, end: `${next}T00:00:00+09:00` };
}
type Reader = Pick<pg.PoolClient, 'query'>;

export async function readAnalytics<T>(db: pg.Pool, keyId: string, read: (client: Reader) => Promise<T>): Promise<T> {
  return transaction(async client => {
    await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
    await client.query("SET LOCAL statement_timeout='8s'");
    const { rowCount } = await client.query(`SELECT 1 FROM admin_mcp_keys k JOIN users u ON u.id=k.owner_id
      WHERE k.id=$1 AND k.revoked_at IS NULL AND k.expires_at>now() AND u.account_role='town_admin'`, [keyId]);
    if (!rowCount) throw new AppError(401, 'mcp_key_expired', '接続キーの期限・失効状態を確認してください。');
    return read(client);
  }, db);
}

export async function analyticsOverview(db: Reader, scope: DataScope) {
  const totals = (await db.query(`WITH audience AS (
    SELECT id FROM users WHERE account_role='visitor' AND ($1='all' OR source=$1)
  ) SELECT
    (SELECT count(*)::int FROM audience) AS users,
    (SELECT count(*)::int FROM audience a WHERE EXISTS(SELECT 1 FROM visits v WHERE v.user_id=a.id)) AS users_with_visits,
    (SELECT count(*)::int FROM brochures b JOIN audience a ON a.id=b.user_id) AS brochures,
    (SELECT count(*)::int FROM brochures b JOIN audience a ON a.id=b.user_id WHERE EXISTS(SELECT 1 FROM visits v WHERE v.user_id=a.id)) AS eligible_brochures,
    (SELECT count(*)::int FROM spots WHERE active) AS active_spots,
    (SELECT count(*)::int FROM spots WHERE NOT active) AS stopped_spots`, [scope])).rows[0];
  const categories = (await db.query(`SELECT i.pickup_category,count(*)::int AS count FROM brochure_items i
    JOIN brochures b ON b.id=i.brochure_id JOIN users u ON u.id=b.user_id
    WHERE i.selected AND u.account_role='visitor' AND ($1='all' OR u.source=$1) GROUP BY i.pickup_category`, [scope])).rows;
  return { ...totals, creation_rate_percent: totals.users_with_visits ? Math.round(totals.eligible_brochures / totals.users_with_visits * 10000) / 100 : null,
    categories: EXPERIENCE_CATEGORIES.map(c => ({ category: c.id, label: c.label, count: categories.find(r => r.pickup_category === c.id)?.count ?? 0 })),
    note: '現在値。作成率の母数は訪問履歴あり利用者。スポット公開数は全カタログ。母数0の作成率はnull。' };
}

export async function analyticsSpots(db: Reader, scope: DataScope, period: Period, limit: number) {
  const { rows } = await db.query(`WITH audience AS (
    SELECT id FROM users WHERE account_role='visitor' AND ($1='all' OR source=$1)
  ), visits_in_period AS (
    SELECT v.spot_id,count(*)::int AS visits,count(DISTINCT v.user_id)::int AS visitors
    FROM visits v JOIN audience a ON a.id=v.user_id WHERE v.visited_at >= $2 AND v.visited_at < $3 GROUP BY v.spot_id
  ), selections AS (
    SELECT i.spot_id,count(*)::int AS brochures FROM brochure_items i JOIN brochures b ON b.id=i.brochure_id
    JOIN audience a ON a.id=b.user_id WHERE i.selected AND b.created_at >= $2 AND b.created_at < $3 GROUP BY i.spot_id
  ), claims AS (
    SELECT c.spot_id,count(*)::int AS coupon_uses FROM spot_gift_claims c JOIN audience a ON a.id=c.user_id
    WHERE c.claimed_at >= $2 AND c.claimed_at < $3 GROUP BY c.spot_id
  ) SELECT s.id AS spot_id,s.name,s.category,s.source AS spot_source,s.active,s.has_gift AS coupon_available,
    COALESCE(v.visits,0)::int AS visits,COALESCE(v.visitors,0)::int AS visitors,
    COALESCE(b.brochures,0)::int AS brochure_selections,COALESCE(c.coupon_uses,0)::int AS coupon_uses,
    count(*) OVER()::int AS total_spots
    FROM spots s LEFT JOIN visits_in_period v ON v.spot_id=s.id LEFT JOIN selections b ON b.spot_id=s.id LEFT JOIN claims c ON c.spot_id=s.id
    ORDER BY brochure_selections DESC,visits DESC,coupon_uses DESC,s.id LIMIT $4`, [scope, period.start, period.end, limit]);
  return { total_spots: rows[0]?.total_spots ?? 0, returned: rows.length,
    spots: rows.map(({ total_spots: _total, ...spot }) => spot),
    note: '利用者出所で絞り込み、全出所・公開停止を含むスポットを比較。掲載数は期間内に作成された冊子の現在の選択状態。CSV訪問と利用申告は別指標。' };
}

export async function analyticsBrochures(db: Reader, scope: DataScope) {
  const { rows } = await db.query(`SELECT b.companion,b.duration,b.trip_style,b.template,count(*)::int AS brochures,
    sum(b.regeneration_count)::int AS regenerations
    FROM brochures b JOIN users u ON u.id=b.user_id WHERE u.account_role='visitor' AND ($1='all' OR u.source=$1)
    GROUP BY b.companion,b.duration,b.trip_style,b.template ORDER BY b.companion,b.duration,b.trip_style,b.template`, [scope]);
  const edits = (await db.query(`SELECT count(*)::int AS selected_spots,
    count(*) FILTER(WHERE i.comment<>'')::int AS spots_with_comments,
    count(*) FILTER(WHERE p.id IS NOT NULL)::int AS spots_with_photos
    FROM brochure_items i JOIN brochures b ON b.id=i.brochure_id JOIN users u ON u.id=b.user_id LEFT JOIN item_photos p ON p.item_id=i.id
    WHERE i.selected AND u.account_role='visitor' AND ($1='all' OR u.source=$1)`, [scope])).rows[0];
  return { total_brochures: rows.reduce((sum, r) => sum + r.brochures, 0), combinations: rows, ...edits,
    note: '現在保存されている条件の組合せ。再生成回数は現在までの累計。コメント・写真は選択中の掲載について有無の件数だけ。' };
}

export async function analyticsCoupons(db: Reader, scope: DataScope, period: Period) {
  const totals = (await db.query(`SELECT count(*)::int AS uses,count(DISTINCT c.user_id)::int AS users FROM spot_gift_claims c
    JOIN users u ON u.id=c.user_id WHERE u.account_role='visitor' AND ($1='all' OR u.source=$1) AND c.claimed_at >= $2 AND c.claimed_at < $3`, [scope, period.start, period.end])).rows[0];
  const { rows } = await db.query(`SELECT s.id AS spot_id,s.name,count(*)::int AS uses,count(DISTINCT c.user_id)::int AS users
    FROM spot_gift_claims c JOIN users u ON u.id=c.user_id JOIN spots s ON s.id=c.spot_id
    WHERE u.account_role='visitor' AND ($1='all' OR u.source=$1) AND c.claimed_at >= $2 AND c.claimed_at < $3
    GROUP BY s.id,s.name ORDER BY uses DESC,s.id LIMIT 100`, [scope, period.start, period.end]);
  return { ...totals, spots: rows, limit: 100, note: '利用者のクーポン利用申告。CSV訪問・実来訪とは別。上位100スポット。スポットごとの人数を足しても全体の人数にはならない。' };
}

export async function analyticsShares(db: Reader, scope: DataScope, period: Period) {
  const totals = (await db.query(`SELECT count(*)::int AS issued_now,count(*) FILTER(WHERE s.active)::int AS active_now,
    count(*) FILTER(WHERE s.created_at >= $2 AND s.created_at < $3)::int AS issued_in_period,
    COALESCE(sum(s.view_count),0)::float8 AS lifetime_page_views
    FROM brochure_shares s JOIN brochures b ON b.id=s.brochure_id JOIN users u ON u.id=b.user_id
    WHERE u.account_role='visitor' AND ($1='all' OR u.source=$1)`, [scope, period.start, period.end])).rows[0];
  const views = (await db.query(`SELECT count(*)::int AS page_views_in_period,count(DISTINCT v.share_id)::int AS shared_pages_viewed_in_period
    FROM share_page_views v JOIN brochure_shares s ON s.id=v.share_id JOIN brochures b ON b.id=s.brochure_id JOIN users u ON u.id=b.user_id
    WHERE u.account_role='visitor' AND ($1='all' OR u.source=$1) AND v.viewed_at >= $2 AND v.viewed_at < $3`, [scope, period.start, period.end])).rows[0];
  return { ...totals, ...views, note: '表示回数はリロードを含み、閲覧人数・実来訪人数ではない。現在の公開数と期間内発行数を区別。停止済み共有の過去表示も含む。' };
}

export async function analyticsTrend(db: Reader, scope: DataScope, period: Period) {
  const { rows } = await db.query(`WITH audience AS (
    SELECT id FROM users WHERE account_role='visitor' AND ($1='all' OR source=$1)
  ), events AS (
    SELECT v.visited_at AS event_at,'visit' AS kind FROM visits v JOIN audience a ON a.id=v.user_id WHERE v.visited_at >= $2 AND v.visited_at < $3
    UNION ALL SELECT b.created_at,'brochure' FROM brochures b JOIN audience a ON a.id=b.user_id WHERE b.created_at >= $2 AND b.created_at < $3
    UNION ALL SELECT c.claimed_at,'coupon' FROM spot_gift_claims c JOIN audience a ON a.id=c.user_id WHERE c.claimed_at >= $2 AND c.claimed_at < $3
    UNION ALL SELECT v.viewed_at,'share_view' FROM share_page_views v JOIN brochure_shares s ON s.id=v.share_id
      JOIN brochures b ON b.id=s.brochure_id JOIN audience a ON a.id=b.user_id WHERE v.viewed_at >= $2 AND v.viewed_at < $3
  ), daily AS (
    SELECT (event_at AT TIME ZONE 'Asia/Tokyo')::date AS day,count(*) FILTER(WHERE kind='visit')::int AS csv_visits,
      count(*) FILTER(WHERE kind='brochure')::int AS brochures_created,count(*) FILTER(WHERE kind='coupon')::int AS coupon_uses,
      count(*) FILTER(WHERE kind='share_view')::int AS share_page_views FROM events GROUP BY 1
  ) SELECT to_char(d.day,'YYYY-MM-DD') AS date,COALESCE(v.csv_visits,0)::int AS csv_visits,
    COALESCE(v.brochures_created,0)::int AS brochures_created,COALESCE(v.coupon_uses,0)::int AS coupon_uses,COALESCE(v.share_page_views,0)::int AS share_page_views
    FROM generate_series($4::date::timestamp,$5::date::timestamp,interval '1 day') AS d(day)
    LEFT JOIN daily v ON v.day=d.day::date ORDER BY d.day`, [scope, period.start, period.end, period.from, period.to]);
  return { days: rows, note: 'JSTの日別。0件の日も含む。しおりは初回作成日で計測し、再保存・再生成を新規作成として数えない。各イベントの利用者出所で絞り込む。' };
}
