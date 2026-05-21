import { Platform } from 'react-native';

let initialized = false;

const SENSITIVE_ATTR_RE =
  /phone|token|jwt|fcm|agora|latitude|longitude|password|secret|authorization|bearer|push_token|refresh_token|access_token|channel_name/i;

function anonymizeUserId(raw: string | null | undefined): string | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  if (s.length <= 8) return `u_${s.slice(-4)}`;
  return `u_${s.slice(0, 4)}_${s.slice(-4)}`;
}

/** Production-safe Crashlytics bootstrap — no-op on web / Expo Go. */
export async function initCrashlytics(): Promise<void> {
  if (initialized || Platform.OS === 'web') return;
  initialized = true;
  try {
    const crashlytics = (await import('@react-native-firebase/crashlytics')).default;
    await crashlytics().setCrashlyticsCollectionEnabled(!__DEV__);
  } catch {
    /* @react-native-firebase/crashlytics unavailable */
  }
}

/** Anonymized user id only — never pass phone, JWT, or raw UUID for logging. */
export function setCrashlyticsUserId(userId: string | null | undefined): void {
  const anon = anonymizeUserId(userId);
  if (Platform.OS === 'web') return;
  void (async () => {
    try {
      const crashlytics = (await import('@react-native-firebase/crashlytics')).default;
      await crashlytics().setUserId(anon ?? '');
    } catch {
      /* noop */
    }
  })();
}

export function recordCrashlyticsError(
  error: unknown,
  context?: Record<string, string>,
): void {
  if (Platform.OS === 'web') return;
  void (async () => {
    try {
      const crashlytics = (await import('@react-native-firebase/crashlytics')).default;
      const err = error instanceof Error ? error : new Error(String(error));
      if (context) {
        for (const [key, value] of Object.entries(context)) {
          if (SENSITIVE_ATTR_RE.test(key)) continue;
          await crashlytics().setAttribute(String(key).slice(0, 32), String(value).slice(0, 128));
        }
      }
      await crashlytics().recordError(err);
    } catch {
      /* noop */
    }
  })();
}

/** DEV-only non-fatal smoke test — does not call crash(). */
export function devCrashlyticsNonFatalTest(): void {
  if (!__DEV__) return;
  recordCrashlyticsError(new Error('DEV Crashlytics non-fatal test'), {
    source: 'devCrashlyticsNonFatalTest',
  });
}
