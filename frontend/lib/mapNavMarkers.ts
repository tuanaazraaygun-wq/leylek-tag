/**
 * Canlı harita / teklif / bekleme ekranlarında aynı PNG marker seti (LiveMapView ile uyumlu).
 */

export const NAV_MARKER_IMG = {
  /**
   * Kuşbakışı sürücü ikonları: burn / ön teker görüntünün alt kenarına (ekran +Y).
   * Google Marker.rotation’da bitmap üstü = kuzey @0° → `DRIVER_NAV_ROTATION_OFFSET_DEG` ile hizalanır.
   * Görsel inceleme (2026): car ve motor aynı eksende; ikisi de +180°.
   */
  driverCar: require('../assets/markers/driver-car.png'),
  driverMotor: require('../assets/markers/driver-motor.png'),
  passengerWoman: require('../assets/markers/passenger-woman.png'),
  passengerMan: require('../assets/markers/passenger-man.png'),
} as const;

/**
 * Haritada PNG’lerin görüntü boyutu (native `image` tam çözünürlük kullanır; Image+width ile küçültülür).
 * Sürücü araç en baskın; motor < araç; yolcu biraz daha küçük.
 */
export const MARKER_PIXEL = {
  driverCar: 32,
  driverMotor: 28,
  passenger: 30,
} as const;

export function getPassengerMarkerImage(
  gender: 'female' | 'male' | null | undefined,
  fallbackUserId?: string | null,
): number {
  if (gender === 'female') return NAV_MARKER_IMG.passengerWoman;
  if (gender === 'male') return NAV_MARKER_IMG.passengerMan;
  if (fallbackUserId) {
    let s = 0;
    for (let i = 0; i < fallbackUserId.length; i++) s += fallbackUserId.charCodeAt(i);
    return s % 2 === 0 ? NAV_MARKER_IMG.passengerWoman : NAV_MARKER_IMG.passengerMan;
  }
  return NAV_MARKER_IMG.passengerWoman;
}

export function getDriverMarkerImage(vehicleKind: 'car' | 'motorcycle'): number {
  return vehicleKind === 'motorcycle' ? NAV_MARKER_IMG.driverMotor : NAV_MARKER_IMG.driverCar;
}

/** Nav haritasında `Marker.flat` + rota bearing için */
export type DriverNavMapVehicleKind = 'car' | 'motorcycle';

/**
 * Bearing (kuzeyden saat yönü °) + bu offset = Marker.rotation.
 * Car / motor PNG aynı yönde çizildiği için değer aynı; ayrı sabitler ileride farklı asset için.
 */
export const DRIVER_NAV_ROTATION_OFFSET_DEG: Record<DriverNavMapVehicleKind, number> = {
  car: 180,
  motorcycle: 180,
};

export function getDriverNavRotationOffsetDeg(kind: DriverNavMapVehicleKind): number {
  return DRIVER_NAV_ROTATION_OFFSET_DEG[kind];
}

/**
 * flat marker anchor (0–1): şasi / iz düşümü şeride otursun.
 * Araba: biraz daha uzun kaput → y biraz aşağı; motor: sürücü gövdesi daha kompakt → hafif yukarı.
 */
export const DRIVER_NAV_MARKER_ANCHOR: Record<DriverNavMapVehicleKind, { x: number; y: number }> = {
  car: { x: 0.5, y: 0.54 },
  motorcycle: { x: 0.5, y: 0.53 },
};

export function getDriverNavMarkerAnchor(kind: DriverNavMapVehicleKind): { x: number; y: number } {
  return DRIVER_NAV_MARKER_ANCHOR[kind];
}
