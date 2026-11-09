export async function shareRequest<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, { credentials: 'same-origin', ...init,
    headers: { 'Content-Type': 'application/json', ...(init.method ? { 'X-Requested-With': 'kondo' } : {}), ...init.headers } });
  const value = await response.json().catch(() => null);
  if (!response.ok) throw new Error(value?.error?.message ?? '共有情報を取得できませんでした。もう一度お試しください。');
  return value as T;
}
