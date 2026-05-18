"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { PostgrestError, Session, SupabaseClient } from "@supabase/supabase-js";
import { UserOnboardingModal } from "@/components/user-onboarding-modal";
import { getWebsiteOAuthRedirectToHome } from "@/lib/site-origin";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase-client";
import { isUserSiteProfileIncomplete, type UserSiteProfileRow } from "@/lib/user-site-profile";

type SiteAuthContextValue = {
  authReady: boolean;
  configured: boolean;
  session: Session | null;
  profile: UserSiteProfileRow | null;
  navLabel: string;
  oauthBusy: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const SiteAuthContext = createContext<SiteAuthContextValue | null>(null);

export function useSiteAuth(): SiteAuthContextValue {
  const ctx = useContext(SiteAuthContext);
  if (!ctx) throw new Error("useSiteAuth yalnızca SiteAuthProvider içinde kullanılmalıdır.");
  return ctx;
}

async function fetchUserProfile(client: SupabaseClient, uid: string): Promise<UserSiteProfileRow | null> {
  const { data, error } = await client
    .from("user_profiles")
    .select("id,email,full_name,city,created_at,updated_at")
    .eq("id", uid)
    .maybeSingle();
  if (error) {
    console.error("[user_profiles] select failed:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return null;
  }
  return data as UserSiteProfileRow | null;
}

function assertHttpRedirect(candidate: string): boolean {
  try {
    const u = new URL(candidate);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

const ONBOARDING_SAVE_ERROR_TR = "Kayıt tamamlanamadı. Lütfen tekrar dene.";
const PROFILE_SYSTEM_NOT_READY_TR = "Profil sistemi henüz hazır değil.";

function isLikelyMissingUserProfilesTable(error: PostgrestError): boolean {
  const msg = `${error.message ?? ""} ${error.details ?? ""} ${error.hint ?? ""}`.toLowerCase();
  const code = error.code ?? "";
  if (
    code === "42P01" ||
    code.startsWith("PGRST205") ||
    code.startsWith("PGRST302") ||
    /schema cache/i.test(msg) ||
    /\bundefined table\b|\bcould not find the table\b/i.test(msg) ||
    /\brelation\b.*\buser_profiles\b.*\bdoes not exist\b/i.test(msg) ||
    /\bdoes not exist\b.*\buser_profiles\b/i.test(msg)
  ) {
    return true;
  }
  return false;
}

function onboardingUpsertUiMessage(error: PostgrestError): string {
  if (isLikelyMissingUserProfilesTable(error)) {
    return PROFILE_SYSTEM_NOT_READY_TR;
  }
  const raw = `${error.message ?? ""}`.trim();
  return raw.length > 0 ? raw : ONBOARDING_SAVE_ERROR_TR;
}

export function SiteAuthProvider({ children }: { children: ReactNode }) {
  const configured = useMemo(() => isSupabaseConfigured(), []);
  const client = useMemo(() => (configured ? getSupabaseBrowserClient() : null), [configured]);

  const [authReady, setAuthReady] = useState(() => !configured);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserSiteProfileRow | null>(null);
  const [profileBusy, setProfileBusy] = useState(false);
  const [oauthBusy, setOauthBusy] = useState(false);
  const [onboardingSaving, setOnboardingSaving] = useState(false);
  const [onboardingError, setOnboardingError] = useState<string | null>(null);

  const refreshProfileFromSession = useCallback(
    async (s: Session | null) => {
      if (!client) {
        setProfile(null);
        return;
      }
      const uid = s?.user.id;
      if (!uid) {
        setProfile(null);
        return;
      }
      setProfileBusy(true);
      try {
        const row = await fetchUserProfile(client, uid);
        setProfile(row);
      } finally {
        setProfileBusy(false);
      }
    },
    [client],
  );

  useEffect(() => {
    if (!configured || !client) return;

    const supabase = client;
    let cancelled = false;

    async function boot() {
      const {
        data: { session: initial },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      setSession(initial);
      await refreshProfileFromSession(initial ?? null);
      if (!cancelled) setAuthReady(true);
    }

    void boot();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      void (async () => {
        setSession(next);
        setOnboardingError(null);
        await refreshProfileFromSession(next);
      })();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [configured, client, refreshProfileFromSession]);

  const signInWithGoogle = useCallback(async () => {
    if (!client) return;

    const redirectTo = getWebsiteOAuthRedirectToHome();
    if (!assertHttpRedirect(redirectTo)) {
      return;
    }

    setOauthBusy(true);
    try {
      const { error } = await client.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          skipBrowserRedirect: false,
          queryParams: { prompt: "select_account" },
        },
      });
      if (error) {
        setOauthBusy(false);
      }
    } catch {
      setOauthBusy(false);
    }
  }, [client]);

  const signOut = useCallback(async () => {
    if (!client) return;
    await client.auth.signOut();
    setProfile(null);
    setOnboardingError(null);
  }, [client]);

  const handleOnboardingSubmit = useCallback(
    async (fullName: string, cityValue: string) => {
      if (!client || !session?.user.id) return;
      const email = session.user.email ?? null;

      setOnboardingSaving(true);
      setOnboardingError(null);

      try {
        const payload = {
          id: session.user.id,
          email,
          full_name: fullName,
          city: cityValue,
        };

        const { error } = await client.from("user_profiles").upsert(payload, {
          onConflict: "id",
        });

        if (error) {
          console.error("[user_profiles] upsert failed:", {
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint,
            payloadPreview: {
              id: session.user.id,
              email: payload.email ?? null,
              fullNameLen: fullName.length,
              cityLen: cityValue.length,
            },
          });
          setOnboardingError(onboardingUpsertUiMessage(error));
          return;
        }

        await refreshProfileFromSession(session);
      } finally {
        setOnboardingSaving(false);
      }
    },
    [client, refreshProfileFromSession, session],
  );

  const navLabel = useMemo(() => {
    if (!session?.user) return "";
    const n = profile?.full_name?.trim();
    if (n) return n.length > 32 ? `${n.slice(0, 30)}…` : n;
    const localPart = session.user.email?.split("@")[0]?.trim();
    return localPart?.length ? localPart.slice(0, 24) : "Hesap";
  }, [session, profile]);

  const showOnboardingModal = Boolean(
    configured &&
      client &&
      authReady &&
      session?.user?.id &&
      !profileBusy &&
      isUserSiteProfileIncomplete(profile),
  );

  const value = useMemo<SiteAuthContextValue>(
    () => ({
      authReady,
      configured,
      session,
      profile,
      navLabel,
      oauthBusy,
      signInWithGoogle,
      signOut,
    }),
    [authReady, configured, session, profile, navLabel, oauthBusy, signInWithGoogle, signOut],
  );

  return (
    <SiteAuthContext.Provider value={value}>
      {children}
      <UserOnboardingModal
        open={showOnboardingModal}
        userEmail={session?.user?.email}
        submitting={onboardingSaving}
        formError={onboardingError}
        onSubmit={handleOnboardingSubmit}
      />
    </SiteAuthContext.Provider>
  );
}
