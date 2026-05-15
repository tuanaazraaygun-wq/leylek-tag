/**
 * Mağaza/reviewer demo hatları (5321111111 / 5322222222) yalnızca açık yapılandırma ile etkindir.
 * Production: EXPO_PUBLIC_ENABLE_DEMO_REVIEWER_LOGIN=1 (EAS env) veya app.json extra.enableDemoReviewerLogin.
 */
import Constants from 'expo-constants';

export function isDemoReviewerLoginEnabled(): boolean {
  const env = String(process.env.EXPO_PUBLIC_ENABLE_DEMO_REVIEWER_LOGIN ?? '').trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(env)) return true;

  const extra = Constants.expoConfig?.extra as { enableDemoReviewerLogin?: string | boolean } | undefined;
  const ex = extra?.enableDemoReviewerLogin;
  if (ex === true) return true;
  if (typeof ex === 'string' && ['1', 'true', 'yes', 'on'].includes(ex.trim().toLowerCase())) return true;

  return false;
}

/** 10 hane, 5 ile başlayan Türkiye cep (loginPhoneToCleanTen çıktısı) */
export function isReviewerDemoLoginPhone(cleanTen: string): boolean {
  if (!isDemoReviewerLoginEnabled()) return false;
  return cleanTen === '5321111111' || cleanTen === '5322222222';
}
