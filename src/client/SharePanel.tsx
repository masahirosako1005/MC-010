import { ExternalLink, Eye, LoaderCircle, RefreshCw, Send } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ShareSettings } from '../shared/sharing-types';
import type { Companion } from '../shared/types';
import { isMobileDemoContentPath } from '../shared/mobile-demo';
import { shareRequest } from './sharing-api';
import './sharing.css';

export function SharePanel({ canPublish, companion }: { canPublish: boolean; companion: Companion }) {
  const [share, setShare] = useState<ShareSettings | null>(null), [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [version, setVersion] = useState(0);
  const pendingCopies = useRef<Array<{ requestId: string; shareId: string }>>([]), recordingRef = useRef(false);
  const [unrecordedCopies, setUnrecordedCopies] = useState(0), [recording, setRecording] = useState(false);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    shareRequest<{ share: ShareSettings | null }>('/api/brochure/share', { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setShare(result.share); })
      .catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : '共有情報を読み込めませんでした。'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [version]);
  const inviteLabel = companion === '一人' ? 'しおりを共有する' : `${companion}を誘う`;
  function publicUrl(path: string) {
    const url = new URL(path, window.location.origin);
    if (isMobileDemoContentPath(window.location.pathname)) url.searchParams.set('view', 'mobile');
    return url.href;
  }
  async function recordCopies() {
    if (recordingRef.current || !pendingCopies.current.length) return;
    recordingRef.current = true; setRecording(true);
    try {
      while (pendingCopies.current.length) {
        const event = pendingCopies.current[0]!;
        let saved = false;
        for (let attempt = 0; attempt < 2 && !saved; attempt++) {
          try {
            await shareRequest('/api/brochure/share/copies', { method: 'POST', body: JSON.stringify(event), signal: AbortSignal.timeout(5000) });
            saved = true;
          } catch { /* 同じ操作IDで再送し、応答消失後も二重加算しない。 */ }
        }
        if (!saved) break;
        pendingCopies.current.shift();
      }
    } finally {
      setUnrecordedCopies(pendingCopies.current.length); recordingRef.current = false; setRecording(false);
    }
  }
  async function copyUrl() {
    if (busy || !canPublish) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await shareRequest<{ share: ShareSettings }>('/api/brochure/share', { method: 'POST', body: '{}' });
      setShare(result.share);
      const url = publicUrl(result.share.path);
      try {
        await navigator.clipboard.writeText(url);
        setNotice(companion === '一人' ? 'しおりの共有URLをコピーしました。' : `${companion}を誘うURLをコピーしました。`);
      } catch {
        window.prompt('共有URLを選択してコピーしてください。', url);
        setNotice('共有URLを発行しました。');
        return;
      }
      pendingCopies.current.push({ requestId: crypto.randomUUID(), shareId: result.share.id });
      void recordCopies();
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
    <div className="share-panel-heading"><h2 id="share-panel-title">{companion === '一人' ? 'しおりを共有する' : 'この旅に誘う'}</h2>
      <button className="button button-primary" disabled={busy || loading || !canPublish} onClick={() => void copyUrl()}>{busy ? <LoaderCircle className="spin" aria-hidden="true" /> : <Send aria-hidden="true" />}{inviteLabel}</button></div>
    {!canPublish && <p className="share-notice">未保存の変更や未完了の写真があります。編集画面で保存を完了してから共有してください。</p>}
    {loading ? <p role="status">共有情報を確認しています</p> : <div className="share-panel-metrics"><span><Eye aria-hidden="true" />表示回数 <strong>{error ? '—' : (share?.viewCount ?? 0).toLocaleString('ja-JP')}</strong>回</span><small>共有ページの再読み込みも含みます。作者のプレビューは加算しません。</small><button className="button" disabled={busy} onClick={() => setVersion(value => value + 1)}><RefreshCw aria-hidden="true" />件数を更新</button></div>}
    {share?.active && <div className="share-panel-actions">
      {!loading && <a className="button button-outline" href={publicUrl(share.path)} target="_blank" rel="noopener noreferrer" aria-label="公開ページを開く（新しいタブ）"><ExternalLink aria-hidden="true" />ページを開く</a>}
      <button className="button button-outline" disabled={busy || loading} onClick={() => void stopSharing()}>公開を停止する</button>
    </div>}
    {notice && <p role="status" className="share-notice">{notice}</p>}{error && <p role="alert" className="form-error">{error}</p>}
    {unrecordedCopies > 0 && <div className="share-notice" role="status"><p>URLはコピーできましたが、{unrecordedCopies}回分のコピー記録が未完了です。</p><button className="button button-outline" disabled={recording} onClick={() => void recordCopies()}>{recording ? '記録しています' : 'コピー記録を再送する'}</button></div>}
  </section>;
}
