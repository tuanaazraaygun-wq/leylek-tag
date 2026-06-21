/**
 * Canlı harita / teklif / bekleme ekranlarında aynı PNG marker seti (LiveMapView ile uyumlu).
 * B5.2 / B6-5 — brand geometry constitution exports.
 */

export const NAV_MARKER_IMG = {
  /**
   * Kuşbakışı sürücü ikonları: burn / ön teker görüntünün alt kenarına (ekran +Y).
   * Google Marker.rotation’da bitmap üstü = kuzey @0° → `DRIVER_NAV_ROTATION_OFFSET_DEG` ile hizalanır.
   */
  driverCar: require('../assets/markers/driver-car.png'),
  driverMotor: require('../assets/markers/driver-motor.png'),
  /** Gender-neutral silhouette — no male/female read @32px (B5.2 constitution). */
  passenger: require('../assets/markers/passenger-neutral.png'),
  pickup: require('../assets/markers/pickup.png'),
  destination: require('../assets/markers/destination.png'),
  journeyActive: require('../assets/markers/journey-active.png'),
  quickMatch: require('../assets/markers/quick-match.png'),
  trustNetwork: require('../assets/markers/trust-network.png'),
  trustedDriver: require('../assets/markers/trusted-driver.png'),
  cluster: require('../assets/markers/cluster.png'),
  offlineDriver: require('../assets/markers/offline-driver.png'),
  searchingPulse: require('../assets/markers/searching-pulse.png'),
} as const;

/**
 * Haritada PNG’lerin görüntü boyutu (native `image` tam çözünürlük kullanır).
 */
export const MARKER_PIXEL = {
  driverCar: 34,
  driverMotor: 30,
  passenger: 32,
} as const;

/** @deprecated Cinsiyet parametreleri yok sayılır — App Store 5.1.1 uyumu */
export function getPassengerMarkerImage(
  _gender?: 'female' | 'male' | null | undefined,
  _fallbackUserId?: string | null,
): number {
  return NAV_MARKER_IMG.passenger;
}

export function getDriverMarkerImage(vehicleKind: 'car' | 'motorcycle'): number {
  return vehicleKind === 'motorcycle' ? NAV_MARKER_IMG.driverMotor : NAV_MARKER_IMG.driverCar;
}

/** Nav haritasında `Marker.flat` + rota bearing için */
export type DriverNavMapVehicleKind = 'car' | 'motorcycle';

export const DRIVER_NAV_ROTATION_OFFSET_DEG: Record<DriverNavMapVehicleKind, number> = {
  car: 180,
  motorcycle: 180,
};

export function getDriverNavRotationOffsetDeg(kind: DriverNavMapVehicleKind): number {
  return DRIVER_NAV_ROTATION_OFFSET_DEG[kind];
}

export const DRIVER_NAV_MARKER_ANCHOR: Record<DriverNavMapVehicleKind, { x: number; y: number }> = {
  car: { x: 0.5, y: 0.54 },
  motorcycle: { x: 0.5, y: 0.53 },
};

export function getDriverNavMarkerAnchor(kind: DriverNavMapVehicleKind): { x: number; y: number } {
  return DRIVER_NAV_MARKER_ANCHOR[kind];
}
