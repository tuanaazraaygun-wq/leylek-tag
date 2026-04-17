import { getPersistedAccessToken } from './sessionToken';
import { notifyAuthTokenBecameAvailableForSocket } from './socketRegisterScheduler';

/**
 * After `persistAccessToken`, confirm storage is readable then notify socket layer.
 * Call only from auth/login flows (not cold boot).
 */
export async function afterAuthAccessTokenPersisted(userId: string | null | undefined): Promise<void> {
  const token = await getPersistedAccessToken();
  if (!token || !userId) return;
  console.log('AUTH_TOKEN_PERSISTED', { hasToken: true, userId });
  notifyAuthTokenBecameAvailableForSocket();
}
