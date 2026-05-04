/**
 * Supabase Auth session from backend-issued tokens (verify-otp / login payloads).
 */

import { getPersistedAccessToken, persistAccessToken } from './sessionToken';
import { getSupabase } from './supabase';

/**
 * Leylek JWT ile POST /auth/supabase-session/refresh — AsyncStorage'da Supabase çifti yoksa veya süresi geçmişse.
 */
export async function repairSupabaseSessionWithBackendRefresh(apiBase: string): Promise<boolean> {
  const base = apiBase.replace(/\/$/, '');
  const jwt = (await getPersistedAccessToken())?.trim();
  if (!jwt) {
    return false;
  }
  try {
    const r = await fetch(`${base}/auth/supabase-session/refresh`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: 'application/json',
      },
    });
    const j = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    const ok =
      r.ok &&
      j.success === true &&
      typeof j.supabase_access_token === 'string' &&
      typeof j.supabase_refresh_token === 'string';
    if (!ok) {
      return false;
    }
    await persistAccessToken({
      access_token: jwt,
      supabase_access_token: String(j.supabase_access_token),
      supabase_refresh_token: String(j.supabase_refresh_token),
    });
    await syncSupabaseSessionFromBackendResponse(j);
    return true;
  } catch {
    return false;
  }
}

export async function syncSupabaseSessionFromBackendResponse(payload: any) {
  const supabase = getSupabase();
  if (!supabase) {
    console.log('[supabase_session_sync] no client');
    return;
  }

  const access = payload?.supabase_access_token || payload?.supabaseAccessToken;

  const refresh = payload?.supabase_refresh_token || payload?.supabaseRefreshToken;

  const accessLen = typeof access === 'string' ? access.length : 0;
  const refreshLen = typeof refresh === 'string' ? refresh.length : 0;
  console.log('[supabase_session_sync]', {
    hasAccess: !!access,
    hasRefresh: !!refresh,
    accessLen,
    refreshLen,
  });

  if (!access || !refresh) {
    console.log('[supabase_session_sync] missing tokens in payload');
    return;
  }

  const { error } = await supabase.auth.setSession({
    access_token: access,
    refresh_token: refresh,
  });

  if (error) {
    console.warn('[supabase_session_sync] setSession error', error.message);
  }

  const { data: sess } = await supabase.auth.getSession();

  console.log('[supabase_session_sync] session user id', sess?.session?.user?.id ?? null);
}
