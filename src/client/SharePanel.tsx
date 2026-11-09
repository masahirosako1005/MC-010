import { Clipboard, Eye, LoaderCircle, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ShareSettings } from '../shared/sharing-types';
import { shareRequest } from './sharing-api';
import './sharing.css';

export function SharePanel({ canPublish }: { canPublish: boolean }) {
  const [share, setShare] = useState<ShareSettings | null>(null), [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    shareRequest<{ share: ShareSettings | null }>('/api/brochure/share', { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setShare(result.share); })
      .catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : '共有情報を読み込めませんでした。'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [version]);
  const url = share ? new URL(share.path, window.location.origin).href : '';
  async function copyUrl() {
    if (busy || !canPublish) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await shareRequest<{ share: ShareSettings }>('/api/brochure/share', { method: 'POST', body: '{}' });
      setShare(result.share);
      try {
        await navigator.clipboard.writeText(new URL(result.share.path, window.location.origin).href);
        setNotice('シェア用URLをコピーしました。');
      } catch { setNotice('URLを発行しました。下の欄から選択してコピーしてください。'); }
    } catch (reason) { setError(reason instanceof Error ? reason.message : '共有URLを発行できませんでした。'); }
    finally { setBusy(false); }
  }
  async function stopSharing() {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await shareRequest<{ share: ShareSettings | null }>('/api/brochure/share', { method: 'DELETE', body: '{}' });
      setShare(result.share); setNotice('共有URLの公開を停止しました。');
    } catch (reason) { setError(reason instanceof Error ? reason.message : '公開を停止できませんでした。'); }
    finally { setBusy(false); }
  }
  return <section className="share-panel" aria-labelledby="share-panel-title" aria-busy={busy || loading}>
    <div className="share-panel-heading"><div><h2 id="share-panel-title">シェア用URL</h2><p>保存済みの掲載内容・思い出・写真・コメントを共有します。保存後の変更も同じURLに反映されます。</p><p>クーポンは作成者本人のログイン時だけ表示されます。</p></div>
      <button className="button button-primary" disabled={busy || loading || !canPublish} onClick={() => void copyUrl()}>{busy ? <LoaderCircle className="spin" aria-hidden="true" /> : <Clipboard aria-hidden="true" />}{share && !share.active ? '公開を再開してURLをコピー' : 'シェア用URLをコピー'}</button></div>
    {!canPublish && <p className="share-notice">未保存の変更や未完了の写真があります。編集画面で保存を完了してからURLをコピーしてください。</p>}
    {loading ? <p role="status">共有情報を確認しています</p> : <div className="share-panel-metrics"><span><Eye aria-hidden="true" />表示回数 <strong>{error ? '—' : (share?.viewCount ?? 0).toLocaleString('ja-JP')}</strong>回</span><small>共有ページの再読み込みも含みます。作者のプレビューは加算しません。</small><button className="button" disabled={busy} onClick={() => setVersion(value => value + 1)}><RefreshCw aria-hidden="true" />件数を更新</button></div>}
    {share && <><label className="share-url-field">共有URL（{share.active ? '公開中' : '公開停止中'}）<input readOnly value={url} onFocus={event => event.currentTarget.select()} /></label>{share.active && <button className="button button-outline" disabled={busy || loading} onClick={() => void stopSharing()}>公開を停止する</button>}</>}
    {notice && <p role="status" className="share-notice">{notice}</p>}{error && <p role="alert" className="form-error">{error}</p>}
  </section>;
}
