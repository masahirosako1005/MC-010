import { useEffect, useState } from 'react';
import { Heart, LoaderCircle } from 'lucide-react';
import type { SharedSpotLike, SharedSpotLikes } from '../shared/sharing-types';
import { shareRequest } from './sharing-api';

export function useSharedSpotLikes(token: string | undefined, enabled: boolean) {
  const [spots, setSpots] = useState<SharedSpotLike[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [errorSpot, setErrorSpot] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    setSpots(null); setError(''); setErrorSpot(null);
    if (!enabled || !token) return;
    const controller = new AbortController();
    shareRequest<SharedSpotLikes>(`/api/shared/${token}/likes`, { signal: controller.signal })
      .then(value => { if (!controller.signal.aborted) setSpots(value.spots); })
      .catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'いいねを読み込めませんでした。'); });
    return () => controller.abort();
  }, [token, enabled, version]);

  async function toggle(spotId: string) {
    const current = spots?.find(spot => spot.spotId === spotId);
    if (!token || !current || busy) return;
    setBusy(spotId); setError(''); setErrorSpot(null);
    try {
      const result = await shareRequest<SharedSpotLikes>(`/api/shared/${token}/spots/${spotId}/like`, {
        method: 'PUT', body: JSON.stringify({ liked: !current.liked }),
      });
      setSpots(result.spots);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'いいねを保存できませんでした。');
      setErrorSpot(spotId);
    } finally { setBusy(null); }
  }
  return { spots, busy, error, errorSpot, toggle, reload: () => setVersion(value => value + 1) };
}

export function SharedSpotLikeButton({ spotId, spotName, actions }: {
  spotId: string; spotName: string; actions: ReturnType<typeof useSharedSpotLikes>;
}) {
  const state = actions.spots?.find(spot => spot.spotId === spotId);
  const noLongerListed = actions.spots !== null && !state;
  const error = actions.error && (!actions.errorSpot || actions.errorSpot === spotId) ? actions.error : '';
  return <>
    <button type="button" className="spot-like-button" aria-label={`${spotName}にいいね`}
      aria-pressed={state?.liked ?? false} title={state?.liked ? 'いいねを取り消す' : 'いいね'}
      disabled={!state || actions.busy !== null} onClick={() => void actions.toggle(spotId)}>
      {actions.busy === spotId || (actions.spots === null && !error) ? <LoaderCircle className="spin" aria-hidden="true" /> : <Heart aria-hidden="true" />}
      <span aria-live="polite">{state ? state.count : '—'}</span>
    </button>
    {noLongerListed && <div className="spot-like-error"><p role="status">掲載内容が更新されました。</p>
      <button type="button" className="spot-like-retry" onClick={() => window.location.reload()}>しおりを再読み込み</button>
    </div>}
    {error && <div className="spot-like-error"><p role="alert">{error}</p>
      <button type="button" className="spot-like-retry" onClick={state ? () => void actions.toggle(spotId) : actions.reload}>再試行</button>
    </div>}
  </>;
}
