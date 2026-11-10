import {
  ArrowDown,
  ArrowUp,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Eye,
  Image as ImageIcon,
  Leaf,
  LoaderCircle,
  LogOut,
  Map as MapIcon,
  MapPin,
  PencilLine,
  RefreshCw,
  RotateCcw,
  Save,
  ShoppingBag,
  Sparkles,
  Stamp,
  Trash2,
  Utensils,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';
import {
  type Brochure,
  type BrochureItem,
  type SavePayload,
  type SessionData,
  type Spot,
  type Template,
  type Visit,
} from '../shared/types';
import {
  assignPickupCategories,
  EXPERIENCE_CATEGORIES,
  experienceCategoryLabel,
  spotSupportsExperienceCategory,
  type ExperienceCategory,
} from '../shared/experience-categories';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TripSettingsScreen } from './TripSettingsScreen';
import { AdminDashboard } from './AdminDashboard';
import { GiftBadge, SpotDetailDialog } from './SpotDetailDialog';
import { SharePanel } from './SharePanel';
import { spotListDescription, spotOverview, spotRecommendation } from '../shared/spot-copy';
import { mergeBrochureEdits } from '../shared/brochure-merge';

type Screen = 'checking' | 'login' | 'settings' | 'brochure' | 'no-history' | 'admin';
type SaveState = 'clean' | 'dirty' | 'saving' | 'saved' | 'error';

class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const mutating = Boolean(init?.method && !['GET', 'HEAD'].includes(init.method.toUpperCase()));
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...init,
    headers: init?.body instanceof FormData
      ? { ...(mutating ? { 'X-Requested-With': 'kondo' } : {}), ...init.headers }
      : { 'Content-Type': 'application/json', ...(mutating ? { 'X-Requested-With': 'kondo' } : {}), ...init?.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { code?: string; message?: string } } | null;
    throw new ApiError(
      response.status,
      body?.error?.code ?? 'UNKNOWN_ERROR',
      body?.error?.message ?? '処理に失敗しました。もう一度お試しください。',
    );
  }
  return response.json() as Promise<T>;
}

const GENERATING_SCREEN_MINIMUM_MS = 3_000;

async function withGeneratingScreenDuration<T>(operation: Promise<T>): Promise<T> {
  const settled = operation.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );
  const delay = new Promise<void>((resolve) => window.setTimeout(resolve, GENERATING_SCREEN_MINIMUM_MS));
  const [outcome] = await Promise.all([settled, delay]);
  if (!outcome.ok) throw outcome.error;
  return outcome.value;
}

function brochurePayload(brochure: Brochure): SavePayload {
  return {
    revision: brochure.revision,
    companion: brochure.companion,
    duration: brochure.duration,
    tripStyle: brochure.tripStyle,
    template: brochure.template,
    items: brochure.items.map(({ id, selected, isMemory, order, comment, pickupCategory }) => ({
      id,
      selected,
      isMemory,
      order,
      comment,
      pickupCategory,
    })),
  };
}

function normalizeBrochureCategories(brochure: Brochure, spots: Spot[]): Brochure {
  return { ...brochure, items: assignPickupCategories(brochure, spots) };
}

function categoryAssignmentsChanged(before: Brochure, after: Brochure): boolean {
  return before.items.some((item) => {
    const next = after.items.find((entry) => entry.id === item.id);
    return !next || item.selected !== next.selected || item.order !== next.order || item.pickupCategory !== next.pickupCategory;
  });
}

function payloadSignature(brochure: Brochure) {
  return JSON.stringify({ ...brochurePayload(brochure), revision: 0 });
}

function draftSignature(brochure: Brochure) {
  return JSON.stringify({ ...brochure, revision: 0, updatedAt: '' });
}

function codePointLength(value: string) {
  return Array.from(value).length;
}

function limitComment(value: string) {
  return Array.from(value).slice(0, 200).join('');
}

function formatError(error: unknown) {
  if (error instanceof ApiError) return error.message;
  return '通信できませんでした。入力はこの画面に残っています。接続を確認して再試行してください。';
}

function useDialogFocus(onClose: () => void, canClose = true) {
  const ref = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  const canCloseRef = useRef(canClose);
  closeRef.current = onClose;
  canCloseRef.current = canClose;
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    if (!dialog) return;
    const controls = () => Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]')).filter(el => el.offsetParent !== null);
    (controls()[0] ?? dialog).focus();
    function keydown(event: KeyboardEvent) {
      if (event.key === 'Escape' && canCloseRef.current) { event.preventDefault(); closeRef.current(); }
      if (event.key !== 'Tab') return;
      const nodes = controls(), first = nodes[0], last = nodes[nodes.length - 1];
      if (!first || !last) { event.preventDefault(); dialog!.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || !dialog!.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !dialog!.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', keydown);
    return () => { document.removeEventListener('keydown', keydown); if (previous?.isConnected) previous.focus(); };
  }, []);
  return ref;
}

function formatVisitDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: 'long', day: 'numeric',
  }).format(date);
}

export function App() {
  const [screen, setScreen] = useState<Screen>('checking');
  const [session, setSession] = useState<SessionData | null>(null);
  const [draft, setDraft] = useState<Brochure | null>(null);
  const draftRef = useRef<Brochure | null>(null);
  const savedRef = useRef<Brochure | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('clean');
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => { draftRef.current = draft; }, [draft]);

  const openSession = useCallback(async (data: SessionData) => {
    savedRef.current = data.brochure;
    setSession(data);
    setStatusMessage('');
    if (data.user.role === 'town_admin') {
      setDraft(null); setSaveState('clean'); setScreen('admin'); return;
    }
    if (data.visits.length === 0) {
      setScreen('no-history');
      return;
    }
    if (data.brochure) {
      const normalized = normalizeBrochureCategories(data.brochure, data.spots);
      const migrated = categoryAssignmentsChanged(data.brochure, normalized);
      setDraft(normalized);
      setSaveState(migrated ? 'dirty' : 'clean');
      if (migrated) setStatusMessage('保存済みの内容を5つの体験カテゴリへ整理しました。「変更を保存」で確定できます。');
      setScreen('brochure');
      return;
    }

    setScreen('settings');
  }, []);

  useEffect(() => {
    let active = true;
    api<SessionData>('/api/session')
      .then((data) => { if (active) void openSession(data); })
      .catch((error) => {
        if (!active) return;
        if (error instanceof ApiError && error.status === 401) setScreen('login');
        else {
          setStatusMessage(formatError(error));
          setScreen('login');
        }
      });
    return () => { active = false; };
  }, [openSession]);

  useEffect(() => {
    const isDirty = saveState === 'dirty' || saveState === 'saving' || saveState === 'error';
    if (!isDirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [saveState]);

  const markChanged = useCallback((update: (current: Brochure) => Brochure) => {
    setDraft((current) => {
      if (!current) return current;
      const next = update(current);
      draftRef.current = next;
      return next;
    });
    setSaveState('dirty');
    setStatusMessage('変更があります。「変更を保存」で確定してください。');
  }, []);

  const save = useCallback(async () => {
    if (!draft || saveState === 'saving') return;
    const sentDraft = draft;
    const sentPayload = brochurePayload(sentDraft);
    setSaveState('saving');
    setStatusMessage('変更を保存しています。');
    try {
      const result = await api<{ brochure: Brochure }>('/api/brochure', {
        method: 'PUT', body: JSON.stringify(sentPayload),
      });
      savedRef.current = result.brochure;
      const latest = draftRef.current;
      if (latest && draftSignature(latest) !== draftSignature(sentDraft)) {
        const payloadChangedWhileSaving = payloadSignature(latest) !== payloadSignature(sentDraft);
        const merged = { ...latest, revision: result.brochure.revision, updatedAt: result.brochure.updatedAt };
        draftRef.current = merged;
        setDraft(merged);
        setSaveState(payloadChangedWhileSaving ? 'dirty' : 'saved');
        setStatusMessage(payloadChangedWhileSaving
          ? '送信中に加えた変更は画面に残っています。もう一度「変更を保存」を押してください。'
          : '変更と写真を保存しました。再ログインしても復元されます。');
      } else {
        const normalized = session ? normalizeBrochureCategories(result.brochure, session.spots) : result.brochure;
        draftRef.current = normalized;
        setDraft(normalized);
        setSaveState('saved');
        setStatusMessage('変更を保存しました。再ログインしても復元されます。');
      }
    } catch (error) {
      setSaveState('error');
      setStatusMessage(error instanceof ApiError && error.code === 'revision_conflict'
        ? '別の画面で更新されています。入力は残っています。内容を控えてから再読み込みしてください。'
        : formatError(error));
    }
  }, [draft, saveState, session]);

  const recoverConflict = useCallback(async () => {
    if (!session || !draftRef.current || !savedRef.current) throw new Error('しおりを開き直してください。');
    const latest = await api<SessionData>('/api/session');
    if (latest.user.id !== session.user.id || latest.user.role !== 'visitor' || !latest.brochure) throw new Error('ログイン状態が変わりました。ログインし直してください。');
    const merged = normalizeBrochureCategories(mergeBrochureEdits(savedRef.current, draftRef.current, latest.brochure), latest.spots);
    savedRef.current = latest.brochure; draftRef.current = merged;
    setSession(latest); setDraft(merged);
    setSaveState(payloadSignature(merged) === payloadSignature(latest.brochure) ? 'clean' : 'dirty');
    setStatusMessage('最新の保存内容を取り込みました。編集中の内容を確認して保存・再生成してください。');
  }, [session]);

  const logout = useCallback(async () => {
    if (saveState === 'saving') return;
    if ((saveState === 'dirty' || saveState === 'error') && !window.confirm('未保存の変更があります。保存せずログアウトしますか？')) return;
    try { await api<{ ok: true }>('/api/logout', { method: 'POST', body: '{}' }); }
    catch (error) { if (!(error instanceof ApiError && error.status === 401)) { setStatusMessage(`ログアウトを完了できませんでした。${formatError(error)}`); return; } }
    setSession(null);
    setDraft(null);
    savedRef.current = null;
    setSaveState('clean');
    setStatusMessage('');
    setScreen('login');
  }, [saveState]);

  if (screen === 'checking') return <CheckingScreen />;
  if (screen === 'login') return <LoginScreen onLogin={openSession} notice={statusMessage} />;
  if (screen === 'admin' && session) return <AdminDashboard user={session.user} onLogout={logout} notice={statusMessage} />;
  if (screen === 'settings' && session) return <TripSettingsScreen
    session={session}
    notice={statusMessage}
    onLogout={() => void logout()}
    generatingView={<GeneratingScreen />}
    onGenerate={async(settings) => {
      setStatusMessage('');
      const result = await withGeneratingScreenDuration(api<{ brochure: Brochure; spots: Spot[] }>('/api/brochure/ensure', { method: 'POST', body: JSON.stringify({ settings }) }));
      savedRef.current = result.brochure;
      const normalized = normalizeBrochureCategories(result.brochure, result.spots);
      draftRef.current = normalized;
      setDraft(normalized);
      setSession(current => current ? { ...current, spots: result.spots, brochure: normalized } : current);
      setSaveState('saved');
      setStatusMessage('選んだ条件でパンフレットを作成して保存しました。');
      setScreen('brochure');
    }}
  />;
  if (screen === 'no-history') return <NoHistoryScreen name={session?.user.displayName ?? ''} notice={statusMessage} onLogout={logout} />;
  if (!session || !draft) return <CheckingScreen />;

  return (
    <BrochureEditor
      session={session}
      draft={draft}
      saveState={saveState}
      statusMessage={statusMessage}
      onChange={markChanged}
      onReplace={(brochure, message, spots) => {
        savedRef.current = brochure;
        const normalized = normalizeBrochureCategories(brochure, spots ?? session.spots);
        if (spots) setSession(current => current ? { ...current, spots } : current);
        draftRef.current = normalized;
        setDraft(normalized);
        setSaveState('saved');
        setStatusMessage(message);
      }}
      onSave={save}
      onRecoverConflict={recoverConflict}
      onLogout={logout}
      onStatus={setStatusMessage}
      onPhotoUpdate={(itemId, photoUrl) => {
        setDraft((current) => {
          if (!current) return current;
          const next = {
            ...current,
            items: current.items.map((item) => item.id === itemId ? { ...item, photoUrl } : item),
          };
          draftRef.current = next;
          return next;
        });
      }}
    />
  );
}

function CheckingScreen() {
  return (
    <main className="center-screen paper-bg" aria-busy="true">
      <div className="checking-mark"><LoaderCircle aria-hidden="true" /></div>
      <p className="eyebrow">今度はあなたと</p>
      <h1>旅の記録を確認しています</h1>
    </main>
  );
}

function LoginScreen({ onLogin, notice }: { onLogin: (data: SessionData) => Promise<void>; notice: string }) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('1111');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(notice);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const data = await api<SessionData>('/api/login', {
        method: 'POST', body: JSON.stringify({ email: email.trim(), code }),
      });
      await onLogin(data);
    } catch (reason) {
      setError(formatError(reason));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page paper-bg">
      <div className="login-stamp stamp-train" aria-hidden="true"><Stamp /><span>LOCAL TRIP</span></div>
      <div className="login-stamp stamp-map" aria-hidden="true"><MapPin /><span>MEMORIES</span></div>
      <section className="login-layout" aria-labelledby="login-title">
        <div className="login-visual" aria-hidden="true">
          <div className="photo-stack photo-stack-top">
            <img src="/assets/street.png" alt="" />
          </div>
          <div className="photo-stack photo-stack-bottom">
            <img src="/assets/coast.png" alt="" />
          </div>
          <div className="route-doodle"><span /><span /><span /></div>
        </div>
        <div className="login-copy">
          <p className="brand-kicker">KONDO WA ANATA TO</p>
          <h1 id="login-title" className="brand-title">今度はあなたと</h1>
          <p className="tagline">旅の思い出を、次の約束に。</p>
          <p className="login-intro">前回の旅の思い出から、誰かと一緒にいく次の旅のしおりを作ります。</p>
          <form className="login-form" onSubmit={submit}>
            <label>
              <span>メールアドレス</span>
              <input
                type="email"
                data-testid="login-email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="demo@example.test"
              />
            </label>
            <label>
              <span>認証コード</span>
              <input
                inputMode="numeric"
                data-testid="login-code"
                autoComplete="one-time-code"
                required
                pattern="[0-9]{4}"
                maxLength={4}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 4))}
              />
            </label>
            <button className="button button-primary login-submit" data-testid="login-submit" disabled={submitting}>
              {submitting ? <LoaderCircle className="spin" aria-hidden="true" /> : <MapIcon aria-hidden="true" />}
              {submitting ? '旅の記録を確認中' : '次の旅をつくる'}
            </button>
          </form>
          <div className="demo-note">
            <strong>ローカルデモ専用</strong>
            <span>
              デモ用メールは
              <button type="button" className="demo-email" onClick={() => setEmail('demo@example.test')}>demo@example.test</button>
              、認証コードは <b>1111</b> です。外部サービスへ情報を送りません。
            </span>
          </div>
          <p className="login-intro">町側の管理デモは<button type="button" className="demo-email" disabled={submitting} onClick={() => setEmail('town@example.test')}>town@example.test</button>でログインできます。</p>
          <p className="form-error" role="alert">{error}</p>
        </div>
      </section>
    </main>
  );
}

function GeneratingScreen() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setStep((current) => Math.min(current + 1, 2)), 800);
    return () => window.clearInterval(timer);
  }, []);
  const steps = [
    ['前回の思い出を確認', '訪問した場所と感想を読み込んでいます'],
    ['次の候補を選定', '同行者と旅の好みに合う場所を組み合わせています'],
    ['しおりを仕上げる', '次の旅のしおりを保存しています'],
  ];
  return (
    <main className="generating-page paper-bg" aria-live="polite" aria-busy="true">
      <section className="open-book">
        <p className="eyebrow">今度はあなたと</p>
        <h1>旅の思い出から、次の旅のしおりをつくっています</h1>
        <ol className="progress-steps">
          {steps.map(([title, description], index) => (
            <li key={title} className={index < step ? 'complete' : index === step ? 'active' : ''}>
              <span className="step-icon">
                {index < step ? <Check aria-hidden="true" /> : index === step ? <LoaderCircle className="spin" aria-hidden="true" /> : index + 1}
              </span>
              <span><strong>{title}</strong><small>{description}</small></span>
            </li>
          ))}
        </ol>
        <div className="progress-track" aria-hidden="true"><span style={{ width: `${30 + step * 30}%` }} /></div>
        <p className="generating-note">保存済みのパンフレットがある場合は、編集内容を上書きせずそのまま開きます。</p>
      </section>
    </main>
  );
}

function NoHistoryScreen({ name, notice, onLogout }: { name: string; notice: string; onLogout: () => void }) {
  return (
    <main className="center-screen paper-bg">
      <section className="empty-paper">
        <MapPin aria-hidden="true" />
        <p className="eyebrow">{name ? `${name}さん` : 'ログイン済み'}</p>
        <h1>訪問履歴が見つかりません</h1>
        <p>パンフレットは、実際の訪問記録をもとに作成します。架空の履歴は追加していません。</p>
        {notice && <p className="form-error" role="alert">{notice}</p>}
        <button className="button button-outline" onClick={onLogout}><LogOut aria-hidden="true" />別のメールで確認</button>
      </section>
    </main>
  );
}

interface PendingPhoto { file: File; preview: string }

interface EditorProps {
  session: SessionData;
  draft: Brochure;
  saveState: SaveState;
  statusMessage: string;
  onChange: (update: (current: Brochure) => Brochure) => void;
  onReplace: (brochure: Brochure, message: string, spots?: Spot[]) => void;
  onSave: () => Promise<void>;
  onRecoverConflict: () => Promise<void>;
  onLogout: () => Promise<void>;
  onStatus: (message: string) => void;
  onPhotoUpdate: (itemId: string, photoUrl: string | null) => void;
}

function BrochureEditor(props: EditorProps) {
  const { session, draft, saveState, statusMessage, onChange, onReplace, onSave, onRecoverConflict, onLogout, onStatus, onPhotoUpdate } = props;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const previewReturnY = useRef(0);
  const previewCloseRef = useRef<HTMLButtonElement>(null);
  const [replaceItemId, setReplaceItemId] = useState<string | null>(null);
  const [detailSpotId, setDetailSpotId] = useState<string | null>(null);
  const [photoBusyId, setPhotoBusyId] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<Record<string, string>>({});
  const pendingPhotosRef = useRef<Record<string, PendingPhoto>>({});
  const [pendingPhotos, setPendingPhotos] = useState(pendingPhotosRef.current);
  useEffect(() => () => {
    for (const photo of Object.values(pendingPhotosRef.current)) URL.revokeObjectURL(photo.preview);
  }, []);
  const spotsById = useMemo(() => new Map(session.spots.map((spot) => [spot.id, spot])), [session.spots]);
  const detailItem = draft.items.find(item => item.spotId === detailSpotId);
  const detailSpot = detailSpotId ? spotsById.get(detailSpotId) : undefined;
  const selected = useMemo(() => draft.items.filter((item) => item.selected).sort((a, b) => a.order - b.order), [draft.items]);

  useEffect(() => {
    if (!previewOpen) return undefined;
    window.scrollTo({ top: 0, behavior: 'instant' });
    previewCloseRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.querySelector('.spot-detail-dialog')) closeHtmlPreview();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [previewOpen]);

  function openHtmlPreview() {
    previewReturnY.current = window.scrollY;
    setPreviewOpen(true);
  }

  function closeHtmlPreview() {
    setPreviewOpen(false);
    requestAnimationFrame(() => {
      window.scrollTo({ top: previewReturnY.current, behavior: 'instant' });
      const triggers = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-testid="html-preview"]'));
      triggers.find((trigger) => trigger.offsetParent !== null)?.focus();
    });
  }

  function updateItem(id: string, updater: (item: BrochureItem) => BrochureItem) {
    onChange((current) => ({
      ...current,
      items: current.items.map((item) => item.id === id ? updater(item) : item),
    }));
  }

  function moveItem(item: BrochureItem, direction: -1 | 1) {
    const ordered = selected;
    const index = ordered.findIndex((entry) => entry.id === item.id);
    const other = ordered[index + direction];
    if (!other) return;
    onChange((current) => ({
      ...current,
      items: current.items.map((entry) => entry.id === item.id
        ? { ...entry, order: other.order }
        : entry.id === other.id ? { ...entry, order: item.order } : entry),
    }));
  }

  function rememberPendingPhoto(itemId: string, file: File) {
    const previous = pendingPhotosRef.current[itemId];
    if (previous?.file === file) return;
    const next = { ...pendingPhotosRef.current, [itemId]: { file, preview: URL.createObjectURL(file) } };
    pendingPhotosRef.current = next;
    setPendingPhotos(next);
    if (previous) URL.revokeObjectURL(previous.preview);
  }

  function clearPendingPhoto(itemId: string, file?: File) {
    const previous = pendingPhotosRef.current[itemId];
    if (!previous || (file && previous.file !== file)) return;
    const next = { ...pendingPhotosRef.current };
    delete next[itemId];
    pendingPhotosRef.current = next;
    setPendingPhotos(next);
    URL.revokeObjectURL(previous.preview);
  }

  async function uploadPhoto(item: BrochureItem, file: File) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setPhotoError((errors) => ({ ...errors, [item.id]: 'JPEG・PNG・WebPの写真を選んでください。' }));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError((errors) => ({ ...errors, [item.id]: '写真は5MB以下にしてください。' }));
      return;
    }
    rememberPendingPhoto(item.id, file);
    setPhotoBusyId(item.id);
    setPhotoError((errors) => ({ ...errors, [item.id]: '' }));
    const form = new FormData();
    form.append('photo', file);
    try {
      const result = await api<{ photoUrl: string }>(`/api/items/${encodeURIComponent(item.id)}/photo`, { method: 'POST', body: form });
      onPhotoUpdate(item.id, result.photoUrl);
      clearPendingPhoto(item.id, file);
      onStatus(saveState === 'dirty' || saveState === 'error'
        ? '写真を保存しました。ほかの未保存変更は「変更を保存」で確定してください。'
        : '写真を保存しました。再ログインしても復元されます。');
    } catch (error) {
      setPhotoError((errors) => ({ ...errors, [item.id]: formatError(error) }));
    } finally {
      setPhotoBusyId(null);
    }
  }

  async function removePhoto(item: BrochureItem) {
    setPhotoBusyId(item.id);
    setPhotoError((errors) => ({ ...errors, [item.id]: '' }));
    try {
      await api<{ photoUrl: null }>(`/api/items/${encodeURIComponent(item.id)}/photo`, { method: 'DELETE' });
      setPhotoBusyId(null);
      onPhotoUpdate(item.id, null);
      clearPendingPhoto(item.id);
      onStatus('追加した写真を削除しました。');
    } catch (error) {
      setPhotoBusyId(null);
      setPhotoError((errors) => ({ ...errors, [item.id]: formatError(error) }));
    }
  }

  const saveLabel = saveState === 'saving' ? '保存中' : saveState === 'error' ? '保存を再試行' : saveState === 'dirty' ? '変更を保存' : '保存済み';

  if (settingsOpen) return <TripSettingsScreen
    session={session}
    brochure={draft}
    onRecoverConflict={onRecoverConflict}
    previewBySpotId={Object.fromEntries(draft.items.filter(item => pendingPhotos[item.id]).map(item => [item.spotId, pendingPhotos[item.id]!.preview]))}
    generatingView={<GeneratingScreen />}
    onCancel={() => {
      setSettingsOpen(false);
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-testid="trip-settings-open"]')?.focus());
    }}
    onGenerate={async(settings, mode) => {
      const result = await withGeneratingScreenDuration(api<{ brochure: Brochure; spots: Spot[] }>('/api/brochure/regenerate', { method: 'POST', body: JSON.stringify({ draft: brochurePayload(draft), settings, mode }) }));
      onReplace(result.brochure, mode === 'all' ? '選んだ条件で旅全体を作り直して保存しました。' : '候補を作り直して保存しました。', result.spots);
      setSettingsOpen(false);
      window.scrollTo({ top: 0, behavior: 'instant' });
    }}
  />;

  return (
    <div className={`app-shell${previewOpen ? ' preview-mode' : ''}`}>
      {previewOpen ? (
        <header className="preview-toolbar" data-testid="html-preview-toolbar">
          <div className="preview-toolbar-title">
            <Eye aria-hidden="true" />
            <span><strong>旅のしおり</strong><small>作成者としての表示</small></span>
          </div>
          <button ref={previewCloseRef} className="button button-outline" onClick={closeHtmlPreview}>
            <ChevronLeft aria-hidden="true" />編集画面へ戻る
          </button>
        </header>
      ) : <header className="editor-toolbar" data-export-exclude="true">
        <a className="mini-brand" href="#brochure-top" aria-label="パンフレットの先頭へ">今度はあなたと</a>
        <div className="toolbar-actions">
          <button className="button toolbar-button trip-settings-entry" data-testid="trip-settings-open" aria-label="旅の条件を変更" onClick={() => setSettingsOpen(true)}>
            <UsersRound aria-hidden="true" /><span>旅の条件を変更</span>
          </button>
          <TemplateSelect value={draft.template} onChange={(template) => onChange((current) => ({ ...current, template }))} />
          <button className={`button save-button state-${saveState}`} data-testid="save-button" onClick={() => void onSave()} disabled={saveState === 'saving' || saveState === 'clean' || saveState === 'saved'}>
            {saveState === 'saving' ? <LoaderCircle className="spin" aria-hidden="true" /> : saveState === 'saved' || saveState === 'clean' ? <Check aria-hidden="true" /> : <Save aria-hidden="true" />}
            {saveLabel}
          </button>
          <button className="button button-outline preview-button" data-testid="html-preview" onClick={openHtmlPreview}>
            <Eye aria-hidden="true" /><span>しおりを見る</span>
          </button>
        </div>
        <button className="icon-button logout-button" aria-label="ログアウト" title="ログアウト" disabled={saveState === 'saving'} onClick={() => void onLogout()}><LogOut aria-hidden="true" /></button>
      </header>}
      {previewOpen && <SharePanel companion={draft.companion} canPublish={(saveState === 'clean' || saveState === 'saved') && !photoBusyId && Object.keys(pendingPhotos).length === 0} />}
      {!previewOpen && <div className={`status-strip state-${saveState}`} role="status" aria-live="polite">
        {saveState === 'error' ? <CircleAlert aria-hidden="true" /> : saveState === 'dirty' ? <PencilLine aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}
        <span>{statusMessage || '体験カテゴリ・写真・コメント・訪問順をパンフレット上で編集できます。'}</span>
      </div>}
      <main className="editor-main">
        <BrochurePaper draft={draft} spots={session.spots} visits={session.visits} survey={session.survey}
          pendingPhotos={pendingPhotos} photoBusyId={photoBusyId} photoError={photoError}
          onComment={(id, comment) => updateItem(id, item => ({ ...item, comment }))}
          onReplace={setReplaceItemId} onPhoto={uploadPhoto} onRemovePhoto={removePhoto}
          onMove={moveItem} onOpen={setDetailSpotId} onOpenSettings={() => setSettingsOpen(true)} />
      </main>
      {!previewOpen && <div className="mobile-share-bar" data-export-exclude="true">
        <button className="button save-button" onClick={() => void onSave()} disabled={saveState === 'saving' || saveState === 'clean' || saveState === 'saved'}><Save aria-hidden="true" />{saveLabel}</button>
        <button className="button button-outline preview-button" data-testid="html-preview" onClick={openHtmlPreview}><Eye aria-hidden="true" />しおりを見る</button>
      </div>}
      {!previewOpen && replaceItemId && (
        <SpotReplaceDialog
          itemId={replaceItemId}
          brochure={draft}
          spotsById={spotsById}
          onClose={() => setReplaceItemId(null)}
          onChoose={(newItemId) => {
            const old = draft.items.find((item) => item.id === replaceItemId);
            if (!old?.pickupCategory) return;
            onChange((current) => {
              const replaced = current.items.map((item) => item.id === replaceItemId
                ? { ...item, selected: false, pickupCategory: null }
                : item.id === newItemId ? { ...item, selected: true, pickupCategory: old.pickupCategory, order: old.order } : item);
              return { ...current, items: replaced };
            });
            setReplaceItemId(null);
          }}
        />
      )}
      {detailSpot && <SpotDetailDialog key={detailSpot.id} spot={detailSpot} photoUrl={detailItem ? pendingPhotos[detailItem.id]?.preview || detailItem.photoUrl : null} comment={detailItem?.comment} canClaim={true} onClose={() => setDetailSpotId(null)} />}
    </div>
  );
}


interface PaperProps {
  draft: Brochure; spots: Spot[]; visits: Array<Pick<Visit, 'spotId' | 'visitedAt' | 'stamp'>>; survey: SessionData['survey'];
  pendingPhotos?: Record<string, PendingPhoto>; photoBusyId?: string | null; photoError?: Record<string, string>;
  onOpen: (spotId: string) => void;
  onComment?: (id: string, comment: string) => void;
  onReplace?: (itemId: string) => void;
  onPhoto?: (item: BrochureItem, file: File) => Promise<void>;
  onRemovePhoto?: (item: BrochureItem) => Promise<void>;
  onMove?: (item: BrochureItem, direction: -1 | 1) => void;
  onOpenSettings?: () => void;
}
export function BrochurePaper({ draft, spots, visits, survey, pendingPhotos = {}, photoBusyId = null, photoError = {},
  onOpen, onComment = () => {}, onReplace = () => {}, onPhoto: uploadPhoto = async () => {},
  onRemovePhoto: removePhoto = async () => {}, onMove = () => {}, onOpenSettings = () => {} }: PaperProps) {
  const spotsById = new Map(spots.map(spot => [spot.id, spot]));
  const selected = draft.items.filter(item => item.selected).sort((a, b) => a.order - b.order);
  const visitedItems = draft.items.filter(item => item.kind === 'visited' && item.isMemory).sort((a, b) => a.order - b.order);
  const heroItem = selected[0], heroSpot = heroItem ? spotsById.get(heroItem.spotId) : undefined;
  const heroImage = heroItem ? pendingPhotos[heroItem.id]?.preview || heroItem.photoUrl || heroSpot?.image : undefined;
  return (
        <article id="brochure-top" data-testid="brochure" className={`brochure template-${draft.template}`}>
          <BrochureHeader brochure={draft} heroImage={heroImage} memoryNames={visitedItems.map(item => spotsById.get(item.spotId)?.name).filter((name): name is string => Boolean(name))} />
          <section className="pickup-section" aria-labelledby="pickup-title">
            <div className="section-heading pickup-heading">
              <Sparkles aria-hidden="true" />
              <div><h2 id="pickup-title">5つの楽しみ</h2></div>
              <button data-export-exclude="true" className="button mini-action" onClick={onOpenSettings}><RefreshCw aria-hidden="true" />まとめて選び直す</button>
            </div>
            <p className="pickup-intro">場所からではなく、次の旅で楽しみたいことからおすすめを選びました。</p>
            <div className="category-grid" role="list" aria-label="体験カテゴリ別のおすすめ">
              {EXPERIENCE_CATEGORIES.map((definition) => {
                const item = selected.find((entry) => entry.pickupCategory === definition.id);
                const spot = item ? spotsById.get(item.spotId) : undefined;
                return item && spot ? (
                  <CategoryPickupCard
                    key={definition.id}
                    category={definition.id}
                    item={item}
                    spot={spot}
                    trip={draft}
                    onComment={(comment) => onComment(item.id, comment)}
                    onReplace={() => onReplace(item.id)}
                    onPhoto={(file) => void uploadPhoto(item, file)}
                    onRemovePhoto={() => void removePhoto(item)}
                    busy={photoBusyId === item.id}
                    error={photoError[item.id]}
                    pendingPhoto={pendingPhotos[item.id]}
                    onOpen={() => onOpen(spot.id)}
                  />
                ) : <EmptyCategoryCard key={definition.id} category={definition.id} onOpenSettings={onOpenSettings} />;
              })}
            </div>
          </section>
          <div className="brochure-support-grid">
            <ModelPlan selected={selected} spotsById={spotsById} onMove={onMove} duration={draft.duration} onOpen={onOpen} />
            <MemoryPanel
              visitedItems={visitedItems}
              visits={visits}
              survey={survey}
              spotsById={spotsById}
              onComment={onComment}
              onPhoto={uploadPhoto}
              onRemovePhoto={removePhoto}
              busyId={photoBusyId}
              photoError={photoError}
              pendingPhotos={pendingPhotos}
              onOpen={onOpen}
            />
          </div>
          <footer className="brochure-footer">
            <span><Sparkles aria-hidden="true" /> 今度はあなたと</span>
            <small>ローカルデモ専用・スポットと画像はデモ用イメージ</small>
          </footer>
        </article>
  );
}

function TemplateSelect({ value, onChange }: { value: Template; onChange: (value: Template) => void }) {
  return (
    <label className="template-select">
      <MapIcon aria-hidden="true" />
      <span className="template-select-label">デザインを変える</span>
      <select value={value} onChange={(event) => onChange(event.target.value as Template)}>
        <option value="colorful">カラフルな旅行パンフレット</option>
        <option value="postcard">ポストカード</option>
      </select>
    </label>
  );
}

function BrochureHeader({ brochure, heroImage, memoryNames }: { brochure: Brochure; heroImage?: string; memoryNames: string[] }) {
  return (
    <header className="brochure-header">
      <div className="brochure-hero">
        {heroImage && <img src={heroImage} alt="" />}
        <div className="hero-copy">
          <p>前回の旅の思い出から生まれた、次の旅のしおり</p>
          <h1>{brochure.title}</h1>
          <div className="title-underline" aria-hidden="true" />
        </div>
        <div className="hero-stamp" aria-hidden="true"><Stamp /></div>
      </div>
      {memoryNames.length > 0 && <p className="brochure-origin"><Stamp aria-hidden="true" /><span><strong>このしおりのきっかけ</strong>{memoryNames.slice(0, 2).join('・')}{memoryNames.length > 2 ? ` ほか${memoryNames.length - 2}か所` : ''}の思い出をもとにつくりました。</span></p>}
      <dl className="trip-meta">
        <div><dt><Sparkles aria-hidden="true" />旅のテーマ</dt><dd>{brochure.theme}</dd></div>
      </dl>
    </header>
  );
}

function CategoryIcon({ category }: { category: ExperienceCategory }) {
  if (category === 'see') return <Eye aria-hidden="true" />;
  if (category === 'eat') return <Utensils aria-hidden="true" />;
  if (category === 'relax') return <Leaf aria-hidden="true" />;
  if (category === 'buy') return <ShoppingBag aria-hidden="true" />;
  return <Sparkles aria-hidden="true" />;
}

interface CategoryPickupCardProps {
  category: ExperienceCategory;
  item: BrochureItem;
  spot: Spot;
  trip: Pick<Brochure, 'companion' | 'tripStyle'>;
  onComment: (comment: string) => void;
  onReplace: () => void;
  onPhoto: (file: File) => void;
  onRemovePhoto: () => void;
  busy: boolean;
  error?: string;
  pendingPhoto?: PendingPhoto;
  onOpen: () => void;
}

function CategoryPickupCard(props: CategoryPickupCardProps) {
  const { category, item, spot, trip, onComment, onReplace, onPhoto, onRemovePhoto, busy, error, pendingPhoto, onOpen } = props;
  const label = experienceCategoryLabel(category);
  return (
    <article className={`category-card category-${category}`} role="listitem" onClick={event => { if (event.target instanceof Element && !event.target.closest('button,a,input,select,textarea,label')) onOpen(); }}>
      <div className="category-ribbon"><CategoryIcon category={category} /><strong>{label}</strong></div>
      <PhotoEditor item={item} spot={spot} busy={busy} error={error} pendingPhoto={pendingPhoto} onPhoto={onPhoto} onRemove={onRemovePhoto} compact />
      <div className="category-card-copy">
        <span className="spot-kind">{item.kind === 'visited' ? '前回の思い出' : '新しい体験'}</span>
        <h3><button type="button" className="spot-detail-title" aria-label={`${spot.name}の詳細を表示`} onClick={onOpen}>{spot.name}</button></h3>
        <GiftBadge available={spot.hasGift} />
        <p className="spot-description spot-overview"><strong>場所の概要</strong>{spotOverview(spot)}</p>
        <p className="spot-recommendation"><strong>おすすめの理由</strong>{spotRecommendation(item, trip)}</p>
        <CommentEditor
          label={item.kind === 'visited' ? '前回の感想' : '行ってみたい理由'}
          value={item.comment}
          placeholder=""
          onChange={onComment}
        />
      </div>
      <button data-export-exclude="true" className="button replace-button category-replace" onClick={onReplace}><RotateCcw aria-hidden="true" />{label}を変更</button>
    </article>
  );
}

function EmptyCategoryCard({ category, onOpenSettings }: { category: ExperienceCategory; onOpenSettings: () => void }) {
  const label = experienceCategoryLabel(category);
  return (
    <article className={`category-card category-empty category-${category}`} role="listitem">
      <div className="category-ribbon"><CategoryIcon category={category} /><strong>{label}</strong></div>
      <div className="category-empty-body"><ImageIcon aria-hidden="true" /><p>条件に合う別のスポットがありません。</p></div>
      <button data-export-exclude="true" className="button replace-button category-replace" onClick={onOpenSettings}><RefreshCw aria-hidden="true" />条件を見直す</button>
    </article>
  );
}

function ModelPlan({ selected, spotsById, onMove, duration, onOpen }: {
  selected: BrochureItem[];
  spotsById: Map<string, Spot>;
  onMove: (item: BrochureItem, direction: -1 | 1) => void;
  duration: Brochure['duration'];
  onOpen: (spotId: string) => void;
}) {
  return (
    <section className="model-plan" aria-labelledby="model-plan-title">
      <div className="support-heading"><MapIcon aria-hidden="true" /><div><h2 id="model-plan-title">おすすめの訪問順</h2></div></div>
      <p className="support-intro">{duration === 'day' ? '日帰り' : '一泊二日'}でめぐる、おすすめの順路です。</p>
      <ol className="model-plan-list">
        {selected.map((item, index) => {
          const spot = spotsById.get(item.spotId);
          if (!spot) return null;
          return <li key={item.id}>
            <span className="plan-number">{index + 1}</span>
            <span className="plan-copy"><small>{item.pickupCategory ? experienceCategoryLabel(item.pickupCategory) : 'おすすめ'}</small><strong><button type="button" className="spot-detail-title" onClick={() => onOpen(spot.id)}>{spot.name}</button></strong></span>
            <span className="order-actions" data-export-exclude="true">
              <button className="icon-button" aria-label={`${spot.name}を前へ`} disabled={index === 0} onClick={() => onMove(item, -1)}><ArrowUp aria-hidden="true" /></button>
              <button className="icon-button" aria-label={`${spot.name}を後へ`} disabled={index === selected.length - 1} onClick={() => onMove(item, 1)}><ArrowDown aria-hidden="true" /></button>
            </span>
            {spot.hasGift && <span className="plan-coupon"><GiftBadge available /></span>}
          </li>;
        })}
      </ol>
    </section>
  );
}

interface MemoryProps {
  visitedItems: BrochureItem[];
  visits: Array<Pick<Visit, 'spotId' | 'visitedAt' | 'stamp'>>;
  survey: SessionData['survey'];
  spotsById: Map<string, Spot>;
  onComment: (id: string, comment: string) => void;
  onPhoto: (item: BrochureItem, file: File) => Promise<void>;
  onRemovePhoto: (item: BrochureItem) => Promise<void>;
  busyId: string | null;
  photoError: Record<string, string>;
  pendingPhotos: Record<string, PendingPhoto>;
  onOpen: (spotId: string) => void;
}

function MemoryPanel(props: MemoryProps) {
  const { visitedItems, visits, survey, spotsById, onComment, onPhoto, onRemovePhoto, busyId, photoError, pendingPhotos, onOpen } = props;
  const [activeIndex, setActiveIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const visitedKey = visitedItems.map((item) => item.id).join(':');
  const hasSurvey = Boolean(survey && (survey.satisfaction !== null || survey.goodPoints || survey.previousCompanion));

  useEffect(() => {
    setActiveIndex(0);
    trackRef.current?.scrollTo({ left: 0, behavior: 'auto' });
  }, [visitedKey]);

  function showSlide(index: number) {
    const nextIndex = Math.max(0, Math.min(index, visitedItems.length - 1));
    const slide = trackRef.current?.querySelector<HTMLElement>(`[data-memory-index="${nextIndex}"]`);
    slide?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'nearest',
      inline: 'start',
    });
    setActiveIndex(nextIndex);
  }

  function updateActiveSlide(track: HTMLDivElement) {
    const slides = [...track.querySelectorAll<HTMLElement>('[data-memory-index]')];
    if (!slides.length) return;
    const closest = slides.reduce((best, slide, index) => (
      Math.abs(slide.offsetLeft - track.scrollLeft) < Math.abs(slides[best]!.offsetLeft - track.scrollLeft) ? index : best
    ), 0);
    setActiveIndex(closest);
  }

  return (
    <section className="memory-section" aria-labelledby="memory-title">
      <div className="section-ribbon">
        <h2 id="memory-title">前回の思い出</h2>
      </div>
      {visitedItems.length ? (
        <>
          <div className="memory-carousel-heading">
            <strong>印象に残ったスポット</strong>
            {visitedItems.length > 1 && <small data-export-exclude="true" aria-live="polite" aria-atomic="true"><b>{activeIndex + 1}/{visitedItems.length}</b> 横にスワイプ</small>}
          </div>
          <div
            ref={trackRef}
            className="memory-carousel-track"
            data-testid="memory-carousel"
            role="region"
            aria-roledescription="カルーセル"
            aria-label="条件で選んだ思い出のスポット"
            tabIndex={0}
            onScroll={(event) => updateActiveSlide(event.currentTarget)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowLeft') { event.preventDefault(); showSlide(activeIndex - 1); }
              if (event.key === 'ArrowRight') { event.preventDefault(); showSlide(activeIndex + 1); }
            }}
          >
            {visitedItems.map((item, index) => {
              const spot = spotsById.get(item.spotId);
              if (!spot) return null;
              const visit = visits.filter((entry) => entry.spotId === item.spotId).sort((a, b) => b.visitedAt.localeCompare(a.visitedAt))[0];
              const visitDate = visit ? formatVisitDate(visit.visitedAt) : null;
              return <article
                key={item.id}
                className="memory-slide"
                data-testid="memory-slide"
                data-memory-item-id={item.id}
                data-memory-index={index}
                role="group"
                aria-label={`${index + 1}/${visitedItems.length} ${spot.name}`}
                onClick={event => { if (event.target instanceof HTMLImageElement) onOpen(spot.id); }}
              >
                <PhotoEditor
                  item={item}
                  spot={spot}
                  busy={busyId === item.id}
                  error={photoError[item.id]}
                  pendingPhoto={pendingPhotos[item.id]}
                  onPhoto={(file) => void onPhoto(item, file)}
                  onRemove={() => void onRemovePhoto(item)}
                />
                <h3><button type="button" className="spot-detail-title" onClick={() => onOpen(spot.id)}>{spot.name}</button></h3>
                <GiftBadge available={spot.hasGift} />
                {visit && (
                  <div className="memory-facts" aria-label={`${spot.name}の訪問記録`}>
                    {visitDate && <span><MapPin aria-hidden="true" />{visitDate}に訪問</span>}
                    <span className={visit.stamp ? 'has-stamp' : ''}><Stamp aria-hidden="true" />{visit.stamp ? 'スタンプ取得' : 'スタンプ未取得'}</span>
                  </div>
                )}
                <CommentEditor label="前回の感想" value={item.comment} placeholder="印象に残ったことを自由に書けます" onChange={(comment) => onComment(item.id, comment)} />
              </article>;
            })}
          </div>
          {visitedItems.length > 1 && <div className="memory-carousel-controls" data-export-exclude="true">
            <button type="button" className="icon-button" aria-label="前の思い出を見る" disabled={activeIndex === 0} onClick={() => showSlide(activeIndex - 1)}><ChevronLeft aria-hidden="true" /></button>
            <span aria-hidden="true">{activeIndex + 1} / {visitedItems.length}</span>
            <button type="button" className="icon-button" aria-label="次の思い出を見る" disabled={activeIndex === visitedItems.length - 1} onClick={() => showSlide(activeIndex + 1)}><ChevronRight aria-hidden="true" /></button>
          </div>}
          {hasSurvey && survey && (
            <details className="survey-note survey-disclosure" data-testid="survey-disclosure" data-export-exclude="true">
              <summary>編集確認：前回の旅全体のアンケート</summary>
              <dl>
                {survey.satisfaction !== null && <div><dt>総合満足度</dt><dd>{survey.satisfaction}/5</dd></div>}
                {survey.goodPoints && <div><dt>良かった点</dt><dd>{survey.goodPoints}</dd></div>}
                {survey.previousCompanion && <div><dt>前回の同行者</dt><dd>{survey.previousCompanion}</dd></div>}
              </dl>
            </details>
          )}
        </>
      ) : <p className="empty-message">振り返りに使える訪問記録がありません。</p>}
    </section>
  );
}

interface RouteItemProps {
  item: BrochureItem;
  index: number;
  count: number;
  spot?: Spot;
  onComment: (comment: string) => void;
  onMove: (direction: -1 | 1) => void;
  onReplace: () => void;
  onRemove: () => void;
  canRemove: boolean;
  onPhoto: (file: File) => void;
  onRemovePhoto: () => void;
  busy: boolean;
  error?: string;
  pendingPhoto?: PendingPhoto;
}

function RouteItem(props: RouteItemProps) {
  const { item, index, count, spot, onComment, onMove, onReplace, onRemove, canRemove, onPhoto, onRemovePhoto, busy, error, pendingPhoto } = props;
  if (!spot) return null;
  const isVisited = item.kind === 'visited';
  return (
    <li className={`route-item ${isVisited ? 'is-visited' : 'is-candidate'}`} data-testid="route-item">
      <div className="route-number" aria-label={`${index + 1}番目`}>{index + 1}</div>
      {index < count - 1 && <div className="route-connector" aria-hidden="true" />}
      <PhotoEditor item={item} spot={spot} busy={busy} error={error} pendingPhoto={pendingPhoto} onPhoto={onPhoto} onRemove={onRemovePhoto} compact />
      <div className="route-copy">
        <div className="spot-heading">
          <div>
            <span className="spot-kind">{isVisited ? '前回訪れたスポット' : '新しい候補スポット'}</span>
            <h3>{spot.name}</h3>
            <small>{spot.category}</small>
          </div>
          <div className="order-actions" data-export-exclude="true">
            <button className="icon-button" aria-label={`${spot.name}を前へ`} title="前へ" disabled={index === 0} onClick={() => onMove(-1)}><ArrowUp aria-hidden="true" /></button>
            <button className="icon-button" aria-label={`${spot.name}を後へ`} title="後へ" disabled={index === count - 1} onClick={() => onMove(1)}><ArrowDown aria-hidden="true" /></button>
          </div>
        </div>
        <p className="spot-description">{spot.description}</p>
        <CommentEditor
          label={isVisited ? '前回の感想' : '行ってみたい理由'}
          value={item.comment}
          placeholder={item.reason || (isVisited ? '前回の感想を書けます' : '行ってみたい理由を書けます')}
          onChange={onComment}
        />
        <div className="route-item-actions" data-export-exclude="true">
          <button className="button remove-button" disabled={!canRemove} title={!canRemove ? '候補は1件以上必要です' : undefined} onClick={onRemove}><Trash2 aria-hidden="true" />候補を外す</button>
          <button className="button replace-button" onClick={onReplace}><RotateCcw aria-hidden="true" />この候補を変更</button>
        </div>
      </div>
    </li>
  );
}

function PhotoEditor({ item, spot, busy, error, pendingPhoto, onPhoto, onRemove, compact = false }: {
  item: BrochureItem; spot: Spot; busy: boolean; error?: string; pendingPhoto?: PendingPhoto; onPhoto: (file: File) => void; onRemove: () => void; compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [failed, setFailed] = useState(false);
  const baseSrc = item.photoUrl || spot.image;
  const src = pendingPhoto?.preview || baseSrc;
  useEffect(() => setFailed(false), [src]);
  return (
    <div className={`photo-editor ${compact ? 'compact' : ''}`}>
      {src && !failed
        ? <img src={src} alt={`${spot.name}の写真`} onError={() => setFailed(true)} />
        : <div className="photo-placeholder"><ImageIcon aria-hidden="true" /><span>写真は任意です</span></div>}
      <div className="photo-actions" data-export-exclude="true">
        <input
          ref={inputRef}
          className="sr-only"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onPhoto(file);
            event.target.value = '';
          }}
        />
        <button className="button photo-button" disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? <LoaderCircle className="spin" aria-hidden="true" /> : <ImageIcon aria-hidden="true" />}
          {item.photoUrl ? '写真を差し替え' : '写真を追加'}
        </button>
        {item.photoUrl && <button className="icon-button danger" disabled={busy} aria-label={`${spot.name}の追加写真を削除`} title="追加写真を削除" onClick={onRemove}><Trash2 aria-hidden="true" /></button>}
      </div>
      {error && <div data-export-exclude="true"><p className="photo-error" role="alert">{error}</p>{pendingPhoto && <button className="button photo-retry" disabled={busy} onClick={() => onPhoto(pendingPhoto.file)}>写真の保存を再試行</button>}</div>}
    </div>
  );
}

function CommentEditor({ label, value, placeholder, onChange }: { label: string; value: string; placeholder: string; onChange: (value: string) => void }) {
  const count = codePointLength(value);
  const printedText = value || (label === '行ってみたい理由' ? placeholder : '');
  return (
    <div className="comment-block">
    <label className="comment-editor" data-export-exclude="true">
      <span className="comment-label">{label}</span>
      <textarea
        rows={3}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(limitComment(event.target.value))}
      />
      <small className={count >= 190 ? 'near-limit' : ''}>{count}/200</small>
    </label>
    {printedText && <div className="comment-static"><span className="comment-label">{label}</span><p>{printedText}</p></div>}
    </div>
  );
}

function SpotReplaceDialog({ itemId, brochure, spotsById, onClose, onChoose }: {
  itemId: string; brochure: Brochure; spotsById: Map<string, Spot>; onClose: () => void; onChoose: (id: string) => void;
}) {
  const current = brochure.items.find((item) => item.id === itemId);
  const category = current?.pickupCategory;
  const categoryLabel = category ? experienceCategoryLabel(category) : 'このカテゴリ';
  const dialogRef = useDialogFocus(onClose);
  const choices = brochure.items.filter((item) => {
    if (item.selected || !category) return false;
    const spot = spotsById.get(item.spotId);
    return Boolean(spot && spot.active !== false && spotSupportsExperienceCategory(spot, category));
  });
  return (
    <div className="dialog-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section ref={dialogRef} tabIndex={-1} className="dialog replace-dialog" role="dialog" aria-modal="true" aria-labelledby="replace-title">
        <button className="icon-button dialog-close" aria-label={`${categoryLabel}の候補変更を閉じる`} onClick={onClose}><X aria-hidden="true" /></button>
        <p className="eyebrow">CATEGORY PICKUP</p>
        <h2 id="replace-title">{categoryLabel}のピックアップを変更</h2>
        <p className="dialog-intro">「{current ? spotsById.get(current.spotId)?.name : '現在の候補'}」と入れ替える、{categoryLabel}の体験を選んでください。外した場所の写真やコメントは削除しません。</p>
        <div className="replace-list">
          {choices.map((item) => {
            const spot = spotsById.get(item.spotId);
            if (!spot) return null;
            return (
              <button key={item.id} className="replace-option" onClick={() => onChoose(item.id)}>
                <span className="replace-thumb">{spot.image ? <img src={spot.image} alt="" /> : <ImageIcon aria-hidden="true" />}</span>
                <span className="replace-option-copy"><strong>{spot.name}</strong><small>{spot.category}</small><GiftBadge available={spot.hasGift} /><p>{spotListDescription(spot)}</p></span>
                <ChevronRight aria-hidden="true" />
              </button>
            );
          })}
          {choices.length === 0 && <p className="empty-message">{categoryLabel}に合うほかの候補がありません。「旅の条件を変更」から一括で作り直してください。</p>}
        </div>
      </section>
    </div>
  );
}
