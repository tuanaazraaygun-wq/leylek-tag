/**
 * RC-PERF-LOGS-1A — gate hot-path diagnostic logs in production.
 * Enabled when __DEV__ or EXPO_PUBLIC_ENABLE_PERF_DIAG=1.
 */
export const PERF_DIAG_ENABLED =
  __DEV__ || process.env.EXPO_PUBLIC_ENABLE_PERF_DIAG === '1';

export function perfLog(...args: unknown[]): void {
  if (PERF_DIAG_ENABLED) {
    console.log(...args);
  }
}

export function perfWarn(...args: unknown[]): void {
  if (PERF_DIAG_ENABLED) {
    console.warn(...args);
  }
}
