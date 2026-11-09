import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Check, CircleAlert, Copy, Eye, EyeOff, KeyRound, LoaderCircle, Plug, RefreshCw, ShieldCheck, Trash2, X } from 'lucide-react';
import { MCP_QUESTIONS, MCP_TOOLS, type McpSettings, type IssuedMcpKey } from '../shared/mcp-types';

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, { credentials: 'same-origin', ...init, headers: {
    'Content-Type': 'application/json', ...(init.method ? { 'X-Requested-With': 'kondo' } : {}), ...init.headers,
  } });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error?.message ?? '接続設定を取得できませんでした。再試行してください。');
  return body as T;
}
const date = (value: string | null) => value ? new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '未接続';

export function AdminMcp({ onBusy }: { onBusy: (busy: boolean) => void }) {
  const [settings, setSettings] = useState<McpSettings | null>(null), [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [message, setMessage] = useState('');
  const [label, setLabel] = useState('ChatGPTでの分析'), [days, setDays] = useState(30), [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<IssuedMcpKey | null>(null), [visible, setVisible] = useState(false);
  const issuedRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    request<McpSettings>('/api/admin/mcp/keys', { signal: controller.signal }).then(data => {
      if (!controller.signal.aborted) setSettings(data);
    }).catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : '読み込めませんでした。'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [version]);
  useEffect(() => { if (issued) issuedRef.current?.focus(); }, [issued]);
  const activeKeys = settings?.keys.filter(key => !key.revokedAt && Date.parse(key.expiresAt) > Date.now()).length ?? 0;
  function saving(value: boolean) { setBusy(value); onBusy(value); }
  async function create(event: FormEvent) {
    event.preventDefault();
    if (busy || issued) return;
    saving(true); setError(''); setMessage('');
    try {
      const result = await request<IssuedMcpKey>('/api/admin/mcp/keys', { method: 'POST', body: JSON.stringify({ label, days }) });
      setIssued(result); setVisible(false);
      setSettings(current => current ? { ...current, keys: [result.key, ...current.keys].slice(0, 30) } : current);
      setMessage('接続キーを発行しました。ChatGPTの接続設定へ登録してください。');
    } catch (reason) { setError(reason instanceof Error ? reason.message : '発行に失敗しました。'); }
    finally { saving(false); }
  }
  async function revoke(id: string) {
    if (busy || !window.confirm('このキーの接続を失効しますか？ このキーを登録した分析ツールから接続できなくなります。')) return;
    saving(true); setError(''); setMessage('');
    try {
      await request(`/api/admin/mcp/keys/${id}`, { method: 'DELETE', body: '{}' });
      if (issued?.key.id === id) setIssued(null);
      setSettings(current => current ? { ...current, keys: current.keys.map(key => key.id === id ? { ...key, revokedAt: new Date().toISOString() } : key) } : current);
      setMessage('接続キーを失効しました。');
    } catch (reason) { setError(reason instanceof Error ? reason.message : '失効に失敗しました。'); }
    finally { saving(false); }
  }
  async function copy(value: string, success: string) {
    try { await navigator.clipboard.writeText(value); setMessage(success); }
    catch { setMessage('コピーできませんでした。欄の文字を選択して手動でコピーしてください。'); }
  }
  const endpoint = settings?.endpoint ?? '';
  // The example contains an environment variable name, never the issued credential.
  const config = `[mcp_servers.kondo_town]\nurl = ${JSON.stringify(endpoint)}\nbearer_token_env_var = "KONDO_TOWN_MCP_TOKEN"`;
  return <>
    <div className="admin-section-intro"><p>ChatGPTから町の集計データを取得し、観光施策の検討に使えます。</p>
      <span className="admin-mcp-readonly"><ShieldCheck aria-hidden="true" />読み取り専用</span></div>
    {error && <div className="admin-error" role="alert"><CircleAlert aria-hidden="true" /><span>{error}</span><button className="button" disabled={busy || loading} onClick={() => setVersion(value => value + 1)}>接続設定を再読込</button></div>}
    <p className="admin-mcp-message" role="status" aria-live="polite">{message}</p>
    {loading && <div className="admin-load" role="status"><LoaderCircle className="spin" aria-hidden="true" />接続設定を読み込んでいます</div>}
    {settings && <>
      <section className="admin-panel admin-mcp-connection" aria-labelledby="mcp-connection-heading">
        <h2 id="mcp-connection-heading"><Plug aria-hidden="true" />ChatGPTにつなぐ</h2>
        <p className="admin-description">同じ端末のChatGPTデスクトップで、設定 → MCP servers → Add serverから登録します。</p>
        <ol className="admin-mcp-steps">
          <li><strong>この画面で接続キーを発行</strong><span>接続名と有効期間を選びます。キーを表示できるのは発行直後だけです。</span></li>
          <li><strong>Streamable HTTPを選択して登録</strong><span>下のURLと、発行したキーをBearerトークンとして設定します。アプリは起動したままにします。</span></li>
          <li><strong>ChatGPTを再起動して分析</strong><span>接続を有効にし、利用できるツールを確認してから、下の質問例を入力します。</span></li>
        </ol>
        <div className="admin-mcp-field"><label htmlFor="admin-mcp-url">接続URL</label><div className="admin-mcp-copy-row"><input id="admin-mcp-url" readOnly value={endpoint} onFocus={event => event.target.select()} /><button className="button" onClick={() => void copy(endpoint, '接続URLをコピーしました。')}><Copy aria-hidden="true" />コピー</button></div></div>
        <p className="admin-muted">集計結果は接続したChatGPTへ渡ります。メール・氏名・自由回答・コメント本文・写真はMCPへ返しません。少人数の集計からの推測可能性は残ります。</p>
        <details className="admin-mcp-details"><summary>設定ファイルで登録する場合</summary><p className="admin-muted">ChatGPTデスクトップと同じホストのconfig.tomlに以下を追加し、環境変数KONDO_TOWN_MCP_TOKENへ発行キーを設定してからChatGPTを再起動します。キーをチャットへ貼り付ける必要はありません。</p><pre tabIndex={0} aria-label="MCPの設定例">{config}</pre><button className="button" onClick={() => void copy(config, 'キーを含まない設定例をコピーしました。')}><Copy aria-hidden="true" />設定例をコピー</button></details>
        <p className="admin-muted">ChatGPT Web版の接続には、対応するトンネルなど別の接続経路と設定が必要です。このURLは同じ端末専用です。<a href="https://learn.chatgpt.com/docs/extend/mcp" target="_blank" rel="noreferrer">公式の接続手順</a></p>
      </section>
      <section className="admin-panel" aria-labelledby="mcp-create-heading">
        <h2 id="mcp-create-heading">接続キーを発行</h2>
        <p className="admin-muted">この町管理アカウントのキーを発行します。有効なキーは{settings.maxActiveKeys}件まで。現在{activeKeys}件です。</p>
        <form className="admin-mcp-form" onSubmit={event => void create(event)}>
          <label>接続名<input required maxLength={60} value={label} disabled={busy || Boolean(issued)} onChange={event => setLabel(event.target.value)} autoComplete="off" /></label>
          <label>有効期間<select value={days} disabled={busy || Boolean(issued)} onChange={event => setDays(Number(event.target.value))}><option value={7}>7日間</option><option value={30}>30日間</option><option value={90}>90日間</option></select></label>
          <button className="button button-primary" disabled={busy || loading || Boolean(issued) || !label.trim() || activeKeys >= settings.maxActiveKeys}>{busy ? <LoaderCircle className="spin" aria-hidden="true" /> : <KeyRound aria-hidden="true" />}接続キーを発行</button>
        </form>
        {issued && <div className="admin-mcp-issued">
          <h3 ref={issuedRef} tabIndex={-1}><Check aria-hidden="true" />接続キーを発行しました</h3>
          <p>この画面を離れる・再読み込みする・表示を閉じると、同じキーは再表示できません。先に接続先へ登録してください。</p>
          <label className="admin-mcp-field">発行した接続キー<input type={visible ? 'text' : 'password'} readOnly value={issued.token} autoComplete="off" spellCheck={false} onFocus={event => event.target.select()} /></label>
          <div className="admin-mcp-actions"><button className="button button-primary" onClick={() => void copy(issued.token, '接続キーをコピーしました。接続先のBearerトークン欄へ登録してください。')}><Copy aria-hidden="true" />キーをコピー</button>
            <button className="button" aria-pressed={visible} onClick={() => setVisible(value => !value)}>{visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}{visible ? 'キーを隠す' : 'キーを表示'}</button>
            <button className="button" onClick={() => { setIssued(null); setVisible(false); setMessage('キーの表示を閉じました。'); }}><X aria-hidden="true" />表示を閉じる</button></div>
        </div>}
      </section>
      <section className="admin-panel admin-table-panel" aria-labelledby="mcp-keys-heading">
        <div className="admin-table-heading"><h2 id="mcp-keys-heading">自分の接続キー</h2><button className="button" disabled={busy || loading} onClick={() => setVersion(value => value + 1)}><RefreshCw aria-hidden="true" />更新</button></div>
        {settings.keys.length ? <div className="admin-table-scroll" role="region" aria-label="接続キー一覧（横にスクロールできます）" tabIndex={0}><table className="admin-table"><thead><tr><th scope="col">接続名</th><th scope="col">状態</th><th scope="col">発行日時</th><th scope="col">有効期限</th><th scope="col">最終接続</th><th scope="col">操作</th></tr></thead><tbody>{settings.keys.map(key => {
          const active = !key.revokedAt && Date.parse(key.expiresAt) > Date.now();
          return <tr key={key.id}><th scope="row" className="admin-mcp-key-label">{key.label}</th><td><span className={`admin-badge ${active ? 'is-active' : ''}`}>{key.revokedAt ? '失効済み' : active ? '有効' : '期限切れ'}</span></td><td>{date(key.createdAt)}</td><td>{date(key.expiresAt)}</td><td>{date(key.lastUsedAt)}</td><td><button className="button button-outline" disabled={busy || !active} aria-label={`${key.label}のキーを失効`} onClick={() => void revoke(key.id)}><Trash2 aria-hidden="true" />失効</button></td></tr>;
        })}</tbody></table></div> : <p className="admin-empty">まだ接続キーはありません。上のフォームから発行できます。</p>}
        <p className="admin-muted admin-mcp-table-note">有効なキーを優先して直近30件を表示します。失効と期限切れは有効件数に含みません。最終接続は有効なキーで要求を受けた日時です。</p>
      </section>
    </>}
    <section className="admin-panel" aria-labelledby="mcp-tools-heading"><h2 id="mcp-tools-heading">分析できること</h2><p className="admin-muted">提供データが既定です。「デモデータ」「すべて」も指定できます。期間を指定できるツールは、指定がなければ直近30日、日本時間で集計します。</p>
      <dl className="admin-mcp-tools">{MCP_TOOLS.map(tool => <div key={tool.name}><dt>{tool.title}<code>{tool.name}</code></dt><dd>{tool.description}</dd></div>)}</dl>
      <p className="admin-muted">CSV訪問・クーポン利用申告・共有ページ表示は別の指標です。集計データの取得だけを行い、スポットや利用者の編集はできません。</p>
    </section>
    <section className="admin-panel" aria-labelledby="mcp-questions-heading"><h2 id="mcp-questions-heading">ChatGPTへの質問例</h2><div className="admin-mcp-questions">{MCP_QUESTIONS.map(question => <div key={question}><p>{question}</p><button className="button" aria-label={`質問例「${question}」をコピー`} onClick={() => void copy(question, '質問例をコピーしました。')}><Copy aria-hidden="true" />コピー</button></div>)}</div></section>
  </>;
}
