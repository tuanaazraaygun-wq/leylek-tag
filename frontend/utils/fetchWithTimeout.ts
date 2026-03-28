/**
 * Açılış ve arka plan istekleri — sonsuz bekleyişi önler (splash / yükleme takılması).
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<Response | null> {
  const { timeoutMs = 8000, signal: outerSignal, ...rest } = init;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    if (outerSignal) {
      if (outerSignal.aborted) {
        return null;
      }
      outerSignal.addEventListener('abort', () => controller.abort(), { once: true });
    }
    return await fetch(url, { ...rest, signal: controller.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(id);
  }
}

export async function fetchJsonWithTimeout<T = unknown>(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<T | null> {
  const res = await fetchWithTimeout(url, init);
  if (!res?.ok) return null;
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
