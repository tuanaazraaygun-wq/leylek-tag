/**
 * Supabase Auth session from backend-issued tokens (verify-otp / login payloads).
 */

import { getSupabase } from './supabase';

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
