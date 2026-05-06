/** Bridges SocketProvider's scheduleSocketRegister to auth persistence (avoids circular imports). */

export type SocketRegisterScheduleOpts = { force?: boolean };

type ScheduleRegister = (reason: string, opts?: SocketRegisterScheduleOpts) => void;

let scheduleImpl: ScheduleRegister | null = null;

export function setSocketRegisterScheduler(fn: ScheduleRegister | null): void {
  scheduleImpl = fn;
}

export function notifyAuthTokenBecameAvailableForSocket(): void {
  scheduleImpl?.('auth_token_became_available', { force: true });
}

/** Muhabbet vb. ekranlar — throttle uyarılı ensure (çoğu zaman skip olabilir). reconnect/foreground ayrı `force`. */
export function ensureSocketRegistered(reason: string, opts?: SocketRegisterScheduleOpts): void {
  scheduleImpl?.(reason, opts);
}
