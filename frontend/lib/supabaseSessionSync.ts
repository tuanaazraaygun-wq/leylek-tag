/**
 * Leylek backend JWT ≠ Supabase Auth. Storage RLS için gerçek Supabase oturumu gerekir:
 * backend yanıtında `supabase_access_token` + `supabase_refresh_token` geldiğinde setSession;
 * yoksa (opsiyonel) email/şifre ile signInWithPassword.
 */

import { getSupabase } from './supabase';

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/** Backend veya iç içe user/supabase nesnesinden Supabase oturum JWT’lerini topla */
function extractSupabaseTokens(raw: Record<string, unknown> | null | undefined): {
  access: string;
  refresh: string;
} | null {
  if (!raw) return null;
  const user = asRecord(raw.user);
  const nestedSb = asRecord(raw.supabase);
  const tokObj = asRecord(raw.tokens);

  const access =
    str(raw.supabase_access_token) ||
    str(raw.supabaseAccessToken) ||
    str(user?.supabase_access_token) ||
    str(user?.supabaseAccessToken) ||
    str(nestedSb?.access_token) ||
    str(nestedSb?.accessToken) ||
    str(tokObj?.supabase_access_token);

  const refresh =
    str(raw.supabase_refresh_token) ||
    str(raw.supabaseRefreshToken) ||
    str(user?.supabase_refresh_token) ||
    str(user?.supabaseRefreshToken) ||
    str(nestedSb?.refresh_token) ||
    str(nestedSb?.refreshToken) ||
    str(tokObj?.supabase_refresh_token);

  if (access && refresh) return { access, refresh };
  return null;
}

function extractEmailPassword(raw: Record<string, unknown> | null | undefined): {
  email: string;
  password: string;
} | null {
  if (!raw) return null;
  const user = asRecord(raw.user);
  const email =
    str(raw.email) ||
    str(user?.email);
  const password =
    str(raw.supabase_password) ||
    str(raw.password) ||
    str(user?.supabase_password) ||
    str(user?.password);
  if (email && password) return { email, password };
  return null;
}

/**
 * Login/register sonrası tam JSON gövdesini iletin (user + token alanları).
 * Başarılı setSession sonrası konsola SUPABASE SESSION loglar.
 */
export async function syncSupabaseSessionFromBackendResponse(
  raw: Record<string, unknown> | null | undefined
): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase || !raw) {
    const sb = getSupabase();
    if (sb) {
      const { data: sessionData } = await sb.auth.getSession();
      console.log('SUPABASE SESSION:', sessionData.session?.user?.id);
    }
    return false;
  }

  const pair = extractSupabaseTokens(raw);
  if (pair) {
    const { error } = await supabase.auth.setSession({
      access_token: pair.access,
      refresh_token: pair.refresh,
    });
    if (error) {
      console.warn('[supabase_session] setSession failed:', error.message);
      const fb = await trySignInWithPasswordFallback(raw);
      const { data: sessionData } = await supabase.auth.getSession();
      console.log('SUPABASE SESSION:', sessionData.session?.user?.id);
      return fb;
    }
    const { data: sessionData } = await supabase.auth.getSession();
    console.log('SUPABASE SESSION:', sessionData.session?.user?.id);
    return true;
  }

  const fb = await trySignInWithPasswordFallback(raw);
  const { data: sessionData } = await supabase.auth.getSession();
  console.log('SUPABASE SESSION:', sessionData.session?.user?.id);
  return fb;
}

async function trySignInWithPasswordFallback(raw: Record<string, unknown>): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const ep = extractEmailPassword(raw);
  if (!ep) {
    console.warn('[supabase_session] No Supabase tokens and no email/password for fallback');
    return false;
  }
  const { error } = await supabase.auth.signInWithPassword({
    email: ep.email,
    password: ep.password,
  });
  if (error) {
    console.warn('[supabase_session] signInWithPassword failed:', error.message);
    return false;
  }
  return true;
}
