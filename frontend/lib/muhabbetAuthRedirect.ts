import { Alert } from 'react-native';
import { router } from 'expo-router';

/** 401 yanıtında ana ekrana dön (giriş akışı). true = yönlendirildi. */
export function handleUnauthorizedAndMaybeRedirect(res: Response): boolean {
  if (res.status !== 401) return false;
  Alert.alert('Oturum', 'Oturumunuz sona ermiş olabilir. Lütfen tekrar giriş yapın.');
  try {
    router.replace('/');
  } catch {
    /* noop */
  }
  return true;
}
