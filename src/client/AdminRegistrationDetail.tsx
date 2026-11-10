import type { AdminRegistrationDetail as DetailData } from '../shared/admin-detail-types';
import type { DataScope } from '../shared/admin-types';
import { EXPERIENCE_CATEGORIES } from '../shared/experience-categories';
import { date, number, sourceLabel, durationLabel, styleLabel, templateLabel, useData, LoadState, Metric, DetailHeader } from './admin-ui';
import './admin-details.css';

export function AdminRegistrationDetail({ userId, scope, onBack, backLabel = '登録一覧へ戻る' }: {
  userId: string; scope: DataScope; onBack: () => void; backLabel?: string;
}) {
  const { data, loading, error, reload } = useData<DetailData>(`/api/admin/registrations/${encodeURIComponent(userId)}?scope=${scope}`);
  const brochure = data?.brochure;
  const positions = new Map(data?.items.filter(item => item.selected).map((item, index) => [item.id, index + 1]));
  return <section className="admin-detail" data-testid="admin-registration-detail">
    <DetailHeader title="パンフレットの作成詳細" onBack={onBack} backLabel={backLabel} onRefresh={reload} loading={loading} />
    <LoadState loading={loading} error={error} retry={reload} />
    {data && <>
      <section className="admin-panel"><div className="admin-detail-section-heading"><h2>登録情報</h2><span className={`admin-badge ${brochure ? 'is-active' : ''}`}>{brochure ? '作成済み' : '未作成'}</span></div>
        <dl className="admin-detail-facts"><div><dt>匿名利用者ID</dt><dd><code>{data.registration.userId}</code></dd></div><div><dt>出所</dt><dd>{sourceLabel[data.registration.source]}</dd></div>
          <div><dt>訪問記録</dt><dd>{number(data.registration.visits)}件 / {number(data.registration.visitedSpots)}スポット</dd></div>
          <div><dt>スタンプ取得</dt><dd>{number(data.registration.stamps)}件</dd></div><div><dt>最終訪問日時</dt><dd>{date(data.registration.lastVisitedAt)}</dd></div></dl>
      </section>
      {!brochure ? <section className="admin-panel"><h2>パンフレットはまだ作成されていません</h2><p className="admin-muted">{data.registration.visits ? '訪問履歴は登録されています。利用者が思い出と旅の条件を選ぶと作成されます。' : '訪問履歴がないため、作成対象の旅はありません。'}</p></section> : <>
        <div className="admin-metrics">
          <Metric label="掲載スポット" value={number(brochure.selectedSpots)} unit="か所" detail="おすすめの訪問順に掲載中" />
          <Metric label="選んだ思い出" value={number(brochure.memorySpots)} unit="か所" detail="前回の訪問先から選んだスポット" />
          <Metric label="登録写真" value={number(brochure.photos)} unit="件" detail="掲載中スポットの写真登録数" />
          <Metric label="登録コメント" value={number(brochure.comments)} unit="件" detail="掲載中スポットのコメント登録数" />
        </div>
        <section className="admin-panel"><h2>旅の条件・作成状況</h2><dl className="admin-detail-facts">
          <div><dt>誘う相手</dt><dd>{brochure.companion}</dd></div><div><dt>日数</dt><dd>{durationLabel[brochure.duration]}</dd></div>
          <div><dt>どんな旅にしたい</dt><dd>{styleLabel[brochure.tripStyle]}</dd></div><div><dt>デザイン</dt><dd>{templateLabel[brochure.template]}</dd></div>
          <div><dt>初回作成</dt><dd>{date(brochure.createdAt)}</dd></div><div><dt>最終更新</dt><dd>{date(brochure.updatedAt)}</dd></div>
          <div><dt>再生成</dt><dd>{number(brochure.regenerationCount)}回</dd></div><div><dt>保存バージョン</dt><dd>{number(brochure.revision)}</dd></div>
          <div className="admin-fact-wide"><dt>パンフレットID</dt><dd><code>{brochure.id}</code></dd></div>
        </dl></section>
        <section className="admin-panel admin-table-panel"><div className="admin-table-heading"><h2>掲載スポット・前回の思い出</h2><span>{data.items.length}か所</span></div>
          {data.items.length ? <div className="admin-table-scroll" role="region" aria-label="作成詳細のスポット一覧（横にスクロールできます）" tabIndex={0}><table className="admin-table"><thead><tr><th scope="col">訪問順</th><th scope="col">スポット</th><th scope="col">掲載・思い出</th><th scope="col">体験カテゴリ</th><th scope="col">写真</th><th scope="col">コメント</th></tr></thead><tbody>
            {data.items.map(item => <tr key={item.id}><td>{positions.get(item.id) ?? '—'}</td><th scope="row" className="admin-detail-spot-name">{item.name}<small>{item.kind === 'visited' ? '訪問済み' : '新しい体験'} · {item.active ? '公開中' : '公開停止'}</small></th>
              <td>{item.selected ? '掲載中' : '思い出のみ'}{item.isMemory && <small>前回の思い出に選択</small>}</td><td>{item.selected ? EXPERIENCE_CATEGORIES.find(category => category.id === item.pickupCategory)?.label ?? '未割当' : '—'}</td><td>{item.hasPhoto ? 'あり' : 'なし'}</td><td>{item.hasComment ? `あり（${number(item.commentLength)}字）` : 'なし'}</td></tr>)}
          </tbody></table></div> : <p className="admin-empty">掲載・思い出に選ばれたスポットはありません。</p>}
          <p className="admin-detail-table-note">写真とコメントは登録の有無を表示します。上の登録件数は掲載中スポットのみの集計です。</p>
        </section>
        <section className="admin-panel"><h2>共有状況</h2>{data.share ? <dl className="admin-detail-facts"><div><dt>公開状態</dt><dd><span className={`admin-badge ${data.share.active ? 'is-active' : ''}`}>{data.share.active ? '公開中' : '公開停止'}</span></dd></div>
          <div><dt>公開URLコピー回数</dt><dd>{number(data.share.copyCount)}回</dd></div><div><dt>公開URLアクセス数</dt><dd>{number(data.share.viewCount)}回</dd></div>
          <div><dt>いいね数</dt><dd>{number(data.share.likeCount)}件</dd></div><div><dt>最終コピー日時</dt><dd>{date(data.share.lastCopiedAt)}</dd></div><div><dt>URL発行日時</dt><dd>{date(data.share.createdAt)}</dd></div><div><dt>最終アクセス日時</dt><dd>{date(data.share.lastViewedAt)}</dd></div></dl> : <p className="admin-empty">共有URLはまだ発行されていません。</p>}
          <p className="admin-muted">コピーは計測機能追加後のブラウザによるコピー成功回数です。手動コピーは含みません。アクセス数は本文表示時に計測し、再読み込みを含みます。閲覧人数・実来訪人数ではありません。いいね数はこのしおりの全スポットへの現在件数です。取消分を除き、公開停止・掲載終了したスポットの分も含みます。</p>
        </section>
      </>}
    </>}
  </section>;
}
