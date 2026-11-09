import { useEffect, useRef, useState, type FormEvent } from 'react';
import { BarChart3, Building2, Check, ChevronLeft, ChevronRight, ClipboardList, Ticket, LoaderCircle, LogOut, MapPin, PencilLine, Plug, Plus, RefreshCw, Save, Share2, X } from 'lucide-react';
import { COMPANIONS, type User } from '../shared/types';
import { EXPERIENCE_CATEGORIES, spotSupportsExperienceCategory } from '../shared/experience-categories';
import { SPOT_IMAGES, THEME_TAGS, type AdminOverview, type AdminSpot, type DataScope, type RegistrationPage, type SpotInput, type GiftClaimPage } from '../shared/admin-types';
import './admin.css';
import { GiftBadge } from './SpotDetailDialog';
import type { AdminSharePage } from '../shared/sharing-types';
import { AdminMcp } from './AdminMcp';
import { AdminApiError, request, date, number, scopeLabel, sourceLabel, useData, LoadState, Metric, useDrilldown } from './admin-ui';
import { AdminRegistrationDetail } from './AdminRegistrationDetail';
import { AdminSpotAnalytics } from './AdminSpotAnalytics';
type Tab = 'overview' | 'spots' | 'registrations' | 'claims' | 'shares' | 'mcp';

export function AdminDashboard({ user, onLogout, notice }: { user: User; onLogout: () => Promise<void>; notice: string }) {
  const [tab, setTab] = useState<Tab>('overview'), [scope, setScope] = useState<DataScope>('all'), [dirty, setDirty] = useState(false), [saving, setSaving] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const tabs = [{ id: 'overview' as const, label: '概況', icon: BarChart3 }, { id: 'spots' as const, label: 'スポット管理', icon: MapPin }, { id: 'registrations' as const, label: 'パンフレット登録状況', icon: ClipboardList }, { id: 'claims' as const, label: '来訪履歴（クーポン利用）', icon: Ticket }, { id: 'shares' as const, label: '共有状況', icon: Share2 }, { id: 'mcp' as const, label: 'MCP・分析連携', icon: Plug }];
  useEffect(() => { titleRef.current?.focus({ preventScroll: true }); }, [tab]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const mayLeave = () => !saving && (!dirty || window.confirm('スポットに未保存の変更があります。変更を破棄して移動しますか？'));
  return <div className="admin-app">
    <a className="admin-skip" href="#admin-main">本文へ移動</a>
    <header className="admin-header"><div><span className="mini-brand">今度はあなたと</span><span className="admin-town"><Building2 aria-hidden="true" />町管理</span></div>
      <div><span className="admin-account">{user.displayName}</span><button className="button admin-logout" disabled={saving} onClick={() => { if (mayLeave()) void onLogout(); }}><LogOut aria-hidden="true" />ログアウト</button></div>
    </header>
    <div className="admin-layout">
      <nav className="admin-nav" aria-label="町管理メニュー">{tabs.map(item => <button key={item.id} disabled={saving} aria-current={tab === item.id ? 'page' : undefined} onClick={() => {
        if (tab === item.id || !mayLeave()) return;
        setDirty(false); setTab(item.id);
      }}><item.icon aria-hidden="true" />{item.label}</button>)}<p>ローカルデモ専用</p></nav>
      <main id="admin-main" className="admin-main">
        <div className="admin-page-heading"><div><p className="eyebrow">町の運営・管理</p><h1 ref={titleRef} tabIndex={-1}>{tabs.find(item => item.id === tab)?.label}</h1></div>
          {tab !== 'spots' && tab !== 'mcp' && <label className="admin-scope">データ範囲<select value={scope} onChange={event => setScope(event.target.value as DataScope)}>{Object.entries(scopeLabel).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>}
        </div>
        {notice && <p className="admin-error" role="alert">{notice}</p>}
        {tab === 'overview' && <Overview scope={scope} />}
        {tab === 'spots' && <Spots onDirty={setDirty} onBusy={setSaving} />}
        {tab === 'registrations' && <Registrations key={scope} scope={scope} />}
        {tab === 'claims' && <GiftClaims key={scope} scope={scope} />}
        {tab === 'shares' && <Shares key={scope} scope={scope} />}
        {tab === 'mcp' && <AdminMcp onBusy={setSaving} />}
      </main>
    </div>
  </div>;
}

function Overview({ scope }: { scope: DataScope }) {
  const { data, loading, error, reload } = useData<AdminOverview>(`/api/admin/overview?scope=${scope}`);
  const rate = data?.usersWithVisits ? Math.round(data.eligibleBrochures / data.usersWithVisits * 100) : 0;
  return <>
    <div className="admin-section-intro"><p>訪問履歴と保存済みパンフレットの現在の状況を確認できます。</p><button className="button" disabled={loading} onClick={reload}><RefreshCw aria-hidden="true" />更新</button></div>
    <LoadState loading={loading} error={error} retry={reload} />
    {data && <>
      <div className="admin-metrics">
        <Metric label="利用者" value={number(data.users)} unit="人" detail="町管理アカウントを除く" />
        <Metric label="訪問履歴あり" value={number(data.usersWithVisits)} unit="人" detail="スタンプラリーの記録がある利用者" />
        <Metric label="パンフレット作成済み" value={number(data.brochures)} unit="冊" detail="1利用者につき1冊" />
        <Metric label="パンフレット作成率" value={data.usersWithVisits ? String(rate) : '—'} unit={data.usersWithVisits ? '%' : ''} detail="訪問履歴あり利用者を母数に集計" />
      </div>
      <div className="admin-two-columns">
        <section className="admin-panel"><h2>体験カテゴリ別の採用</h2><p className="admin-muted">保存済みパンフレットの選択中スポット数</p>
          <dl className="admin-bars">{data.categories.map(row => <div key={row.category}><dt>{EXPERIENCE_CATEGORIES.find(c => c.id === row.category)?.label}</dt><dd><span className={`admin-bar bar-${row.category}`} style={{ width: `${row.count ? Math.max(3, row.count / Math.max(1, ...data.categories.map(c => c.count)) * 100) : 0}%` }} /><strong>{number(row.count)}件</strong></dd></div>)}</dl>
          {!data.brochures && <p className="admin-empty">まだパンフレットが作成されていません。</p>}
        </section>
        <section className="admin-panel"><h2>よく選ばれているスポット</h2><p className="admin-muted">保存済みパンフレットへの掲載数・上位5件</p>
          <ol className="admin-ranking">{data.popularSpots.map(row => <li key={row.id}><span>{row.name}</span><strong>{number(row.count)}冊</strong></li>)}</ol>
          {!data.popularSpots.length && <p className="admin-empty">集計対象のスポットはありません。</p>}
        </section>
      </div>
      <section className="admin-panel admin-spot-summary"><MapPin aria-hidden="true" /><div><h2>スポットの公開状況</h2><p>公開中 <strong>{data.activeSpots}</strong>件 ／ 公開停止 <strong>{data.stoppedSpots}</strong>件</p><p className="admin-muted">スポットの公開状況はデータ範囲によらず全件を表示します。</p></div></section>
      <p className="admin-muted">ブラウザでの未保存編集は集計に含みません。カテゴリ未割当の旧パンフレットは、カテゴリ別の数に含まれない場合があります。</p>
    </>}
  </>;
}
function Registrations({ scope }: { scope: DataScope }) {
  const [status, setStatus] = useState('all'), [history, setHistory] = useState('all'), [page, setPage] = useState(1);
  const detail = useDrilldown();
  const { data, loading, error, reload } = useData<RegistrationPage>(`/api/admin/registrations?scope=${scope}&status=${status}&history=${history}&page=${page}`);
  return <><div hidden={detail.id !== null}>
    <p className="admin-description">利用者ごとの作成状況を匿名IDで確認します。写真・コメントは選択中スポットの件数だけを表示します。</p>
    <div className="admin-filters"><label>登録状態<select value={status} onChange={event => { setPage(1); setStatus(event.target.value); }}><option value="all">すべて</option><option value="created">作成済み</option><option value="missing">未作成</option></select></label>
      <label>訪問履歴<select value={history} onChange={event => { setPage(1); setHistory(event.target.value); }}><option value="all">すべて</option><option value="yes">履歴あり</option><option value="no">履歴なし</option></select></label>
      <button className="button" disabled={loading} onClick={reload}><RefreshCw aria-hidden="true" />更新</button>
    </div>
    <LoadState loading={loading} error={error} retry={reload} />
    {data && <section className="admin-panel admin-table-panel">
      <div className="admin-table-heading"><h2>登録一覧</h2><span>{number(data.total)}人</span></div>
      {data.rows.length ? <div className="admin-table-scroll" role="region" aria-label="パンフレット登録一覧（横にスクロールできます）" tabIndex={0}><table className="admin-table"><thead><tr><th scope="col">匿名利用者ID / 出所</th><th scope="col">訪問履歴</th><th scope="col">登録状態</th><th scope="col">掲載 / 写真 / コメント</th><th scope="col">作成日時</th><th scope="col">最終更新日時</th><th scope="col">操作</th></tr></thead><tbody>
        {data.rows.map(row => <tr key={row.userId}><th scope="row"><code className="admin-anon-id">{row.userId}</code><small>{sourceLabel[row.source]}</small></th><td>{row.visits}件</td><td><span className={`admin-badge ${row.brochureId ? 'is-active' : ''}`}>{row.brochureId ? '作成済み' : '未作成'}</span>{!row.visits && <small>履歴なし</small>}</td><td>{row.brochureId ? `${row.selectedSpots} / ${row.photos} / ${row.comments}件` : '—'}</td><td>{date(row.createdAt)}</td><td>{date(row.updatedAt)}</td><td><button className="button button-outline" aria-label={`${row.userId}の作成詳細を表示`} onClick={event => detail.open(row.userId, event.currentTarget)}>詳細</button></td></tr>)}
      </tbody></table></div> : <p className="admin-empty">この条件に合う利用者はいません。</p>}
      <div className="admin-pagination"><span role="status">{data.page} / {Math.max(1, Math.ceil(data.total / data.pageSize))}ページ</span><button className="button" disabled={data.page <= 1 || loading} onClick={() => setPage(data.page - 1)}><ChevronLeft aria-hidden="true" />前へ</button><button className="button" disabled={data.page * data.pageSize >= data.total || loading} onClick={() => setPage(data.page + 1)}>次へ<ChevronRight aria-hidden="true" /></button></div>
    </section>}
    <p className="admin-muted">未作成には訪問履歴がない利用者も含まれます。必要に応じて「履歴あり」で絞り込んでください。</p>
    </div>{detail.id && <AdminRegistrationDetail key={detail.id} userId={detail.id} scope={scope} onBack={detail.close} />}
  </>;
}

function Spots({ onDirty, onBusy }: { onDirty: (dirty: boolean) => void; onBusy: (busy: boolean) => void }) {
  const { data, loading, error, reload } = useData<{ spots: AdminSpot[] }>('/api/admin/spots');
  const [editor, setEditor] = useState<{ spot: AdminSpot | null; key: number } | null>(null), [dirty, setDirty] = useState(false);
  const [search, setSearch] = useState(''), [status, setStatus] = useState('all'), [busy, setBusy] = useState(false);
  const analysis = useDrilldown();
  function select(spot: AdminSpot | null) {
    if (busy) return;
    if (dirty && !window.confirm('未保存の変更を破棄して別のスポットを開きますか？')) return;
    setDirty(false); onDirty(false); setEditor({ spot, key: Date.now() });
  }
  const spots = (data?.spots ?? []).filter(spot => (status === 'all' || (status === 'active' ? spot.active : !spot.active)) && (!search || `${spot.name} ${spot.category}`.includes(search.trim())));
  return <><div hidden={analysis.id !== null}>
    <div className="admin-section-intro"><p>名称・説明・体験タグ・画像を管理します。公開停止後も、既存の履歴とパンフレットは残ります。</p><button className="button button-primary" onClick={() => select(null)}><Plus aria-hidden="true" />スポットを登録</button></div>
    {editor && <SpotEditor key={editor.key} spot={editor.spot} onDirty={value => { setDirty(value); onDirty(value); }} onBusy={value => { setBusy(value); onBusy(value); }} onSaved={reload} onClose={() => { if (!dirty || window.confirm('未保存の変更を破棄しますか？')) { setEditor(null); setDirty(false); onDirty(false); } }} />}
    <div className="admin-filters"><label>スポットを検索<input type="search" placeholder="名称・分類" value={search} onChange={event => setSearch(event.target.value)} /></label><label>公開状態<select value={status} onChange={event => setStatus(event.target.value)}><option value="all">すべて</option><option value="active">公開中</option><option value="stopped">公開停止</option></select></label><button className="button" disabled={loading} onClick={reload}><RefreshCw aria-hidden="true" />一覧を更新</button></div>
    <LoadState loading={loading} error={error} retry={reload} />
    {data && <section className="admin-panel admin-table-panel"><div className="admin-table-heading"><h2>スポット一覧</h2><span>{spots.length}件</span></div>
      {spots.length ? <div className="admin-table-scroll" role="region" aria-label="スポット一覧（横にスクロールできます）" tabIndex={0}><table className="admin-table admin-spots-table"><thead><tr><th scope="col">スポット</th><th scope="col">体験カテゴリ</th><th scope="col">状態</th><th scope="col">訪問 / 人数 / 掲載</th><th scope="col">クーポン利用</th><th scope="col">操作</th></tr></thead><tbody>{spots.map(spot => <tr key={spot.id}><th scope="row"><div className="admin-spot-cell"><img src={spot.image} alt="" loading="lazy" /><span>{spot.name}<small>{spot.category} · {sourceLabel[spot.source]}</small><GiftBadge available={spot.hasGift} /></span></div></th><td><div className="admin-tags">{EXPERIENCE_CATEGORIES.filter(c => spotSupportsExperienceCategory(spot, c.id)).map(c => <span key={c.id}>{c.label}</span>)}</div></td><td><span className={`admin-badge ${spot.active ? 'is-active' : ''}`}>{spot.active ? '公開中' : '公開停止'}</span></td><td>{spot.visitCount}件 / {spot.visitorCount}人 / {spot.brochureCount}冊</td><td>{spot.giftClaimCount}件</td><td><div className="admin-row-actions"><button className="button button-outline" disabled={busy} aria-label={`${spot.name}の詳細分析`} onClick={event => { if (!busy) analysis.open(spot.id, event.currentTarget); }}><BarChart3 aria-hidden="true" />詳細分析</button><button className="button button-outline" aria-label={`${spot.name}を編集`} onClick={() => select(spot)}><PencilLine aria-hidden="true" />編集</button></div></td></tr>)}</tbody></table></div> : <p className="admin-empty">この条件に合うスポットはありません。</p>}
    </section>}
    <p className="admin-muted">訪問はCSV由来の履歴、クーポン利用は利用者の確認操作による申告件数です。件数は提供・デモデータの合計です。新しく登録したスポットは、利用者がパンフレットを再生成すると候補に加わります。</p>
    </div>{analysis.id && <AdminSpotAnalytics key={analysis.id} spotId={analysis.id} onBack={analysis.close} />}
  </>;
}

const blankSpot: SpotInput = { name: '', category: '景色', description: '', image: SPOT_IMAGES[0].value, themeTags: ['景色'], companionTags: [...COMPANIONS], active: true, hasGift: false };
function inputFrom(spot: AdminSpot): SpotInput {
  return { name: spot.name, category: spot.category, description: spot.description, image: spot.image, themeTags: spot.themeTags, companionTags: spot.companionTags.filter((value): value is typeof COMPANIONS[number] => COMPANIONS.some(c => c === value)), active: spot.active, hasGift: spot.hasGift ?? false };
}

function SpotEditor({ spot, onDirty, onBusy, onSaved, onClose }: { spot: AdminSpot | null; onDirty: (dirty: boolean) => void; onBusy: (busy: boolean) => void; onSaved: () => void; onClose: () => void }) {
  const [saved, setSaved] = useState(spot), [form, setForm] = useState<SpotInput>(() => spot ? inputFrom(spot) : { ...blankSpot });
  const [photo, setPhoto] = useState<File | null>(null), [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const [requestId] = useState(() => crypto.randomUUID());
  const [conflict, setConflict] = useState(false), [latest, setLatest] = useState<AdminSpot | null>(null);
  const heading = useRef<HTMLHeadingElement>(null), errorRef = useRef<HTMLParagraphElement>(null), fileRef = useRef<HTMLInputElement>(null);
  const metadataDirty = JSON.stringify(form) !== JSON.stringify(saved ? inputFrom(saved) : blankSpot);
  const dirty = metadataDirty || photo !== null;
  const dirtyCallback = useRef(onDirty);
  dirtyCallback.current = onDirty;
  useEffect(() => { dirtyCallback.current(dirty || busy); }, [dirty, busy]);
  useEffect(() => { heading.current?.focus(); heading.current?.scrollIntoView({ block: 'start', behavior: 'instant' }); }, []);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  useEffect(() => { if (!photo) { setPreview(''); return; } const url = URL.createObjectURL(photo); setPreview(url); return () => URL.revokeObjectURL(url); }, [photo]);
  const update = <K extends keyof SpotInput>(key: K, value: SpotInput[K]) => { setForm(current => ({ ...current, [key]: value })); setMessage(''); };
  async function loadLatest() {
    setBusy(true); onBusy(true);
    try {
      const response = await request<{ spots: AdminSpot[] }>('/api/admin/spots');
      const current = response.spots.find(item => item.id === (saved?.id ?? requestId));
      if (!current) throw new Error('登録済みのスポットが見つかりません。一覧から確認してください。');
      setLatest(current);
    } catch (reason) { setError(reason instanceof Error ? reason.message : '最新情報を読み込めませんでした。'); }
    finally { setBusy(false); onBusy(false); }
  }
  function reconcileLatest() {
    if (!latest) return;
    const previous = saved ? inputFrom(saved) : blankSpot, remote = inputFrom(latest);
    // 変更していない欄は他画面の更新を採用し、自分の入力とFileは保持する。
    setForm(current => Object.fromEntries(Object.entries(current).map(([key, value]) => [key,
      JSON.stringify(value) === JSON.stringify(previous[key as keyof SpotInput]) ? remote[key as keyof SpotInput] : value,
    ])) as unknown as SpotInput);
    setSaved(latest); setLatest(null); setConflict(false); setError('');
    setMessage('最新の保存内容を取り込みました。入力と写真を確認して保存してください。');
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return;
    setBusy(true); onBusy(true); setError(''); setMessage('');
    let current = saved;
    let metadataSaved = !metadataDirty && Boolean(saved);
    try {
      if (!current || metadataDirty) {
        const result = await request<{ spot: AdminSpot; replayed?: boolean }>(current ? `/api/admin/spots/${current.id}` : '/api/admin/spots', { method: current ? 'PUT' : 'POST', body: JSON.stringify({ ...form, ...(current ? { revision: current.revision } : { requestId }) }) });
        if (result.replayed) {
          setLatest(result.spot); setConflict(true); onSaved();
          throw new Error('前回の登録は完了しています。保存済みの内容を確認し、入力と写真を保持して編集を続けてください。');
        }
        current = result.spot; metadataSaved = true; setSaved(current); setForm(inputFrom(current)); onSaved();
      }
      if (photo && current) {
        const payload = new FormData(); payload.append('photo', photo);
        const result = await request<{ image: string; revision: number }>(`/api/admin/spots/${current.id}/photo`, { method: 'POST', body: payload, headers: { 'If-Match': String(current.revision) } });
        current = { ...current, ...result }; setSaved(current); setForm(inputFrom(current)); setPhoto(null);
        if (fileRef.current) fileRef.current.value = '';
        onSaved();
      }
      setMessage('スポットを保存しました。'); onDirty(false);
    } catch (reason) {
      if (reason instanceof AdminApiError && reason.code === 'revision_conflict') { setConflict(true); setLatest(null); }
      setError(`${metadataSaved && photo ? 'スポット情報は保存済みです。写真はこの画面に残っています。' : ''}${reason instanceof Error ? reason.message : '保存できませんでした。入力を確認して再試行してください。'}`);
    }
    finally { setBusy(false); onBusy(false); }
  }
  return <section className="admin-panel admin-editor" aria-labelledby="spot-editor-heading">
    <div className="admin-table-heading"><h2 id="spot-editor-heading" tabIndex={-1} ref={heading}>{saved ? 'スポットを編集' : 'スポットを登録'}</h2><button className="icon-button" disabled={busy} onClick={onClose} aria-label="編集を閉じる"><X aria-hidden="true" /></button></div>
    <p className="admin-editor-note">名称・説明・画像の変更は保存済みパンフレットにも反映されます。使用中カテゴリに必要なタグは外せません。</p>
    <form onSubmit={event => void submit(event)}>
      <fieldset disabled={busy} className="admin-form-fields"><legend className="sr-only">スポット情報</legend>
        <div className="admin-form-grid"><label>スポット名 <span>必須・100字以内</span><input required maxLength={100} value={form.name} onChange={event => update('name', event.target.value)} /></label><label>分類 <span>必須・40字以内</span><input required maxLength={40} value={form.category} onChange={event => update('category', event.target.value)} list="spot-classifications" /><datalist id="spot-classifications">{['景色', '文化', '町歩き', '食', '自然'].map(value => <option key={value} value={value} />)}</datalist></label></div>
        <label>紹介文 <span>必須・1000字以内</span><textarea required maxLength={1000} rows={3} value={form.description} onChange={event => update('description', event.target.value)} /></label>
        <fieldset className="admin-check-group"><legend>体験タグ <small>1つ以上選択</small></legend><div>{THEME_TAGS.map(tag => <label key={tag}><input type="checkbox" checked={form.themeTags.includes(tag)} onChange={() => update('themeTags', form.themeTags.includes(tag) ? form.themeTags.filter(t => t !== tag) : [...form.themeTags, tag])} />{tag}</label>)}</div><p className="admin-muted">掲載できるカテゴリ：{EXPERIENCE_CATEGORIES.filter(c => spotSupportsExperienceCategory(form, c.id)).map(c => c.label).join('・') || 'なし'}</p></fieldset>
        <fieldset className="admin-check-group"><legend>おすすめの同行者 <small>1つ以上選択</small></legend><div>{COMPANIONS.map(value => <label key={value}><input type="checkbox" checked={form.companionTags.includes(value)} onChange={() => update('companionTags', form.companionTags.includes(value) ? form.companionTags.filter(c => c !== value) : [...form.companionTags, value])} />{value}</label>)}</div></fieldset>
        <div className="admin-image-fields"><img src={preview || form.image} alt="スポット画像プレビュー" /><div><label>表示画像<select value={form.image} onChange={event => update('image', event.target.value)}>{saved?.image.startsWith('/api/') && <option value={saved.image}>追加した写真</option>}{SPOT_IMAGES.map(image => <option key={image.value} value={image.value}>{image.label}（デモイメージ）</option>)}</select></label>
          <label>写真を追加・差し替え<input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={event => { const file = event.target.files?.[0] ?? null; if (file && (file.size > 5 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))) { setError('写真は5MB以内のJPEG・PNG・WebPを選んでください。'); event.target.value = ''; return; } setError(''); setPhoto(file); setMessage(''); }} /></label>
          <p className="admin-muted">1スポット1枚・5MB以内。保存時に位置情報等を除去します。</p>
          {photo && <button type="button" className="button" onClick={() => { setPhoto(null); if (fileRef.current) fileRef.current.value = ''; }}>選択した写真を取り消す</button>}
        </div></div>
        <label className="admin-publish"><input type="checkbox" checked={form.active} onChange={event => update('active', event.target.checked)} /><span>公開する<small>オフにすると新規・再生成の候補から除外します。既存の掲載は残ります。</small></span></label>
        <label className="admin-publish"><input type="checkbox" checked={Boolean(form.hasGift)} onChange={event => update('hasGift', event.target.checked)} /><span>クーポンあり<small>オンにするとスポット詳細にクーポン表示ボタンを表示します。利用者1人につき、このスポットで1回だけ使えます。オフにしても使用済みの履歴は残ります。</small></span></label>
      </fieldset>
      {error && <p className="admin-error" tabIndex={-1} ref={errorRef} role="alert">{error}</p>}
      {conflict && <section className="admin-conflict" aria-label="保存の競合を解消"><p>入力と選択した写真はこの画面に残っています。最新の保存内容と照合してから再試行できます。</p><button className="button" type="button" disabled={busy} onClick={() => void loadLatest()}>最新の保存内容を確認</button>
        {latest && <><dl><div><dt>保存済み名称</dt><dd>{latest.name}</dd></div><div><dt>保存済み紹介文</dt><dd>{latest.description}</dd></div><div><dt>保存済みタグ</dt><dd>{latest.themeTags.join('・')}</dd></div><div><dt>同行者</dt><dd>{latest.companionTags.join('・')}</dd></div><div><dt>公開状態</dt><dd>{latest.active ? '公開中' : '公開停止'}</dd></div><div><dt>最終更新</dt><dd>{date(latest.updatedAt)}</dd></div></dl><button className="button button-outline" type="button" onClick={reconcileLatest}>入力と写真を保持して編集を続ける</button></>}
      </section>}
      <div className="admin-editor-actions"><button className="button button-primary" type="submit" disabled={busy || (!dirty && Boolean(saved))}>{busy ? <LoaderCircle className="spin" aria-hidden="true" /> : <Save aria-hidden="true" />}{busy ? '保存中' : '保存する'}</button><button className="button" type="button" disabled={busy} onClick={onClose}>閉じる</button><span role="status" aria-live="polite">{message ? <><Check aria-hidden="true" />{message}</> : dirty ? '未保存の変更があります' : saved ? '保存済み' : '新規登録'}</span></div>
    </form>
  </section>;
}

function Shares({ scope }: { scope: DataScope }) {
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useData<AdminSharePage>(`/api/admin/shares?scope=${scope}&page=${page}`);
  return <>
    <p className="admin-description">公開URLの発行・コピー回数とアクセス数です。コピーは計測開始後のブラウザによる成功回数（手動コピーを除く）、アクセスは本文表示の回数（再読み込みを含む）です。同じ記録の再送は加算せず、作者のプレビューや画像取得はアクセスの対象外です。</p>
    <div className="admin-filters"><button className="button" disabled={loading} onClick={reload}><RefreshCw aria-hidden="true" />更新</button></div>
    <LoadState loading={loading} error={error} retry={reload} />
    {data && <>
      <div className="admin-metrics share-metrics"><Metric label="発行済み共有URL" value={number(data.total)} unit="件" detail="1パンフレットにつき1件" /><Metric label="公開中" value={number(data.active)} unit="件" detail="公開停止後も履歴と件数を保持" /><Metric label="公開URLコピー回数" value={number(data.totalCopies)} unit="回" detail="選択したデータ範囲の合計（計測開始後）" /><Metric label="公開URLアクセス数" value={number(data.totalViews)} unit="回" detail="選択したデータ範囲の累計" /></div>
      <section className="admin-panel admin-table-panel"><div className="admin-table-heading"><h2>共有状況</h2><span>{number(data.total)}件</span></div>
        {data.rows.length ? <div className="admin-table-scroll" role="region" aria-label="共有状況（横にスクロールできます）" tabIndex={0}><table className="admin-table"><thead><tr><th scope="col">匿名利用者ID</th><th scope="col">出所</th><th scope="col">公開状態</th><th scope="col">コピー回数</th><th scope="col">アクセス数</th><th scope="col">URL発行日時</th><th scope="col">最終コピー日時</th><th scope="col">最終アクセス日時</th></tr></thead><tbody>{data.rows.map(row => <tr key={row.id}><th scope="row"><code className="admin-anon-id">{row.userId}</code></th><td>{sourceLabel[row.source]}</td><td><span className={`admin-badge ${row.active ? 'is-active' : ''}`}>{row.active ? '公開中' : '公開停止'}</span></td><td>{number(row.copyCount)}回</td><td>{number(row.viewCount)}回</td><td>{date(row.createdAt)}</td><td>{date(row.lastCopiedAt)}</td><td>{date(row.lastViewedAt)}</td></tr>)}</tbody></table></div> : <p className="admin-empty">共有URLはまだ発行されていません。</p>}
        <div className="admin-pagination"><span role="status">{data.page} / {Math.max(1, Math.ceil(data.total / data.pageSize))}ページ</span><button className="button" disabled={data.page <= 1 || loading} onClick={() => setPage(data.page - 1)}><ChevronLeft aria-hidden="true" />前へ</button><button className="button" disabled={data.page * data.pageSize >= data.total || loading} onClick={() => setPage(data.page + 1)}>次へ<ChevronRight aria-hidden="true" /></button></div>
      </section>
    </>}
  </>;
}

function GiftClaims({ scope }: { scope: DataScope }) {
  const [spotId, setSpotId] = useState(''), [page, setPage] = useState(1);
  const spots = useData<{ spots: AdminSpot[] }>('/api/admin/spots');
  const { data, loading, error, reload } = useData<GiftClaimPage>(`/api/admin/gift-claims?scope=${scope}&page=${page}${spotId ? `&spotId=${encodeURIComponent(spotId)}` : ''}`);
  return <>
    <p className="admin-description">利用者がスポット詳細でクーポンの「使う」を確定した記録です。表示・キャンセルだけでは計測しません。1利用者・1スポットにつき1件で、CSVのスタンプ履歴には加算しません。実際の位置や現地訪問を検証するものではありません。</p>
    <div className="admin-filters"><label>スポット<select value={spotId} onChange={event => { setSpotId(event.target.value); setPage(1); }}><option value="">すべてのスポット</option>{spots.data?.spots.map(spot => <option value={spot.id} key={spot.id}>{spot.name}</option>)}</select></label><button className="button" disabled={loading} onClick={() => { reload(); spots.reload(); }}><RefreshCw aria-hidden="true" />更新</button></div>
    {spots.error && <LoadState loading={false} error={spots.error} retry={spots.reload} />}
    <LoadState loading={loading} error={error} retry={reload} />
    {data && <>
      <div className="admin-metrics gift-claim-metrics"><Metric label="クーポン利用件数" value={number(data.total)} unit="件" detail="選択したデータ範囲・スポットで集計" /><Metric label="利用した利用者" value={number(data.users)} unit="人" detail="複数スポットで利用した同一利用者は1人" /></div>
      <section className="admin-panel admin-table-panel"><div className="admin-table-heading"><h2>来訪履歴（クーポン利用）</h2><span>{number(data.total)}件</span></div>
        {data.rows.length ? <div className="admin-table-scroll" role="region" aria-label="クーポン利用履歴（横にスクロールできます）" tabIndex={0}><table className="admin-table"><thead><tr><th scope="col">利用日時</th><th scope="col">スポット</th><th scope="col">匿名利用者ID</th><th scope="col">出所</th></tr></thead><tbody>{data.rows.map(row => <tr key={row.id}><td>{date(row.claimedAt)}</td><th scope="row">{row.spotName}</th><td><code className="admin-anon-id">{row.userId}</code></td><td>{sourceLabel[row.source]}</td></tr>)}</tbody></table></div> : <p className="admin-empty">この条件での利用記録はまだありません。</p>}
        <div className="admin-pagination"><span role="status">{data.page} / {Math.max(1, Math.ceil(data.total / data.pageSize))}ページ</span><button className="button" disabled={data.page <= 1 || loading} onClick={() => setPage(data.page - 1)}><ChevronLeft aria-hidden="true" />前へ</button><button className="button" disabled={data.page * data.pageSize >= data.total || loading} onClick={() => setPage(data.page + 1)}>次へ<ChevronRight aria-hidden="true" /></button></div>
      </section>
    </>}
  </>;
}
