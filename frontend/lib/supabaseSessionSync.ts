/**
 * Supabase Auth session from backend-issued tokens (verify-otp / login payloads).
 */

import { getSupabase } from './supabase';

export async function syncSupabaseSessionFromBackendResponse(payload: any) {
  const supabase = getSupabase();
  if (!supabase) {
    console.log('NO SUPABASE CLIENT');
    return;
  }

  const access = payload?.supabase_access_token || payload?.supabaseAccessToken;

  const refresh = payload?.supabase_refresh_token || payload?.supabaseRefreshToken;

  console.log('SUPABASE TOKENS:', { access, refresh });

  if (!access || !refresh) {
    console.log('NO SUPABASE TOKENS FOUND');
    return;
  }

  const { data, error } = await supabase.auth.setSession({
    access_token: access,
    refresh_token: refresh,
  });

  console.log('SET SESSION RESULT:', { data, error });

  const { data: sess } = await supabase.auth.getSession();

  console.log('FINAL SESSION USER:', sess?.session?.user?.id);
}
