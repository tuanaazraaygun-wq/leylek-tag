/**
 * Canlı harita / teklif / bekleme ekranlarında aynı PNG marker seti (LiveMapView ile uyumlu).
 */

export const NAV_MARKER_IMG = {
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
