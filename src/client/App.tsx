import {
  ArrowDown,
  ArrowUp,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clipboard,
  Download,
  Image as ImageIcon,
  LoaderCircle,
  LogOut,
  Map as MapIcon,
  MapPin,
  PencilLine,
  RefreshCw,
  RotateCcw,
  Save,
  Sparkles,
  Stamp,
  Trash2,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';
import { toPng } from 'html-to-image';
import {
  type Brochure,
  type BrochureItem,
  type SavePayload,
  type SessionData,
  type Spot,
  type Template,
  type Visit,
} from '../shared/types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TripSettingsScreen } from './TripSettingsScreen';

type Screen = 'checking' | 'login' | 'settings' | 'brochure' | 'no-history';
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

function brochurePayload(brochure: Brochure): SavePayload {
  return {
    revision: brochure.revision,
    companion: brochure.companion,
    duration: brochure.duration,
    tripStyle: brochure.tripStyle,
    template: brochure.template,
    items: brochure.items.map(({ id, selected, isMemory, order, comment }) => ({
      id,
      selected,
      isMemory,
      order,
      comment,
    })),
  };
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

function currentInvitationText(brochure: Brochure, spotsById: globalThis.Map<string, Spot>) {
  const selected = brochure.items.filter((item) => item.selected).sort((a, b) => a.order - b.order);
  const names = selected.map((item) => spotsById.get(item.spotId)?.name).filter(Boolean) as string[];
  const memory = brochure.items.find((item) => item.isMemory) ?? brochure.items.find((item) => item.kind === 'visited');
  const memoryName = memory ? spotsById.get(memory.spotId)?.name : null;
  const destination = names.length > 0 ? names.join('、') : '次の候補地';
  const duration = brochure.duration === 'day' ? '日帰り' : '一泊二日';
  const pace = brochure.tripStyle === 'slow' ? 'ゆっくり楽しむ' : 'アクティブに楽しむ';
  const memoryLead = memoryName ? `前回訪れた${memoryName}が印象に残っています。` : '前回の旅が印象に残っています。';

  if (brochure.companion === '一人') {
    return `${memoryLead}次は${destination}をめぐる、${duration}で${pace}旅を計画しています。`;
  }
  const who = brochure.companion === '友人' ? '一緒に' : brochure.companion === 'パートナー' ? '二人で' : brochure.companion === '家族' ? '家族で' : `${brochure.companion}と一緒に`;
  return `${memoryName ? `前回行った${memoryName}、よかったよ。` : '前回の旅、よかったよ。'}次は${who}${destination}をめぐらない？${duration}で${pace}旅にしよう。`;
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
  const [saveState, setSaveState] = useState<SaveState>('clean');
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => { draftRef.current = draft; }, [draft]);

  const openSession = useCallback(async (data: SessionData) => {
    setSession(data);
    setStatusMessage('');
    if (data.visits.length === 0) {
      setScreen('no-history');
      return;
    }
    if (data.brochure) {
      setDraft(data.brochure);
      setSaveState('clean');
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
        draftRef.current = result.brochure;
        setDraft(result.brochure);
        setSaveState('saved');
        setStatusMessage('変更を保存しました。再ログインしても復元されます。');
      }
    } catch (error) {
      setSaveState('error');
      setStatusMessage(error instanceof ApiError && error.status === 409
        ? '別の画面で更新されています。入力は残っています。内容を控えてから再読み込みしてください。'
        : formatError(error));
    }
  }, [draft, saveState]);

  const logout = useCallback(async () => {
    if (saveState === 'saving') return;
    if ((saveState === 'dirty' || saveState === 'error') && !window.confirm('未保存の変更があります。保存せずログアウトしますか？')) return;
    try { await api<{ ok: true }>('/api/logout', { method: 'POST', body: '{}' }); }
    catch (error) { if (!(error instanceof ApiError && error.status === 401)) { setStatusMessage(`ログアウトを完了できませんでした。${formatError(error)}`); return; } }
    setSession(null);
    setDraft(null);
    setSaveState('clean');
    setStatusMessage('');
    setScreen('login');
  }, [saveState]);

  if (screen === 'checking') return <CheckingScreen />;
  if (screen === 'login') return <LoginScreen onLogin={openSession} notice={statusMessage} />;
  if (screen === 'settings' && session) return <TripSettingsScreen
    session={session}
    notice={statusMessage}
    onLogout={() => void logout()}
    generatingView={<GeneratingScreen />}
    onGenerate={async(settings) => {
      setStatusMessage('');
      const result = await api<{ brochure: Brochure }>('/api/brochure/ensure', { method: 'POST', body: JSON.stringify({ settings }) });
      draftRef.current = result.brochure;
      setDraft(result.brochure);
      setSession(current => current ? { ...current, brochure: result.brochure } : current);
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
      onReplace={(brochure, message) => {
        draftRef.current = brochure;
        setDraft(brochure);
        setSaveState('saved');
        setStatusMessage(message);
      }}
      onSave={save}
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
          <p className="login-intro">メールアドレスで前回の旅を確認し、次に誰かを誘うパンフレットを開きます。</p>
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
              {submitting ? '旅の記録を確認中' : '旅のパンフレットを見る'}
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
    ['前回の旅を確認', '訪問した場所と感想を読み込んでいます'],
    ['次の候補を選定', '同行者と旅の好みに合う場所を組み合わせています'],
    ['招待メッセージを作成', 'パンフレットを保存しています'],
  ];
  return (
    <main className="generating-page paper-bg" aria-live="polite" aria-busy="true">
      <section className="open-book">
        <p className="eyebrow">今度はあなたと</p>
        <h1>旅のパンフレットを準備しています</h1>
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
  onReplace: (brochure: Brochure, message: string) => void;
  onSave: () => Promise<void>;
  onLogout: () => Promise<void>;
  onStatus: (message: string) => void;
  onPhotoUpdate: (itemId: string, photoUrl: string | null) => void;
}

function BrochureEditor(props: EditorProps) {
  const { session, draft, saveState, statusMessage, onChange, onReplace, onSave, onLogout, onStatus, onPhotoUpdate } = props;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [replaceItemId, setReplaceItemId] = useState<string | null>(null);
  const [addSpotOpen, setAddSpotOpen] = useState(false);
  const [photoBusyId, setPhotoBusyId] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<Record<string, string>>({});
  const pendingPhotosRef = useRef<Record<string, PendingPhoto>>({});
  const [pendingPhotos, setPendingPhotos] = useState(pendingPhotosRef.current);
  useEffect(() => () => {
    for (const photo of Object.values(pendingPhotosRef.current)) URL.revokeObjectURL(photo.preview);
  }, []);
  const [sharing, setSharing] = useState<'copy' | 'png' | null>(null);
  const brochureRef = useRef<HTMLElement>(null);
  const spotsById = useMemo(() => new Map(session.spots.map((spot) => [spot.id, spot])), [session.spots]);
  const selected = useMemo(() => draft.items.filter((item) => item.selected).sort((a, b) => a.order - b.order), [draft.items]);
  const visitedItems = useMemo(() => draft.items.filter((item) => item.kind === 'visited'), [draft.items]);
  const memoryItem = visitedItems.find((item) => item.isMemory) ?? visitedItems.find((item) => item.selected) ?? null;
  const currentInvitation = useMemo(() => currentInvitationText(draft, spotsById), [draft, spotsById]);

  function updateItem(id: string, updater: (item: BrochureItem) => BrochureItem) {
    onChange((current) => ({
      ...current,
      items: current.items.map((item) => item.id === id ? updater(item) : item),
    }));
  }

  function chooseMemory(id: string) {
    onChange((current) => ({
      ...current,
      items: current.items.map((item) => ({ ...item, isMemory: item.id === id })),
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

  function removeItem(itemId: string) {
    if (selected.length <= 1) return;
    onChange((current) => {
      const remaining = current.items
        .filter((item) => item.selected && item.id !== itemId)
        .sort((a, b) => a.order - b.order);
      const orderById = new globalThis.Map(remaining.map((item, index) => [item.id, index + 1]));
      return {
        ...current,
        items: current.items.map((item) => item.id === itemId
          ? { ...item, selected: false }
          : item.selected ? { ...item, order: orderById.get(item.id) ?? item.order } : item),
      };
    });
  }

  function addItem(itemId: string) {
    if (selected.length >= 10) return;
    onChange((current) => {
      const selectedIds = [
        ...current.items.filter((item) => item.selected).sort((a, b) => a.order - b.order).map((item) => item.id),
        itemId,
      ];
      const orderById = new globalThis.Map(selectedIds.map((id, index) => [id, index + 1]));
      return {
        ...current,
        items: current.items.map((item) => item.id === itemId
          ? { ...item, selected: true, order: orderById.get(item.id) ?? item.order }
          : item.selected ? { ...item, order: orderById.get(item.id) ?? item.order } : item),
      };
    });
    setAddSpotOpen(false);
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

  function shareText() {
    const stopLines = selected.map((item, index) => {
      const spot = spotsById.get(item.spotId);
      const note = item.comment.trim() || item.reason.trim();
      return `${index + 1}. ${spot?.name ?? '訪問候補'}${note ? ` — ${note}` : ''}`;
    });
    return [draft.title, currentInvitation, '', 'めぐる場所', ...stopLines, '', '「今度はあなたと」で作成'].join('\n');
  }

  async function copyInvitation() {
    setSharing('copy');
    try {
      await navigator.clipboard.writeText(shareText());
      onStatus('招待文と訪問順をコピーしました。LINEなどに貼り付けられます。');
    } catch {
      onStatus('コピーできませんでした。ブラウザのクリップボード許可を確認してください。');
    } finally { setSharing(null); }
  }

  async function exportPng() {
    if (!brochureRef.current) return;
    const node = brochureRef.current;
    setSharing('png');
    onStatus('パンフレット画像を作成しています。');
    try {
      node.classList.add('png-mode');
      await document.fonts.ready;
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const pixelRatio = Math.min(2, window.devicePixelRatio || 1, Math.sqrt(16_000_000 / (node.scrollWidth * node.scrollHeight)));
      const dataUrl = await toPng(node, {
        cacheBust: true,
        pixelRatio,
        backgroundColor: draft.template === 'postcard' ? '#fffaf0' : '#fff7e9',
        filter: (node) => !(node instanceof HTMLElement && node.dataset.exportExclude === 'true'),
      });
      const link = document.createElement('a');
      link.download = `今度はあなたと-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = dataUrl;
      link.click();
      onStatus('PNG画像を端末へ保存しました。外部には送信していません。');
    } catch {
      onStatus('PNG画像を作れませんでした。写真の読み込みを確認して、もう一度お試しください。');
    } finally { node.classList.remove('png-mode'); setSharing(null); }
  }

  const saveLabel = saveState === 'saving' ? '保存中' : saveState === 'error' ? '保存を再試行' : saveState === 'dirty' ? '変更を保存' : '保存済み';

  if (settingsOpen) return <TripSettingsScreen
    session={session}
    brochure={draft}
    previewBySpotId={Object.fromEntries(draft.items.filter(item => pendingPhotos[item.id]).map(item => [item.spotId, pendingPhotos[item.id]!.preview]))}
    generatingView={<GeneratingScreen />}
    onCancel={() => {
      setSettingsOpen(false);
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-testid="trip-settings-open"]')?.focus());
    }}
    onGenerate={async(settings, mode) => {
      const result = await api<{ brochure: Brochure }>('/api/brochure/regenerate', { method: 'POST', body: JSON.stringify({ draft: brochurePayload(draft), settings, mode }) });
      onReplace(result.brochure, mode === 'all' ? '選んだ条件で旅全体を作り直して保存しました。' : '候補を作り直して保存しました。');
      setSettingsOpen(false);
      window.scrollTo({ top: 0, behavior: 'instant' });
    }}
  />;

  return (
    <div className="app-shell">
      <header className="editor-toolbar" data-export-exclude="true">
        <a className="mini-brand" href="#brochure-top" aria-label="パンフレットの先頭へ">今度はあなたと</a>
        <div className="toolbar-actions">
          <button className="button toolbar-button trip-settings-entry" data-testid="trip-settings-open" aria-label="旅の条件を変更" onClick={() => setSettingsOpen(true)}>
            <UsersRound aria-hidden="true" /><span>旅の条件を変更</span><b>{draft.companion}</b>
          </button>
          <TemplateSelect value={draft.template} onChange={(template) => onChange((current) => ({ ...current, template }))} />
          <button className={`button save-button state-${saveState}`} data-testid="save-button" onClick={() => void onSave()} disabled={saveState === 'saving' || saveState === 'clean' || saveState === 'saved'}>
            {saveState === 'saving' ? <LoaderCircle className="spin" aria-hidden="true" /> : saveState === 'saved' || saveState === 'clean' ? <Check aria-hidden="true" /> : <Save aria-hidden="true" />}
            {saveLabel}
          </button>
          <button className="button button-outline" onClick={() => void copyInvitation()} disabled={sharing !== null}>
            <Clipboard aria-hidden="true" /><span>招待文をコピー</span>
          </button>
          <button className="button button-primary" onClick={() => void exportPng()} disabled={sharing !== null}>
            {sharing === 'png' ? <LoaderCircle className="spin" aria-hidden="true" /> : <Download aria-hidden="true" />}<span>PNGで保存</span>
          </button>
          <button className="icon-button logout-button" aria-label="ログアウト" title="ログアウト" disabled={saveState === 'saving'} onClick={() => void onLogout()}><LogOut aria-hidden="true" /></button>
        </div>
      </header>
      <div className={`status-strip state-${saveState}`} role="status" aria-live="polite">
        {saveState === 'error' ? <CircleAlert aria-hidden="true" /> : saveState === 'dirty' ? <PencilLine aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}
        <span>{statusMessage || '写真・コメント・訪問順をパンフレット上で編集できます。'}</span>
      </div>
      <main className="editor-main">
        <article id="brochure-top" ref={brochureRef} data-testid="brochure" className={`brochure template-${draft.template}`}>
          <BrochureHeader brochure={draft} />
          <div className="brochure-columns">
            <MemoryPanel
              item={memoryItem}
              visitedItems={visitedItems}
              visits={session.visits}
              survey={session.survey}
              spotsById={spotsById}
              onChoose={chooseMemory}
              onComment={(id, comment) => updateItem(id, (item) => ({ ...item, comment }))}
              onPhoto={uploadPhoto}
              onRemovePhoto={removePhoto}
              busyId={photoBusyId}
              photoError={photoError}
              pendingPhotos={pendingPhotos}
            />
            <section className="route-section" aria-labelledby="route-title">
              <div className="section-heading route-heading">
                <MapPin aria-hidden="true" />
                <div><span>NEXT TRIP</span><h2 id="route-title">次の旅の候補</h2></div>
                <div className="route-heading-actions" data-export-exclude="true">
                  <button className="button mini-action add-action" data-testid="add-spot" disabled={selected.length >= 10} onClick={() => setAddSpotOpen(true)}><MapPin aria-hidden="true" />候補を追加</button>
                  <button className="button mini-action" onClick={() => setSettingsOpen(true)}><RefreshCw aria-hidden="true" />候補を一括変更</button>
                </div>
              </div>
              {selected.length ? (
                <ol className="route-list">
                  {selected.map((item, index) => (
                    <RouteItem
                      key={item.id}
                      item={item}
                      index={index}
                      count={selected.length}
                      spot={spotsById.get(item.spotId)}
                      onComment={(comment) => updateItem(item.id, (entry) => ({ ...entry, comment }))}
                      onMove={(direction) => moveItem(item, direction)}
                      onReplace={() => setReplaceItemId(item.id)}
                      onRemove={() => removeItem(item.id)}
                      canRemove={selected.length > 1}
                      onPhoto={(file) => void uploadPhoto(item, file)}
                      onRemovePhoto={() => void removePhoto(item)}
                      busy={photoBusyId === item.id}
                      error={photoError[item.id]}
                      pendingPhoto={pendingPhotos[item.id]}
                    />
                  ))}
                </ol>
              ) : <div className="route-empty"><MapIcon aria-hidden="true" /><p>訪問候補がありません。「候補を一括変更」から選び直してください。</p></div>}
            </section>
          </div>
          <InvitationPanel brochure={draft} invitation={currentInvitation} selected={selected} spotsById={spotsById} onCopy={copyInvitation} />
          <footer className="brochure-footer">
            <span><Sparkles aria-hidden="true" /> 今度はあなたと</span>
            <small>ローカルデモ専用・スポットと画像はデモ用イメージ・写真や内容を外部へ送信しません</small>
          </footer>
        </article>
      </main>
      <div className="mobile-share-bar" data-export-exclude="true">
        <button className="button save-button" onClick={() => void onSave()} disabled={saveState === 'saving' || saveState === 'clean' || saveState === 'saved'}><Save aria-hidden="true" />{saveLabel}</button>
        <button className="button button-outline" onClick={() => void copyInvitation()}><Clipboard aria-hidden="true" />コピー</button>
          <button className="button button-primary" onClick={() => void exportPng()}><Download aria-hidden="true" />PNG</button>
          <button className="icon-button" aria-label="ログアウト" title="ログアウト" disabled={saveState === 'saving'} onClick={() => void onLogout()}><LogOut aria-hidden="true" /></button>
      </div>
      {replaceItemId && (
        <SpotReplaceDialog
          mode="replace"
          itemId={replaceItemId}
          brochure={draft}
          spotsById={spotsById}
          onClose={() => setReplaceItemId(null)}
          onChoose={(newItemId) => {
            const old = draft.items.find((item) => item.id === replaceItemId);
            if (!old) return;
            onChange((current) => {
              const replaced = current.items.map((item) => item.id === replaceItemId
                ? { ...item, selected: false }
                : item.id === newItemId ? { ...item, selected: true, order: old.order } : item);
              const selectedIds = replaced.filter((item) => item.selected).sort((a, b) => a.order - b.order).map((item) => item.id);
              const orderById = new globalThis.Map(selectedIds.map((id, index) => [id, index + 1]));
              return {
                ...current,
                items: replaced.map((item) => item.selected ? { ...item, order: orderById.get(item.id) ?? item.order } : item),
              };
            });
            setReplaceItemId(null);
          }}
        />
      )}
      {addSpotOpen && (
        <SpotReplaceDialog
          mode="add"
          brochure={draft}
          spotsById={spotsById}
          onClose={() => setAddSpotOpen(false)}
          onChoose={addItem}
        />
      )}
    </div>
  );
}

function TemplateSelect({ value, onChange }: { value: Template; onChange: (value: Template) => void }) {
  return (
    <label className="template-select">
      <span className="sr-only">テンプレート</span>
      <MapIcon aria-hidden="true" />
      <select value={value} onChange={(event) => onChange(event.target.value as Template)}>
        <option value="colorful">カラフルな旅行パンフレット</option>
        <option value="postcard">ポストカード</option>
      </select>
    </label>
  );
}

function BrochureHeader({ brochure }: { brochure: Brochure }) {
  return (
    <header className="brochure-header">
      <div className="title-rays" aria-hidden="true"><i /><i /><i /></div>
      <div>
        <p className="brochure-overline">YOUR NEXT LOCAL TRIP</p>
        <h1>{brochure.title}</h1>
        <div className="title-underline" aria-hidden="true" />
      </div>
      <div className="header-illustration" aria-hidden="true">
        <MapPin /><span className="illustration-line" /><Stamp />
      </div>
      <dl className="trip-meta">
        <div><dt><UsersRound aria-hidden="true" />旅の相手</dt><dd>{brochure.companion}</dd></div>
        <div><dt><Sparkles aria-hidden="true" />旅のテーマ</dt><dd>{brochure.theme}</dd></div>
        <div><dt><MapIcon aria-hidden="true" />日程</dt><dd>{brochure.duration === 'day' ? '日帰り' : '一泊二日'}・{brochure.tripStyle === 'slow' ? 'ゆっくり' : 'アクティブ'}</dd></div>
      </dl>
    </header>
  );
}

interface MemoryProps {
  item: BrochureItem | null;
  visitedItems: BrochureItem[];
  visits: Visit[];
  survey: SessionData['survey'];
  spotsById: Map<string, Spot>;
  onChoose: (id: string) => void;
  onComment: (id: string, comment: string) => void;
  onPhoto: (item: BrochureItem, file: File) => Promise<void>;
  onRemovePhoto: (item: BrochureItem) => Promise<void>;
  busyId: string | null;
  photoError: Record<string, string>;
  pendingPhotos: Record<string, PendingPhoto>;
}

function MemoryPanel(props: MemoryProps) {
  const { item, visitedItems, visits, survey, spotsById, onChoose, onComment, onPhoto, onRemovePhoto, busyId, photoError, pendingPhotos } = props;
  const spot = item ? spotsById.get(item.spotId) : undefined;
  const visit = item
    ? visits.filter((entry) => entry.spotId === item.spotId).sort((a, b) => b.visitedAt.localeCompare(a.visitedAt))[0]
    : undefined;
  const visitDate = visit ? formatVisitDate(visit.visitedAt) : null;
  const hasSurvey = Boolean(survey && (survey.satisfaction !== null || survey.goodPoints || survey.previousCompanion));
  return (
    <section className="memory-section" aria-labelledby="memory-title">
      <div className="section-ribbon">
        <span>LAST TRIP</span>
        <h2 id="memory-title">前回の思い出</h2>
      </div>
      {item && spot ? (
        <>
          <label className="memory-select" data-export-exclude="true">
            <span>印象に残ったスポット</span>
            <select value={item.id} onChange={(event) => onChoose(event.target.value)}>
              {visitedItems.map((entry) => <option key={entry.id} value={entry.id}>{spotsById.get(entry.spotId)?.name ?? '訪問スポット'}</option>)}
            </select>
          </label>
          <PhotoEditor
            item={item}
            spot={spot}
            busy={busyId === item.id}
            error={photoError[item.id]}
            pendingPhoto={pendingPhotos[item.id]}
            onPhoto={(file) => void onPhoto(item, file)}
            onRemove={() => void onRemovePhoto(item)}
          />
          <h3>{spot.name}</h3>
          {visit && (
            <div className="memory-facts" aria-label="選択したスポットの訪問記録">
              {visitDate && <span><MapPin aria-hidden="true" />{visitDate}に訪問</span>}
              <span className={visit.stamp ? 'has-stamp' : ''}><Stamp aria-hidden="true" />{visit.stamp ? 'スタンプ取得' : 'スタンプ未取得'}</span>
            </div>
          )}
          <CommentEditor label="前回の感想" value={item.comment} placeholder="印象に残ったことを自由に書けます" onChange={(comment) => onComment(item.id, comment)} />
          {hasSurvey && survey && (
            <aside className="survey-note" aria-label="前回の旅全体のアンケート" data-export-exclude="true">
              <strong>前回の旅全体のアンケート</strong>
              <dl>
                {survey.satisfaction !== null && <div><dt>総合満足度</dt><dd>{survey.satisfaction}/5</dd></div>}
                {survey.goodPoints && <div><dt>良かった点</dt><dd>{survey.goodPoints}</dd></div>}
                {survey.previousCompanion && <div><dt>前回の同行者</dt><dd>{survey.previousCompanion}</dd></div>}
              </dl>
            </aside>
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

function InvitationPanel({ brochure, invitation, selected, spotsById, onCopy }: { brochure: Brochure; invitation: string; selected: BrochureItem[]; spotsById: Map<string, Spot>; onCopy: () => Promise<void> }) {
  return (
    <section className="invitation-panel" aria-labelledby="invitation-title">
      <div className="invitation-stamp" aria-hidden="true"><Stamp /></div>
      <div>
        <p className="brochure-overline">MESSAGE</p>
        <h2 id="invitation-title">{brochure.companion === '一人' ? '次の旅の紹介文' : '大切な人への招待文'}</h2>
        <p>{invitation}</p>
        <p className="invitation-stops">{selected.map((item) => spotsById.get(item.spotId)?.name).filter(Boolean).join(' → ')}</p>
      </div>
      <button data-export-exclude="true" className="button button-outline" onClick={() => void onCopy()}><Clipboard aria-hidden="true" />招待文をコピー</button>
    </section>
  );
}


function SpotReplaceDialog({ mode, itemId, brochure, spotsById, onClose, onChoose }: {
  mode: 'add' | 'replace'; itemId?: string; brochure: Brochure; spotsById: Map<string, Spot>; onClose: () => void; onChoose: (id: string) => void;
}) {
  const current = itemId ? brochure.items.find((item) => item.id === itemId) : undefined;
  const dialogRef = useDialogFocus(onClose);
  const choices = brochure.items.filter((item) => !item.selected && item.kind === 'candidate');
  return (
    <div className="dialog-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section ref={dialogRef} tabIndex={-1} className="dialog replace-dialog" role="dialog" aria-modal="true" aria-labelledby="replace-title">
        <button className="icon-button dialog-close" aria-label={mode === 'add' ? '候補追加を閉じる' : '候補変更を閉じる'} onClick={onClose}><X aria-hidden="true" /></button>
        <p className="eyebrow">SPOT CHANGE</p>
        <h2 id="replace-title">{mode === 'add' ? '候補を追加' : 'この候補を変更'}</h2>
        <p className="dialog-intro">{mode === 'add'
          ? '旅の最後に追加する場所を選んでください。候補は10件まで追加できます。'
          : `「${current ? spotsById.get(current.spotId)?.name : '現在の候補'}」と入れ替える場所を選んでください。外した場所の写真やコメントは削除しません。`}</p>
        <div className="replace-list">
          {choices.map((item) => {
            const spot = spotsById.get(item.spotId);
            if (!spot) return null;
            return (
              <button key={item.id} className="replace-option" onClick={() => onChoose(item.id)}>
                <span className="replace-thumb">{spot.image ? <img src={spot.image} alt="" /> : <ImageIcon aria-hidden="true" />}</span>
                <span><strong>{spot.name}</strong><small>{spot.category}</small><p>{spot.description}</p></span>
                <ChevronRight aria-hidden="true" />
              </button>
            );
          })}
          {choices.length === 0 && <p className="empty-message">ほかの候補がありません。「旅の条件を変更」から一括で作り直してください。</p>}
        </div>
      </section>
    </div>
  );
}
