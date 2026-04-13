/** Geçici tanılama: hangi çağrının undefined olduğunu logcat'te görmek için. */
export function callCheck(label: string, fn: unknown): void {
  console.log('CALL_CHECK', label, typeof fn, fn);
  if (typeof fn !== 'function') {
    console.error('UNDEFINED_FN', label, fn);
  }
}
