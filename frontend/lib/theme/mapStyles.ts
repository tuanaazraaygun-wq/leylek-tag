/**
 * LiveMap Google Maps custom styles — dark cockpit only.
 * Light journey scope uses Google default (customMapStyle undefined).
 */

/** Premium dark cockpit — cyan route contrast; traffic layer stays on. */
export const DARK_MAP_STYLE = [
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#101A2B' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#0F1728' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry', stylers: [{ color: '#121C2E' }] },
  { featureType: 'landscape.natural.landcover', elementType: 'geometry', stylers: [{ color: '#0E1624' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#081A2A' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#7A93B0' }, { visibility: 'simplified' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1E2A3D' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#0B1220' }, { weight: 0.6 }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#283549' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#101A2B' }, { weight: 0.55 }] },
  { featureType: 'road.highway.controlled_access', elementType: 'geometry', stylers: [{ color: '#2C3A4E' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#232F41' }] },
  { featureType: 'road.local', elementType: 'geometry', stylers: [{ color: '#1A2636' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#BAC9DE' }] },
  { featureType: 'road', elementType: 'labels.text.stroke', stylers: [{ color: '#08111F' }, { weight: 2.5 }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#101A2B' }, { visibility: 'simplified' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#1E3A5F' }, { weight: 0.35 }] },
  { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#1E3A5F' }, { weight: 0.55 }] },
  { featureType: 'administrative.province', elementType: 'geometry.stroke', stylers: [{ color: '#162949' }, { weight: 0.35 }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#BAC9DE' }] },
  { featureType: 'administrative.neighborhood', elementType: 'labels.text.fill', stylers: [{ color: '#9AAFC9' }] },
  { featureType: 'all', elementType: 'labels.text.fill', stylers: [{ color: '#BAC9DE' }] },
  { featureType: 'all', elementType: 'labels.text.stroke', stylers: [{ color: '#08111F' }, { weight: 3 }] },
  { featureType: 'all', elementType: 'labels.icon', stylers: [{ saturation: -35 }, { lightness: 8 }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#0F1829' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
] as const;
