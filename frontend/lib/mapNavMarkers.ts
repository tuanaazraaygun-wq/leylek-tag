/**
 * Canlı harita / teklif / bekleme ekranlarında aynı PNG marker seti (LiveMapView ile uyumlu).
 */

export const NAV_MARKER_IMG = {
  /**
   * Kuşbakışı sürücü ikonları: burn / ön teker görüntünün alt kenarına (ekran +Y).
   * Google Marker.rotation’da bitmap üstü = kuzey @0° → `DRIVER_NAV_ROTATION_OFFSET_DEG` ile hizalanır.
   */
  driverCar: require('../assets/markers/driver-car.png'),
  driverMotor: require('../assets/markers/driver-motor.png'),
  /** Tek nötr yolcu ikonu — cinsiyet / kullanıcı id tahmini yok */
  passenger: require('../assets/markers/passenger-woman.png'),
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
