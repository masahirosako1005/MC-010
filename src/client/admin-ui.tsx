import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, CircleAlert, LoaderCircle, RefreshCw } from 'lucide-react';

export class AdminApiError extends Error {
  constructor(message: string, public code: string) { super(message); }
}
export async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, { credentials: 'same-origin', ...init, headers: {
    ...(init.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(init.method ? { 'X-Requested-With': 'kondo' } : {}), ...init.headers,
  } });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new AdminApiError(body?.error?.message ?? '読み込みに失敗しました。接続を確認して再試行してください。', body?.error?.code ?? 'unknown');
  return body as T;
}
export const date = (value: string | null) => value ? new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—';
export const number = (value: number) => value.toLocaleString('ja-JP');
export const scopeLabel = { all: 'すべて', organizer: '提供データ', fixture: 'デモデータ' };
export const sourceLabel = { organizer: '提供データ', fixture: 'デモ', town: '町で登録' };
export const durationLabel = { day: '日帰り', overnight: '一泊二日' };
export const styleLabel = { slow: 'ゆっくり', active: 'アクティブ' };
export const templateLabel = { colorful: 'カラフルな旅行パンフレット', postcard: 'ポストカード' };

export function useData<T>(url: string) {
  const [state, setState] = useState<{ url: string; data: T | null; error: string; loading: boolean }>({ url, data: null, error: '', loading: true });
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState({ url, data: null, error: '', loading: true });
    request<T>(url, { signal: controller.signal }).then(data => {
      if (!controller.signal.aborted) setState({ url, data, error: '', loading: false });
    }).catch(reason => {
      if (!controller.signal.aborted) setState({ url, data: null, error: reason instanceof Error ? reason.message : '読み込めませんでした。', loading: false });
    });
    return () => controller.abort();
  }, [url, version]);
  return { ...(state.url === url ? state : { data: null, error: '', loading: true }), reload: () => setVersion(value => value + 1) };
}

export function LoadState({ loading, error, retry }: { loading: boolean; error: string; retry: () => void }) {
  if (loading) return <div className="admin-load" role="status"><LoaderCircle className="spin" aria-hidden="true" />データを読み込んでいます</div>;
  if (error) return <div className="admin-error" role="alert"><CircleAlert aria-hidden="true" /><span>{error}</span><button className="button button-outline" onClick={retry}>再試行</button></div>;
  return null;
}
export function Metric({ label, value, unit, detail }: { label: string; value: string; unit: string; detail: string }) {
  return <section className="admin-metric"><h2>{label}</h2><p><strong>{value}</strong><span>{unit}</span></p><small>{detail}</small></section>;
}

export function DetailHeader({ title, onBack, backLabel, onRefresh, loading }: {
  title: string; onBack: () => void; backLabel: string; onRefresh: () => void; loading: boolean;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: 'instant' }); }, []);
  return <header className="admin-detail-heading"><button className="button button-outline" onClick={onBack}><ArrowLeft aria-hidden="true" />{backLabel}</button>
    <div><h2 ref={heading} tabIndex={-1}>{title}</h2><p>現在保存されている内容を表示しています。</p></div>
    <button className="button" disabled={loading} onClick={onRefresh}><RefreshCw aria-hidden="true" />最新情報に更新</button></header>;
}

// 一覧をhiddenで保持し、戻る際は呼出しボタンとスクロール位置を復元する。
export function useDrilldown() {
  const [id, setId] = useState<string | null>(null);
  const origin = useRef<{ button: HTMLButtonElement; y: number } | null>(null);
  return { id, open: (nextId: string, button: HTMLButtonElement) => { origin.current = { button, y: window.scrollY }; setId(nextId); },
    close: () => { setId(null); requestAnimationFrame(() => { origin.current?.button.focus({ preventScroll: true }); window.scrollTo({ top: origin.current?.y ?? 0, behavior: 'instant' }); }); } };
}
