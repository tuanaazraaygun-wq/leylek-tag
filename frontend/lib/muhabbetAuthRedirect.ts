import { Alert } from 'react-native';
import { router } from 'expo-router';

/**
 * Paralel Muhabbet isteklerinde birden fazla 401 → tek Alert / tek replace.
 * Kısa süre sonra sıfırlanır (yeniden giriş sonrası yeni 401 işlenebilsin).
 */
let muhabbet401Handling = false;
let muhabbet401ResetTimer: ReturnType<typeof setTimeout> | null = null;
const MUHABBET_401_RESET_MS = 4000;

/** 401 yanıtında ana ekrana dön (giriş akışı). true = 401 (ilk seferde işlendi veya zaten işleniyor). */
export function handleUnauthorizedAndMaybeRedirect(res: Response): boolean {
  if (res.status !== 401) return false;
  if (muhabbet401Handling) {
    return true;
  }
  muhabbet401Handling = true;
  if (muhabbet401ResetTimer != null) {
    clearTimeout(muhabbet401ResetTimer);
    muhabbet401ResetTimer = null;
  }
  muhabbet401ResetTimer = setTimeout(() => {
    muhabbet401Handling = false;
    muhabbet401ResetTimer = null;
  }, MUHABBET_401_RESET_MS);

  Alert.alert('Oturum', 'Oturumunuz sona ermiş olabilir. Lütfen tekrar giriş yapın.');
  try {
    router.replace('/');
  } catch {
    /* noop */
  }
  return true;
}
