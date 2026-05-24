import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export function normalizeAdminEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function getSupabaseServiceRoleClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type KycAdminIdentity = {
  email: string;
  authUid: string;
};

/** API route: Bearer access token + admin_users doğrulaması. */
export async function verifyKycAdminRequest(
  request: Request,
): Promise<KycAdminIdentity | NextResponse> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !anonKey || !serviceKey) {
    return NextResponse.json({ success: false, error: "server_misconfigured" }, { status: 503 });
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) {
    return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401 });
  }

  const authClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userErr } = await authClient.auth.getUser(token);
  const rawEmail = userData.user?.email;
  if (userErr || !rawEmail) {
    return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401 });
  }

  const email = normalizeAdminEmail(rawEmail);
  const service = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: adminRow, error: adminErr } = await service
    .from("admin_users")
    .select("email")
    .eq("email", email)
    .maybeSingle();

  if (adminErr || !adminRow) {
    return NextResponse.json({ success: false, error: "forbidden" }, { status: 403 });
  }

  return { email, authUid: userData.user!.id };
}

/** Tarayıcı: oturum e-postası admin_users listesinde mi? */
export async function isEmailListedKycAdmin(
  supabase: SupabaseClient,
  email: string,
): Promise<boolean> {
  const normalized = normalizeAdminEmail(email);
  const { data, error } = await supabase
    .from("admin_users")
    .select("email")
    .eq("email", normalized)
    .maybeSingle();
  if (error) return false;
  return Boolean(data);
}
