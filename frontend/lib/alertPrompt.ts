import { Alert, Platform } from 'react-native';

/**
 * `Alert.prompt` is iOS-only; on Android it is typically `undefined`.
 * Never call it without `typeof ... === 'function'` (Hermes: "undefined is not a function").
 */
export function isAlertPromptCallable(): boolean {
  const prompt = (Alert as { prompt?: unknown }).prompt;
  return Platform.OS === 'ios' && typeof prompt === 'function';
}

/** @returns true if prompt was invoked */
export function callAlertPrompt(
  title: string,
  message: string,
  callbackOrButtons: unknown,
  type?: unknown,
  defaultValue?: unknown,
  keyboardType?: unknown,
): boolean {
  const prompt = (Alert as { prompt?: (...args: unknown[]) => void }).prompt;
  if (typeof prompt !== 'function') {
    return false;
  }
  try {
    if (keyboardType !== undefined) {
      prompt(title, message, callbackOrButtons, type, defaultValue, keyboardType);
    } else if (defaultValue !== undefined) {
      prompt(title, message, callbackOrButtons, type, defaultValue);
    } else if (type !== undefined) {
      prompt(title, message, callbackOrButtons, type);
    } else {
      prompt(title, message, callbackOrButtons);
    }
    return true;
  } catch (e) {
    if (__DEV__) {
      console.warn('[alertPrompt] call failed', e);
    }
    return false;
  }
}
