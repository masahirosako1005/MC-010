import { ArrowLeft, ArrowRight, CalendarDays, Check, Coffee, Flag, Footprints, Landmark, Luggage, MapPin, Mountain, Ship, Stamp, Sun, TrainFront, UsersRound, Waves } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { COMPANIONS, type Brochure, type Companion, type Duration, type SessionData, type TripSettings, type TripStyle } from '../shared/types';
import './trip-settings.css';

interface Props {
  session: SessionData;
  brochure?: Brochure;
  previewBySpotId?: Record<string, string>;
  onGenerate: (settings: TripSettings, mode: 'all' | 'candidates') => Promise<void>;
  onCancel?: () => void;
  onLogout?: () => void;
  notice?: string;
  generatingView: ReactNode;
}

function WaveDivider({ ship = false }: { ship?: boolean }) {
  return <div className="trip-wave" aria-hidden="true">
    {ship && <Ship />}
    <svg viewBox="0 0 800 24" preserveAspectRatio="none"><path d="M0 14 Q20 6 40 14 T80 14 T120 14 T160 14 T200 14 T240 14 T280 14 T320 14 T360 14 T400 14 T440 14 T480 14 T520 14 T560 14 T600 14 T640 14 T680 14 T720 14 T760 14 T800 14" /></svg>
  </div>;
}

export function TripSettingsScreen({ session, brochure, previewBySpotId = {}, onGenerate, onCancel, onLogout, notice = '', generatingView }: Props) {
  const visited = useMemo(() => {
    const byId = new Map(session.spots.map(spot => [spot.id, spot]));
    const unique = new Map(session.visits.map(visit => [visit.spotId, byId.get(visit.spotId)]));
    return [...unique.values()].filter(spot => spot !== undefined);
  }, [session.spots, session.visits]);
  const [companion, setCompanion] = useState<Companion>(brochure?.companion ?? '友人');
  const [duration, setDuration] = useState<Duration>(brochure?.duration ?? 'day');
  const [tripStyle, setTripStyle] = useState<TripStyle>(brochure?.tripStyle ?? 'slow');
  const [visitedSpotIds, setVisitedSpotIds] = useState<string[]>(() => brochure
    ? brochure.items.filter(item => item.kind === 'visited' && item.selected).map(item => item.spotId)
    : session.visits[0] ? [session.visits[0].spotId] : []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (busy) return;
    if (error || notice) errorRef.current?.focus();
    else { headingRef.current?.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: 'instant' }); }
  }, [busy, error, notice]);
  useEffect(() => {
    if (!onCancel || busy) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); onCancel(); } };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [onCancel, busy]);

  async function submit(mode: 'all' | 'candidates') {
    if (busy) return;
    if (!visitedSpotIds.length) { setError('前回の旅から、もう一度訪れたい場所を1つ以上選んでください。'); return; }
    setError('');
    setBusy(true);
    try { await onGenerate({ companion, duration, tripStyle, visitedSpotIds }, mode); }
    catch (reason) {
      setError(reason instanceof Error ? reason.message : '作成できませんでした。選択内容は残っています。もう一度お試しください。');
      setBusy(false);
    }
  }

  if (busy) return <>{generatingView}</>;
  return <main className="trip-settings-page" data-testid="trip-settings-screen">
    <div className="trip-settings-paper">
      <header className="trip-settings-brand">
        <span className="trip-brand-name">今度はあなたと</span>
        <span className="trip-demo-badge"><TrainFront aria-hidden="true" />ローカルデモ</span>
      </header>
      <ol className="trip-progress" aria-label="パンフレット作成の手順">
        <li aria-current="step">内容を選ぶ</li><li>生成</li><li>パンフレット</li>
      </ol>
      {onCancel && <button type="button" className="trip-back" onClick={onCancel}><ArrowLeft aria-hidden="true" />パンフレットへ戻る</button>}
      <div className="trip-settings-title">
        <h1 ref={headingRef} tabIndex={-1}>旅の内容を選ぶ</h1>
        <span className="trip-stamp trip-stamp-coral" aria-hidden="true"><TrainFront /></span>
        <p>行きたい場所と旅の条件を選んでください</p>
      </div>
      <WaveDivider ship />
      <form onSubmit={event => { event.preventDefault(); void submit('all'); }}>
        <fieldset className="trip-section trip-visits">
          <legend className="trip-ribbon"><MapPin aria-hidden="true" /><span>前回のスタンプラリー</span></legend>
          <span className="trip-stamp trip-section-stamp" aria-hidden="true"><Landmark /></span>
          <div className="trip-visit-summary"><strong>訪問済み <b>{visited.length}</b>か所</strong><span>また行きたい場所を選択（複数選択）</span></div>
          <div className="trip-spot-list">
            {visited.map(spot => {
              const checked = visitedSpotIds.includes(spot.id);
              const hasStamp = session.visits.some(visit => visit.spotId === spot.id && visit.stamp);
              const savedPhoto = brochure?.items.find(item => item.spotId === spot.id)?.photoUrl;
              return <label key={spot.id} className={`trip-spot ${checked ? 'is-selected' : ''}`}>
                <input type="checkbox" checked={checked} onChange={() => {
                  const next = checked ? visitedSpotIds.filter(id => id !== spot.id) : [...visitedSpotIds, spot.id];
                  setVisitedSpotIds(next);
                  if (next.length) setError('');
                }} aria-label={spot.name} />
                <span className="trip-spot-photo"><MapPin aria-hidden="true" /><img src={previewBySpotId[spot.id] || savedPhoto || spot.image} alt="" onError={event => { event.currentTarget.hidden = true; }} /></span>
                <span className="trip-spot-copy"><strong>{spot.name}</strong><span className="trip-stamp-status"><Stamp aria-hidden="true" />{hasStamp ? 'スタンプ取得' : 'スタンプ未取得'}</span></span>
                <span className="trip-checkbox" aria-hidden="true">{checked && <Check />}</span>
              </label>;
            })}
          </div>
          <p className="trip-selection-count" role="status" aria-live="polite" aria-atomic="true"><b>{visitedSpotIds.length}</b>か所を選択中</p>
          <p className="trip-image-note">スポットの補足画像はデモ用イメージです</p>
        </fieldset>
        <WaveDivider />
        <fieldset className="trip-section">
          <legend className="trip-ribbon"><UsersRound aria-hidden="true" /><span>次は誰と行きたい？</span></legend>
          <span className="trip-stamp trip-section-stamp" aria-hidden="true"><Mountain /></span>
          <div className="trip-companion-grid">
            {COMPANIONS.map(value => <label className={`trip-companion ${companion === value ? 'is-selected' : ''}`} key={value}>
              <input type="radio" name="trip-companion" value={value} checked={companion === value} onChange={() => setCompanion(value)} />
              <span>{companion === value && <Check aria-hidden="true" />}{value}</span>
            </label>)}
          </div>
        </fieldset>
        <WaveDivider />
        <fieldset className="trip-section">
          <legend className="trip-ribbon"><CalendarDays aria-hidden="true" /><span>旅の日数は？</span></legend>
          <span className="trip-stamp trip-stamp-orange trip-section-stamp" aria-hidden="true"><Waves /></span>
          <div className="trip-two-options">
            <label className={`trip-large-choice ${duration === 'day' ? 'is-selected' : ''}`}>
              <input type="radio" name="trip-duration" value="day" checked={duration === 'day'} onChange={() => setDuration('day')} />
              <span className="trip-radio-mark" aria-hidden="true" /><Sun aria-hidden="true" /><strong>日帰り</strong>
            </label>
            <label className={`trip-large-choice ${duration === 'overnight' ? 'is-selected' : ''}`}>
              <input type="radio" name="trip-duration" value="overnight" checked={duration === 'overnight'} onChange={() => setDuration('overnight')} />
              <span className="trip-radio-mark" aria-hidden="true" /><Luggage aria-hidden="true" /><strong>宿泊<small>一泊二日</small></strong>
            </label>
          </div>
        </fieldset>
        <WaveDivider />
        <fieldset className="trip-section">
          <legend className="trip-ribbon"><Flag aria-hidden="true" /><span>テーマ（テンプレート指定）</span></legend>
          <div className="trip-two-options">
            <label className={`trip-large-choice trip-style-choice ${tripStyle === 'slow' ? 'is-selected' : ''}`}>
              <input type="radio" name="trip-style" value="slow" checked={tripStyle === 'slow'} onChange={() => setTripStyle('slow')} />
              <span className="trip-radio-mark" aria-hidden="true" /><Coffee aria-hidden="true" /><strong>ゆっくり</strong>
            </label>
            <label className={`trip-large-choice trip-style-choice ${tripStyle === 'active' ? 'is-selected' : ''}`}>
              <input type="radio" name="trip-style" value="active" checked={tripStyle === 'active'} onChange={() => setTripStyle('active')} />
              <span className="trip-radio-mark" aria-hidden="true" /><Footprints aria-hidden="true" /><strong>アクティブ</strong>
            </label>
          </div>
        </fieldset>
        {(error || notice) && <p ref={errorRef} tabIndex={-1} className="trip-form-error" role="alert">{error || notice}</p>}
        <button type="submit" className="trip-create">この内容でパンフレットを作る<ArrowRight aria-hidden="true" /></button>
        {brochure && <div className="trip-secondary-actions"><button type="button" onClick={onCancel}>キャンセルして戻る</button><button type="button" onClick={() => void submit('candidates')}>候補だけ作り直す</button></div>}
      </form>
      {!brochure && onLogout && <button type="button" className="trip-logout" onClick={onLogout}>ログアウト</button>}
    </div>
  </main>;
}
