/**
 * Singleton socket reconnect / foreground sonrası Muhabbet vb. ekranların
 * register+join yenilemesi için hafif pub/sub (çift socket açmadan).
 */

type RefreshReason = string;

type Listener = (reason: RefreshReason) => void;

const listeners = new Set<Listener>();

export function subscribeSocketSessionRefresh(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function publishSocketSessionRefresh(reason: RefreshReason): void {
  listeners.forEach((fn) => {
    try {
      fn(reason);
    } catch (e) {
      console.warn('[socket] session refresh listener error', reason, e);
    }
  });
}
