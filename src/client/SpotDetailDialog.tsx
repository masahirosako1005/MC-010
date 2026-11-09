import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Gift, LoaderCircle, X } from 'lucide-react';
import type { Spot } from '../shared/types';
import type { GiftClaim, SpotDetail } from '../shared/admin-types';
import { EXPERIENCE_CATEGORIES, spotSupportsExperienceCategory } from '../shared/experience-categories';
import './spot-details.css';

export function GiftBadge({ available }: { available?: boolean }) {
  return available ? <span className="gift-badge"><Gift aria-hidden="true" />プレゼントあり</span> : null;
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

export function SpotDetailDialog({ spot, photoUrl, comment, canClaim, onClose }: {
  spot: Spot; photoUrl?: string | null; comment?: string; canClaim: boolean; onClose: () => void;
}) {
  const [detail, setDetail] = useState<SpotDetail | null>(null), [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false), [confirm, setConfirm] = useState(false), [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const dialog = useRef<HTMLElement>(null), cancel = useRef<HTMLButtonElement>(null), heading = useRef<HTMLHeadingElement>(null);
  const state = useRef({ busy, confirm, onClose }); state.current = { busy, confirm, onClose };
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    request<SpotDetail>(`/api/spots/${encodeURIComponent(spot.id)}/detail`, { signal: controller.signal })
      .then(value => { if (!controller.signal.aborted) setDetail(value); })
      .catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : '詳細を読み込めませんでした。'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [spot.id, version]);
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

  async function claim() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const result = await request<{ giftClaim: GiftClaim }>(`/api/spots/${encodeURIComponent(spot.id)}/gift-claim`, { method: 'POST', body: '{}' });
      setDetail(current => current ? { ...current, giftClaim: result.giftClaim } : current); setConfirm(false);
    } catch (reason) { setError(reason instanceof Error ? reason.message : '受け取りを記録できませんでした。もう一度お試しください。'); }
    finally { setBusy(false); }
  }
  const current = detail?.spot ?? spot;
  return <div className="dialog-backdrop spot-detail-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section ref={dialog} tabIndex={-1} className="dialog spot-detail-dialog" role={confirm ? 'alertdialog' : 'dialog'} aria-modal="true" aria-labelledby="spot-detail-title" aria-describedby={confirm ? 'gift-confirm-warning' : undefined} aria-busy={busy || loading}>
      <button type="button" className="icon-button dialog-close" aria-label="スポット詳細を閉じる" disabled={busy} onClick={onClose}><X aria-hidden="true" /></button>
      {confirm ? <>
        <Gift className="gift-confirm-icon" aria-hidden="true" /><h2 id="spot-detail-title">プレゼントを受け取りますか？</h2>
        <p><strong>{current.name}</strong>のプレゼントの受け取りを記録します。</p>
        <p id="gift-confirm-warning" className="gift-confirm-warning">受け取ると、このスポットのプレゼントは再度受け取れません。</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="spot-detail-actions"><button ref={cancel} type="button" className="button" disabled={busy} onClick={() => { setConfirm(false); setError(''); }}>キャンセル</button><button type="button" className="button button-primary" aria-label="OK・プレゼントの受け取りを確定" disabled={busy} onClick={() => void claim()}>{busy ? <><LoaderCircle className="spin" aria-hidden="true" />記録中</> : 'OK'}</button></div>
      </> : <>
        <p className="eyebrow">スポット詳細</p><h2 ref={heading} tabIndex={-1} id="spot-detail-title">{current.name}</h2>
        <GiftBadge available={current.hasGift} />
        <img className="spot-detail-image" src={photoUrl || current.image} alt={`${current.name}の写真`} />
        <p className="spot-detail-description">{current.description}</p>
        <dl className="spot-detail-facts"><div><dt>分類</dt><dd>{current.category}</dd></div><div><dt>楽しみ方</dt><dd>{EXPERIENCE_CATEGORIES.filter(c => spotSupportsExperienceCategory(current, c.id)).map(c => c.label).join('・') || '—'}</dd></div><div><dt>おすすめの同行者</dt><dd>{current.companionTags.join('・')}</dd></div></dl>
        {comment && <section className="spot-detail-comment"><h3>パンフレットのコメント</h3><p>{comment}</p></section>}
        {loading && <p role="status"><LoaderCircle className="spin" aria-hidden="true" />最新情報を確認しています</p>}
        {error && <div><p className="form-error" role="alert">{error}</p><button type="button" className="button" onClick={() => setVersion(v => v + 1)}>最新情報を読み直す</button></div>}
        {canClaim && detail && <div className="spot-detail-gift">
          {detail.giftClaim ? <div className="gift-claimed" role="status"><CheckCircle2 aria-hidden="true" /><div><strong>プレゼント受取済み</strong><p>{when(detail.giftClaim.claimedAt)}</p><small>このスポットでは再度受け取れません。</small></div></div>
            : current.hasGift && <><p>このスポットではプレゼントを受け取れます。</p><button type="button" className="button button-primary gift-claim-button" disabled={loading || current.active === false} onClick={() => { setConfirm(true); setError(''); }}><Gift aria-hidden="true" />プレゼントを受け取る</button>{current.active === false && <p>現在、受け付けを停止しています。</p>}</>}
        </div>}
      </>}
    </section>
  </div>;
}
