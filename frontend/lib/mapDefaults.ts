export const DEFAULT_TR_MAP_FALLBACK_CENTER = {
  latitude: 39.92077,
  longitude: 32.85411,
};

/** Sürücü kokpit + eşleşme (idle/matched) — sabit sokak zoom; GPS/pin zoom değiştirmez. */
export const DRIVER_DEFAULT_STREET_ZOOM = 16.5;

/** initialRegion için yaklaşık delta (~DRIVER_DEFAULT_STREET_ZOOM). */
export function driverStreetLatDelta(): number {
  return 360 / Math.pow(2, DRIVER_DEFAULT_STREET_ZOOM);
}
