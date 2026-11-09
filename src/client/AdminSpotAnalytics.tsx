import { useState, type FormEvent } from 'react';
import { CalendarDays, Check } from 'lucide-react';
import type { AdminSpotAnalytics as AnalyticsData, AnalyticsBreakdown, SpotAnalyticsDay } from '../shared/admin-detail-types';
import type { DataScope } from '../shared/admin-types';
import { EXPERIENCE_CATEGORIES } from '../shared/experience-categories';
import { GiftBadge } from './SpotDetailDialog';
import { AdminRegistrationDetail } from './AdminRegistrationDetail';
import { date, number, scopeLabel, sourceLabel, durationLabel, styleLabel, useData, useDrilldown, LoadState, Metric, DetailHeader } from './admin-ui';
import './admin-details.css';

type SeriesKey = keyof Omit<SpotAnalyticsDay, 'date'>;
const series: Array<{ key: SeriesKey; label: string; unit: string }> = [
  { key: 'visits', label: '訪問記録', unit: '件' }, { key: 'brochures', label: '掲載しおりの初回作成', unit: '冊' },
  { key: 'couponUses', label: 'クーポン利用', unit: '件' }, { key: 'shareViews', label: '掲載しおりの公開URLアクセス', unit: '回' },
  { key: 'shareCopies', label: '掲載しおりの公開URLコピー', unit: '回' },
];
function recentPeriod(days: number) {
  const to = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date());
  return { from: new Date(Date.parse(`${to}T00:00:00Z`) - (days - 1) * 86400000).toISOString().slice(0, 10), to };
}

function Breakdown({ title, rows, total, labels = {} }: { title: string; rows: AnalyticsBreakdown[]; total: number; labels?: Record<string, string> }) {
  const maximum = Math.max(1, ...rows.map(row => row.count));
  return <section className="admin-panel admin-distribution"><h2>{title}</h2><p className="admin-muted">現在掲載中の{number(total)}冊を集計</p>
    {rows.length ? <dl>{rows.map(row => <div key={row.key}><dt>{labels[row.key] ?? row.key}</dt><dd><strong>{number(row.count)}冊 <small>（{total ? Math.round(row.count / total * 100) : 0}%）</small></strong>
      <span className="admin-distribution-track" aria-hidden="true"><span style={{ width: `${row.count / maximum * 100}%` }} /></span></dd></div>)}</dl> : <p className="admin-empty">まだ掲載されているしおりはありません。</p>}
  </section>;
}

function Trend({ days, field }: { days: SpotAnalyticsDay[]; field: SeriesKey }) {
  const metric = series.find(item => item.key === field)!;
  const peak = Math.max(0, ...days.map(day => day[field]));
  const total = days.reduce((sum, day) => sum + day[field], 0);
  const x = (index: number) => days.length === 1 ? 350 : 46 + index / Math.max(1, days.length - 1) * 616;
  const y = (value: number) => 171 - value / Math.max(1, peak) * 135;
  const points = days.map((day, index) => `${x(index).toFixed(1)},${y(day[field]).toFixed(1)}`).join(' ');
  return <figure className="admin-trend" aria-label={`${metric.label}の日別推移。期間合計${number(total)}${metric.unit}、1日の最大${number(peak)}${metric.unit}。正確な日別値は下の表から確認できます。`}>
    <figcaption>{metric.label}<strong>期間合計 {number(total)}{metric.unit}</strong></figcaption>
    <p className="admin-trend-scale">縦軸：0 ～ {number(Math.max(1, peak))}{metric.unit} / 日</p>
    <svg viewBox="0 0 700 200" preserveAspectRatio="none" aria-hidden="true">
      <line x1="46" x2="662" y1="36" y2="36" className="admin-trend-grid" /><line x1="46" x2="662" y1="171" y2="171" className="admin-trend-axis" />
      <polyline points={points} className={`admin-trend-line trend-${field}`} />
      {days.length === 1 && <circle cx={x(0)} cy={y(days[0]![field])} r="4" className={`admin-trend-point trend-${field}`} />}
    </svg>
    <div className="admin-trend-dates"><span>{days[0]?.date}</span><span>{days.at(-1)?.date}</span></div>
    {total === 0 && <p className="admin-muted">この期間の記録は0件です。過去の訪問を確認する場合は期間を変更してください。</p>}
  </figure>;
}

export function AdminSpotAnalytics({ spotId, onBack }: { spotId: string; onBack: () => void }) {
  const [scope, setScope] = useState<DataScope>('all');
  const [applied, setApplied] = useState(() => recentPeriod(30));
  const [input, setInput] = useState(applied), [periodError, setPeriodError] = useState('');
  const [field, setField] = useState<SeriesKey>('visits');
  const registration = useDrilldown();
  const query = new URLSearchParams({ scope, from: applied.from, to: applied.to });
  const { data, loading, error, reload } = useData<AnalyticsData>(`/api/admin/spots/${encodeURIComponent(spotId)}/analytics?${query}`);
  function applyPeriod(event: FormEvent) {
    event.preventDefault();
    const span = Date.parse(`${input.to}T00:00:00Z`) - Date.parse(`${input.from}T00:00:00Z`);
    if (!Number.isFinite(span) || span < 0 || span > 365 * 86400000) { setPeriodError('開始日から終了日までは最大366日で指定してください。'); return; }
    setPeriodError('');
    if (applied.from === input.from && applied.to === input.to) reload(); else setApplied({ ...input });
  }
  const totals = data?.totals;
  return <>
    <section hidden={registration.id !== null} className="admin-detail" data-testid="admin-spot-analytics">
      <DetailHeader title="スポットの詳細分析" onBack={onBack} backLabel="スポット一覧へ戻る" onRefresh={reload} loading={loading} />
      <div className="admin-analysis-controls"><label>分析のデータ範囲<select value={scope} onChange={event => setScope(event.target.value as DataScope)}>{Object.entries(scopeLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><p className="admin-muted">利用者の出所で絞り込みます。</p></div>
      <LoadState loading={loading} error={error} retry={reload} />
      {data && totals && <>
        <section className="admin-panel admin-analysis-spot"><img src={data.spot.image} alt="" width="160" height="112" /><div><h2>{data.spot.name}</h2>
          <p>{data.spot.category} · {sourceLabel[data.spot.source]}</p><div className="admin-detail-badges"><span className={`admin-badge ${data.spot.active ? 'is-active' : ''}`}>{data.spot.active ? '公開中' : '公開停止'}</span><GiftBadge available={data.spot.hasGift} /></div>
          <p className="admin-muted">{data.spot.description}</p><div className="admin-tags">{data.spot.themeTags.map(tag => <span key={tag}>{tag}</span>)}</div></div></section>
        <div className="admin-detail-section-heading"><h2>累計・現在の掲載状況</h2><span>{scopeLabel[data.scope]}</span></div>
        <div className="admin-metrics">
          <Metric label="訪問記録" value={number(totals.visits)} unit="件" detail={`累計 ${number(totals.visitors)}人のスタンプラリー記録`} />
          <Metric label="掲載しおり" value={number(totals.brochures)} unit="冊" detail={totals.allBrochures ? `全${number(totals.allBrochures)}冊中 ${Math.round(totals.brochures / totals.allBrochures * 1000) / 10}%に掲載` : '集計対象のしおりはまだありません'} />
          <Metric label="クーポン利用" value={number(totals.couponUses)} unit="件" detail="利用者が使用を確認した累計件数" />
          <Metric label="選ばれた思い出" value={number(totals.memoryBrochures)} unit="冊" detail="現在、前回の思い出に選んでいるしおりの数" />
        </div>
        <div className="admin-metrics gift-claim-metrics">
          <Metric label="公開URLコピー回数" value={number(totals.shareCopies)} unit="回" detail="現在このスポットを掲載するしおりの合計（計測開始後）" />
          <Metric label="公開URLアクセス数" value={number(totals.shareViews)} unit="回" detail="現在このスポットを掲載するしおりの合計（再読み込み含む）" />
        </div>
        <section className="admin-panel"><h2>掲載・編集の内訳</h2><dl className="admin-detail-facts">
          <div><dt>前回の思い出に選択</dt><dd>{number(totals.memoryBrochures)}冊</dd></div><div><dt>掲載の区分</dt><dd>訪問済み {number(totals.visitedSelections)}冊 / 新しい体験 {number(totals.candidateSelections)}冊</dd></div>
          <div><dt>写真の登録</dt><dd>{number(totals.photos)}冊</dd></div><div><dt>コメントの登録</dt><dd>{number(totals.comments)}冊</dd></div>
          <div><dt>掲載しおりの共有URL</dt><dd>{number(totals.sharedPages)}件（公開中 {number(totals.activeSharedPages)}件）</dd></div>
          <div><dt>最初の訪問 / 最後の訪問</dt><dd>{date(totals.firstVisitedAt)} / {date(totals.lastVisitedAt)}</dd></div>
        </dl><p className="admin-muted">思い出の選択は掲載外も含みます。写真・コメント・旅の条件の内訳は現在掲載中のしおりを対象にします。</p></section>
        <div className="admin-two-columns">
          <Breakdown title="誰と行きたいか" rows={data.breakdowns.companions} total={totals.brochures} />
          <Breakdown title="どの体験として選ばれたか" rows={data.breakdowns.categories} total={totals.brochures} labels={Object.fromEntries([...EXPERIENCE_CATEGORIES.map(category => [category.id, category.label]), ['unassigned', '未割当']])} />
          <Breakdown title="旅の日数" rows={data.breakdowns.durations} total={totals.brochures} labels={durationLabel} />
          <Breakdown title="どんな旅にしたいか" rows={data.breakdowns.tripStyles} total={totals.brochures} labels={styleLabel} />
        </div>
      </>}
      <section className="admin-panel"><h2><CalendarDays aria-hidden="true" />期間を指定して推移を見る</h2>
        <form className="admin-period-form" onSubmit={applyPeriod}><label>開始日<input type="date" required value={input.from} min="1900-01-01" max={input.to || '2100-12-31'} onChange={event => setInput(current => ({ ...current, from: event.target.value }))} /></label>
          <label>終了日<input type="date" required value={input.to} min={input.from || '1900-01-01'} max="2100-12-31" onChange={event => setInput(current => ({ ...current, to: event.target.value }))} /></label>
          <button className="button button-primary" disabled={loading}><Check aria-hidden="true" />期間を適用</button></form>
        <div className="admin-period-presets">{[30, 90, 365].map(days => <button type="button" className="button button-outline" key={days} disabled={loading} onClick={() => { const next = recentPeriod(days); setInput(next); setApplied(next); setPeriodError(''); }}>直近{days}日</button>)}</div>
        {periodError && <p className="admin-error" role="alert">{periodError}</p>}
        <p className="admin-muted">日本時間・両端の日を含む最大366日。期間の指定は下の推移だけに適用し、累計の指標は変わりません。</p>
      </section>
      {data && <>
        <p className="admin-period-summary" role="status">表示期間：{data.period.from} ～ {data.period.to}（{data.period.days.length}日間）</p>
        <div className="admin-metrics">{series.map(metric => <Metric key={metric.key} label={`期間内の${metric.label}`} value={number(data.period.totals[metric.key])} unit={metric.unit} detail="指定した期間の合計" />)}</div>
        <section className="admin-panel"><div className="admin-detail-section-heading"><h2>日別推移</h2><label className="admin-scope">推移の指標<select value={field} onChange={event => setField(event.target.value as SeriesKey)}>{series.map(metric => <option key={metric.key} value={metric.key}>{metric.label}</option>)}</select></label></div>
          <Trend days={data.period.days} field={field} />
          <details className="admin-trend-table"><summary>日別データを表で確認する（{data.period.days.length}日分）</summary><div className="admin-table-scroll" role="region" aria-label="スポットの日別集計（横にスクロールできます）" tabIndex={0}><table className="admin-table"><thead><tr><th scope="col">日付（日本時間）</th>{series.map(metric => <th scope="col" key={metric.key}>{metric.label}（{metric.unit}）</th>)}</tr></thead><tbody>{data.period.days.map(day => <tr key={day.date}><th scope="row">{day.date}</th>{series.map(metric => <td key={metric.key}>{number(day[metric.key])}</td>)}</tr>)}</tbody></table></div></details>
        </section>
        <section className="admin-panel admin-table-panel"><div className="admin-table-heading"><h2>このスポットを掲載しているしおり</h2><span>最新更新順・最大10冊</span></div>
          {data.recentBrochures.length ? <div className="admin-table-scroll" role="region" aria-label="スポット掲載しおり一覧（横にスクロールできます）" tabIndex={0}><table className="admin-table"><thead><tr><th scope="col">匿名利用者ID / 出所</th><th scope="col">旅の条件</th><th scope="col">初回作成</th><th scope="col">最終更新</th><th scope="col">操作</th></tr></thead><tbody>{data.recentBrochures.map(row => <tr key={row.id}><th scope="row"><code className="admin-anon-id">{row.userId}</code><small>{sourceLabel[row.source]}</small></th><td>{row.companion}<small>{durationLabel[row.duration]} · {styleLabel[row.tripStyle]}</small></td><td>{date(row.createdAt)}</td><td>{date(row.updatedAt)}</td><td><button className="button button-outline" aria-label={`${row.userId}の作成詳細を表示`} onClick={event => registration.open(row.userId, event.currentTarget)}>作成詳細</button></td></tr>)}</tbody></table></div> : <p className="admin-empty">現在このスポットを掲載しているしおりはありません。</p>}
        </section>
        <section className="admin-analysis-note"><h2>集計の見方</h2><p>掲載数・条件・コピー・アクセスは、現在このスポットを掲載するしおりを基準に集計します。掲載しおりの初回作成は作成日で数え、再保存・再生成は新規作成に含みません。</p><p>アクセスはしおり全体の本文表示回数で、このスポット自体の閲覧数ではありません。掲載前の表示や再読み込みも含みます。コピーは計測機能追加後のブラウザによるコピー成功回数で、手動コピーは含みません。訪問記録、クーポン利用、アクセスはそれぞれ別の指標です。</p></section>
      </>}
    </section>
    {registration.id && <AdminRegistrationDetail key={registration.id} userId={registration.id} scope={scope} onBack={registration.close} backLabel="スポット分析へ戻る" />}
  </>;
}
