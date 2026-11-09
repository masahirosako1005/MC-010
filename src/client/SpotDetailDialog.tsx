import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Gift, Ticket, LoaderCircle, X } from 'lucide-react';
import type { Spot } from '../shared/types';
import type { CouponDisplay, GiftClaim, SpotDetail } from '../shared/admin-types';
import { EXPERIENCE_CATEGORIES, spotSupportsExperienceCategory } from '../shared/experience-categories';
import './spot-details.css';

export function GiftBadge({ available }: { available?: boolean }) {
  return available ? <span className="gift-badge"><Gift aria-hidden="true" />クーポンあり</span> : null;
}

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, { credentials: 'same-origin', ...init, headers: {
    'Content-Type': 'application/json', ...(init.method ? { 'X-Requested-With': 'kondo' } : {}), ...init.headers,
  } });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error?.message ?? '通信できませんでした。もう一度お試しください。');
  return data as T;
}
const when = (value: string) => new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

export function SpotDetailDialog({ spot, photoUrl, comment, canClaim, readOnly = false, onClose }: {
  spot: Spot; photoUrl?: string | null; comment?: string; canClaim: boolean; readOnly?: boolean; onClose: () => void;
}) {
  const [detail, setDetail] = useState<SpotDetail | null>(null), [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false), [confirm, setConfirm] = useState(false), [error, setError] = useState('');
  const [couponCode, setCouponCode] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const dialog = useRef<HTMLElement>(null), cancel = useRef<HTMLButtonElement>(null), heading = useRef<HTMLHeadingElement>(null);
  const state = useRef({ busy, confirm, onClose }); state.current = { busy, confirm, onClose };
  useEffect(() => {
    if (readOnly) { setDetail({ spot, giftClaim: null }); setLoading(false); return; }
    const controller = new AbortController(); setLoading(true); setError('');
    request<SpotDetail>(`/api/spots/${encodeURIComponent(spot.id)}/detail`, { signal: controller.signal })
      .then(value => { if (!controller.signal.aborted) setDetail(value); })
      .catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : '詳細を読み込めませんでした。'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [spot, version, readOnly]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const controls = () => [...(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),[tabindex="0"]') ?? [])].filter(node => node.offsetParent !== null);
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); if (state.current.busy) return; if (state.current.confirm) setConfirm(false); else state.current.onClose(); }
      if (event.key !== 'Tab') return;
      const nodes = controls(), first = nodes[0], last = nodes.at(-1);
      if (!first || !last) { event.preventDefault(); dialog.current?.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || !dialog.current?.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !dialog.current?.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.removeEventListener('keydown', keydown); if (previous?.isConnected) previous.focus(); };
  }, []);
  useEffect(() => { if (confirm) cancel.current?.focus(); else heading.current?.focus(); }, [confirm]);

  async function showCoupon() {
    if (busy || !canClaim) return;
    setBusy(true); setError('');
    try {
      const result = await request<CouponDisplay>(`/api/spots/${encodeURIComponent(spot.id)}/coupon`, { method: 'POST', body: '{}' });
      setDetail(current => current ? { ...current, giftClaim: result.giftClaim } : current);
      setCouponCode(result.couponCode);
      if (!result.giftClaim && result.couponCode) setConfirm(true);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'クーポンを表示できませんでした。もう一度お試しください。'); }
    finally { setBusy(false); }
  }

  async function claim() {
    if (busy || !canClaim || !couponCode) return;
    setBusy(true); setError('');
    try {
      const result = await request<{ giftClaim: GiftClaim }>(`/api/spots/${encodeURIComponent(spot.id)}/gift-claim`, { method: 'POST', body: '{}' });
      setDetail(current => current ? { ...current, giftClaim: result.giftClaim } : current); setConfirm(false);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'クーポンの利用を記録できませんでした。もう一度お試しください。'); }
    finally { setBusy(false); }
  }
  const current = detail?.spot ?? spot;
  return <div className="dialog-backdrop spot-detail-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section ref={dialog} tabIndex={-1} className="dialog spot-detail-dialog" role={confirm ? 'alertdialog' : 'dialog'} aria-modal="true" aria-labelledby="spot-detail-title" aria-describedby={confirm ? 'gift-confirm-warning' : undefined} aria-busy={busy || loading}>
      <button type="button" className="icon-button dialog-close" aria-label="スポット詳細を閉じる" disabled={busy} onClick={onClose}><X aria-hidden="true" /></button>
      {confirm ? <>
        <Ticket className="gift-confirm-icon" aria-hidden="true" /><h2 id="spot-detail-title">クーポンをつかう</h2>
        <p><strong>{current.name}</strong>のクーポンです。「使う」を押すと利用を記録します。</p>
        <div className="coupon-code-card"><p id="coupon-code-label">クーポンコード（英数字6桁）</p><code aria-labelledby="coupon-code-label">{couponCode}</code></div>
        <p id="gift-confirm-warning" className="gift-confirm-warning">使うと、このスポットのクーポンは再度使えません。</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="spot-detail-actions"><button ref={cancel} type="button" className="button" disabled={busy} onClick={() => { setConfirm(false); setError(''); }}>キャンセル</button><button type="button" className="button button-primary" aria-label="クーポンを使う" disabled={busy || !couponCode} onClick={() => void claim()}>{busy ? <><LoaderCircle className="spin" aria-hidden="true" />記録中</> : '使う'}</button></div>
      </> : <>
        <p className="eyebrow">スポット詳細</p><h2 ref={heading} tabIndex={-1} id="spot-detail-title">{current.name}</h2>
        <GiftBadge available={canClaim && current.hasGift} />
        <img className="spot-detail-image" src={photoUrl || current.image} alt={`${current.name}の写真`} />
        <p className="spot-detail-description">{current.description}</p>
        <dl className="spot-detail-facts"><div><dt>分類</dt><dd>{current.category}</dd></div><div><dt>楽しみ方</dt><dd>{EXPERIENCE_CATEGORIES.filter(c => spotSupportsExperienceCategory(current, c.id)).map(c => c.label).join('・') || '—'}</dd></div><div><dt>おすすめの同行者</dt><dd>{current.companionTags.join('・')}</dd></div></dl>
        {comment && <section className="spot-detail-comment"><h3>パンフレットのコメント</h3><p>{comment}</p></section>}
        {loading && <p role="status"><LoaderCircle className="spin" aria-hidden="true" />最新情報を確認しています</p>}
        {error && <div><p className="form-error" role="alert">{error}</p><button type="button" className="button" onClick={() => setVersion(v => v + 1)}>最新情報を読み直す</button></div>}
        {canClaim && detail && <div className="spot-detail-gift">
          {detail.giftClaim ? <div className="gift-claimed" role="status"><CheckCircle2 aria-hidden="true" /><div><strong>クーポン使用済み</strong><p>{when(detail.giftClaim.claimedAt)}</p><small>このスポットでは再度使えません。</small></div></div>
            : current.hasGift && <><p>このスポットではクーポンを利用できます。</p><button type="button" className="button button-primary gift-claim-button" disabled={loading || busy || current.active === false} onClick={() => void showCoupon()}>{busy ? <LoaderCircle className="spin" aria-hidden="true" /> : <Ticket aria-hidden="true" />}{busy ? 'クーポンを表示中' : 'クーポンを表示する'}</button>{current.active === false && <p>現在、受け付けを停止しています。</p>}</>}
        </div>}
      </>}
    </section>
  </div>;
}
