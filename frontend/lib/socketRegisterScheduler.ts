/** Bridges SocketProvider's scheduleSocketRegister to auth persistence (avoids circular imports). */

type ScheduleRegister = (reason: string) => void;

let scheduleImpl: ScheduleRegister | null = null;

export function setSocketRegisterScheduler(fn: ScheduleRegister | null): void {
  scheduleImpl = fn;
}

export function notifyAuthTokenBecameAvailableForSocket(): void {
  scheduleImpl?.('auth_token_became_available');
}
