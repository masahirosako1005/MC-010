import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Eye, MailOpen, RefreshCw, Smartphone } from 'lucide-react';
import type { SharedBrochure } from '../shared/sharing-types';
import { getSharedPageToken, isMobileDemoContentPath, MOBILE_APP_PATH } from '../shared/mobile-demo';
import { BrochurePaper } from './App';
import { SpotDetailDialog } from './SpotDetailDialog';
import { shareRequest } from './sharing-api';
import { SharedSpotLikeButton, useSharedSpotLikes } from './SharedSpotLikes';
import './sharing.css';

export function SharedPage() {
  const token = getSharedPageToken(window.location.pathname);
  const mobileFrame = isMobileDemoContentPath(window.location.pathname);
  const [data, setData] = useState<SharedBrochure | null>(null), [error, setError] = useState('');
  const [version, setVersion] = useState(0), [detailId, setDetailId] = useState<string | null>(null);
  const [requestId] = useState(() => crypto.randomUUID());
  const [invitationFinished, setInvitationFinished] = useState(false);
  const contentRef = useRef<HTMLElement>(null);
  const showInvitation = !error && (!invitationFinished || !data);
  const likes = useSharedSpotLikes(token, Boolean(data) && !showInvitation);
  useEffect(() => {
    setInvitationFinished(false);
    const timer = setTimeout(() => setInvitationFinished(true), 2200);
    return () => clearTimeout(timer);
  }, [token]);
  useEffect(() => {
    if (!showInvitation && data) contentRef.current?.focus({ preventScroll: true });
  }, [showInvitation, data]);
  useEffect(() => {
    if (!token) { setError('共有URLが正しくありません。'); return; }
    const controller = new AbortController(); setError(''); setData(null);
    shareRequest<SharedBrochure>(`/api/shared/${token}`, { signal: controller.signal })
      .then(value => { if (!controller.signal.aborted) setData(value); })
      .catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : '共有パンフレットを読み込めませんでした。'); });
    return () => controller.abort();
  }, [token, version]);
  useEffect(() => {
    if (!data || !token || showInvitation) return;
    let active = true, retry: ReturnType<typeof setTimeout> | undefined;
    const record = async (attempt: number) => {
      try { await shareRequest(`/api/shared/${token}/views`, { method: 'POST', body: JSON.stringify({ requestId }) }); }
      catch { if (active && attempt === 0) retry = setTimeout(() => void record(1), 1000); }
    };
    void record(0);
    return () => { active = false; if (retry) clearTimeout(retry); };
  }, [data, token, requestId, showInvitation]);
  const spot = data?.spots.find(value => value.id === detailId);
  const item = data?.brochure.items.find(value => value.spotId === detailId);
  const homeHref = window.location.pathname.startsWith('/demo/mobile/') ? '/demo/mobile/app' : '/';
  if (showInvitation) return <main className="shared-invitation">
    <section className="shared-invitation-card" aria-labelledby="shared-invitation-title">
      <a className="shared-invitation-brand" href={homeHref}>今度はあなたと</a>
      <div className="shared-invitation-envelope" aria-hidden="true"><MailOpen /></div>
      <h1 id="shared-invitation-title"><span>あなたに</span><span>旅の案内が届いてます</span></h1>
      <p role="status">{data ? 'まもなく旅のしおりを開きます。' : '旅のしおりを準備しています。'}</p>
      <button type="button" className="button button-primary shared-invitation-open" disabled={!data}
        onClick={() => setInvitationFinished(true)}>しおりを開く<ArrowRight aria-hidden="true" /></button>
    </section>
  </main>;
  return <div className="app-shell preview-mode shared-page">
    <header className="preview-toolbar">
      <a className="preview-toolbar-title shared-page-home" href={homeHref} aria-label="今度はあなたと トップページへ"><Eye aria-hidden="true" /><span><strong>共有パンフレット</strong><small>今度はあなたと</small></span></a>
      <div className="shared-page-actions">
        {!mobileFrame && token && <a className="button button-outline" href={`/share/${token}?view=mobile`}><Smartphone aria-hidden="true" />スマホ表示</a>}
        {data?.viewerIsOwner && <a className="button button-outline" href={mobileFrame ? MOBILE_APP_PATH : '/'}>編集画面へ</a>}
      </div>
    </header>
    {error ? <main className="shared-page-state"><h1>パンフレットを表示できませんでした</h1><p role="alert">{error}</p>{token && <button className="button" onClick={() => setVersion(value => value + 1)}><RefreshCw aria-hidden="true" />再試行</button>}</main>
      : !data ? <main className="shared-page-state" role="status">共有パンフレットを読み込んでいます</main>
      : <main className="editor-main" ref={contentRef} tabIndex={-1}><BrochurePaper draft={data.brochure} spots={data.spots} visits={data.memoryVisits} survey={null} onOpen={setDetailId}
        renderSpotAction={spot => <SharedSpotLikeButton spotId={spot.id} spotName={spot.name} actions={likes} />} /></main>}
    {spot && data && <SpotDetailDialog key={spot.id} spot={spot} photoUrl={item?.photoUrl} comment={item?.comment} canClaim={data.viewerIsOwner} readOnly={!data.viewerIsOwner} onClose={() => setDetailId(null)} />}
  </div>;
}
