/**
 * Muhabbet teklif oluşturma — konum, taban ücret, doğrulamalar (premium UI).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeaderGradient } from './ScreenHeaderGradient';
import { GradientButton } from './GradientButton';
import { handleUnauthorizedAndMaybeRedirect } from '../lib/muhabbetAuthRedirect';
import { API_BASE_URL } from '../lib/backendConfig';
import { getPersistedAccessToken, getPersistedUserRaw } from '../lib/sessionToken';
import MuhabbetEndpointPickerModal, {
  muhabbetListingMapPinFlowAvailable,
  reverseGeocodeTr,
  type MuhabbetCommittedPlace,
} from './MuhabbetEndpointPickerModal';
import { isLatLngWithinRegisteredCity } from './PlacesAutocomplete';

const HEADER_GRAD = ['#1e3a5f', '#3B82F6'] as const;
const SCREEN_BG = '#0c1524';
const CARD_BG = '#FFFFFF';
const ACCENT_ORANGE = '#EA580C';
const ACCENT_ORANGE_SOFT = '#F97316';
const TEXT_PRIMARY = '#0f172a';
const TEXT_SECONDARY = '#64748b';
const TEXT_MUTED = '#94a3b8';

const CAR_BRANDS = [
  'BMW',
  'Mercedes',
  'Audi',
  'Volkswagen',
  'Fiat',
  'Renault',
  'Toyota',
  'Honda',
  'Hyundai',
  'Peugeot',
  'Opel',
  'Ford',
] as const;

function authHeader(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

function shouldUseLegacyListingCreate(status: number): boolean {
  return status === 404 || status === 405 || status === 501;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addLocalDays(base: Date, n: number): Date {
  const x = new Date(base);
  x.setDate(x.getDate() + n);
  return startOfLocalDay(x);
}

type DepartureTab = 'today' | 'tomorrow' | 'future';
type ListingScope = 'local' | 'intercity';
type CityPickerField = 'origin' | 'destination';

function defaultDepartureHm(): { h: number; m: number } {
  const d = new Date();
  d.setMinutes(d.getMinutes() + 50, 0, 0);
  return { h: d.getHours(), m: Math.round(d.getMinutes() / 5) * 5 % 60 };
}

function buildDepartureIso(tab: DepartureTab, futureDay: Date | null, h: number, m: number): string {
  const now = new Date();
  let base: Date;
  if (tab === 'today') {
    base = startOfLocalDay(now);
  } else if (tab === 'tomorrow') {
    base = addLocalDays(now, 1);
  } else {
    base = futureDay ? startOfLocalDay(futureDay) : addLocalDays(now, 2);
  }
  let d = new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m, 0, 0);
  if (d.getTime() <= now.getTime() + 5 * 60 * 1000) {
    d = new Date(d.getTime() + 24 * 60 * 60 * 1000);
  }
  return d.toISOString();
}

const TR_MONTHS = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
];

const TR_CITIES = [
  'Adana', 'Adıyaman', 'Afyonkarahisar', 'Ağrı', 'Aksaray', 'Amasya', 'Ankara', 'Antalya',
  'Ardahan', 'Artvin', 'Aydın', 'Balıkesir', 'Bartın', 'Batman', 'Bayburt', 'Bilecik',
  'Bingöl', 'Bitlis', 'Bolu', 'Burdur', 'Bursa', 'Çanakkale', 'Çankırı', 'Çorum',
  'Denizli', 'Diyarbakır', 'Düzce', 'Edirne', 'Elazığ', 'Erzincan', 'Erzurum', 'Eskişehir',
  'Gaziantep', 'Giresun', 'Gümüşhane', 'Hakkari', 'Hatay', 'Iğdır', 'Isparta', 'İstanbul',
  'İzmir', 'Kahramanmaraş', 'Karabük', 'Karaman', 'Kars', 'Kastamonu', 'Kayseri', 'Kırıkkale',
  'Kırklareli', 'Kırşehir', 'Kilis', 'Kocaeli', 'Konya', 'Kütahya', 'Malatya', 'Manisa',
  'Mardin', 'Mersin', 'Muğla', 'Muş', 'Nevşehir', 'Niğde', 'Ordu', 'Osmaniye',
  'Rize', 'Sakarya', 'Samsun', 'Siirt', 'Sinop', 'Sivas', 'Şanlıurfa', 'Şırnak',
  'Tekirdağ', 'Tokat', 'Trabzon', 'Tunceli', 'Uşak', 'Van', 'Yalova', 'Yozgat', 'Zonguldak',
] as const;

function formatDepartureSummary(tab: DepartureTab, futureDay: Date | null, h: number, m: number): string {
  const hm = `${pad2(h)}:${pad2(m)}`;
  if (tab === 'today') return `Bugün ${hm}`;
  if (tab === 'tomorrow') return `Yarın ${hm}`;
  if (futureDay) {
    const dd = futureDay.getDate();
    const mo = TR_MONTHS[futureDay.getMonth()];
    return `${dd} ${mo} ${hm}`;
  }
  return hm;
}

function futureDayOptions(from: Date, count: number): Date[] {
  const out: Date[] = [];
  let d = addLocalDays(from, 2);
  for (let i = 0; i < count; i++) {
    out.push(new Date(d));
    d = addLocalDays(d, 1);
  }
  return out;
}

function userSubmitFailureMessage(): string {
  return 'Teklif oluşturulamadı. Lütfen tekrar deneyin.';
}

function detailFromMuhabbetCreateJson(d: unknown): string | null {
  if (!d || typeof d !== 'object') return null;
  const det = (d as { detail?: unknown }).detail;
  if (typeof det === 'string' && det.trim()) return det.trim();
  if (Array.isArray(det) && det.length > 0) {
    const first = det[0];
    if (first && typeof first === 'object' && 'msg' in first) {
      const m = (first as { msg?: unknown }).msg;
      if (typeof m === 'string' && m.trim()) return m.trim();
    }
  }
  return null;
}

/** İstekler FastAPI /api altında; yanlışlıkla origin kökü verilmişse /api ekle (localhost hariç). */
function ensureApiPathPrefix(baseUrl: string): string {
  let s = String(baseUrl || '').trim().replace(/\/$/, '');
  if (!s) return s;
  if (/\/api$/i.test(s)) return s;
  if (/localhost|127\.0\.0\.1/i.test(s)) return s;
  console.warn('[muhabbet-create] api kökünde /api yok, ekleniyor (önce):', s);
  return `${s}/api`.replace(/\/$/, '');
}

function hasFiniteCoords(p: MuhabbetCommittedPlace | null): boolean {
  if (!p) return false;
  return Number.isFinite(p.latitude) && Number.isFinite(p.longitude);
}

function parsePositiveIntText(text: string): number | null {
  const n = parseInt(String(text || '').replace(/\D/g, ''), 10);
  return !Number.isNaN(n) && n > 0 ? n : null;
}

function roundToNearestTen(value: number): number {
  return Math.max(0, Math.round(value / 10) * 10);
}

function calculateIntercitySuggestedPrice(params: {
  distanceKm: number;
  createRole: 'driver' | 'passenger';
  seatsText: string;
  passengerCountText: string;
}): number {
  const fuelLitersPer100Km = 7;
  const fuelPricePerLiter = 45;
  const totalFuelCost = (params.distanceKm / 100) * fuelLitersPer100Km * fuelPricePerLiter;
  const enteredCount =
    params.createRole === 'driver'
      ? parsePositiveIntText(params.seatsText)
      : parsePositiveIntText(params.passengerCountText);
  const sharingPeople = Math.max(3, (enteredCount ?? 2) + 1);
  return roundToNearestTen(totalFuelCost / sharingPeople);
}

export type CreateListingModalProps = {
  visible: boolean;
  onClose: () => void;
  apiUrl: string;
  accessToken: string;
  city: string;
  initialRole: 'driver' | 'passenger';
  initialScope?: ListingScope;
  requireToken: () => boolean;
  onCreated?: () => void;
};

export default function CreateListingModal({
  visible,
  onClose,
  apiUrl,
  accessToken,
  city,
  initialRole,
  initialScope = 'local',
  requireToken,
  onCreated,
}: CreateListingModalProps) {
  const tok = accessToken.trim();
  const base = useMemo(() => {
    const raw = (apiUrl || '').trim();
    const resolved = raw || API_BASE_URL;
    if (!raw) {
      console.warn('[muhabbet-create] apiUrl boş — API_BASE_URL kullanılıyor:', API_BASE_URL);
    }
    return ensureApiPathPrefix(resolved).replace(/\/$/, '');
  }, [apiUrl]);
  const mapPinRequired = muhabbetListingMapPinFlowAvailable();

  const [createRole, setCreateRole] = useState<'driver' | 'passenger'>(initialRole);
  const [listingScope, setListingScope] = useState<ListingScope>(initialScope);
  const [originCity, setOriginCity] = useState(city.trim());
  const [destinationCity, setDestinationCity] = useState('');
  const [cityPickerOpen, setCityPickerOpen] = useState(false);
  const [cityPickerField, setCityPickerField] = useState<CityPickerField>('origin');
  const [fromPoint, setFromPoint] = useState<MuhabbetCommittedPlace | null>(null);
  const [toPoint, setToPoint] = useState<MuhabbetCommittedPlace | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [locationChoiceOpen, setLocationChoiceOpen] = useState(false);
  const [locationChoiceLoading, setLocationChoiceLoading] = useState(false);
  const gpsFetchingRef = useRef(false);
  const [pickerField, setPickerField] = useState<'from' | 'to'>('from');
  const [userBias, setUserBias] = useState<{ latitude: number; longitude: number } | null>(null);

  const [departureHm, setDepartureHm] = useState(defaultDepartureHm);
  const [departureTab, setDepartureTab] = useState<DepartureTab>('today');
  const [futurePick, setFuturePick] = useState<Date | null>(null);
  const [timeModalOpen, setTimeModalOpen] = useState(false);
  const [timeDraft, setTimeDraft] = useState(defaultDepartureHm);
  const [timeModalTabDraft, setTimeModalTabDraft] = useState<DepartureTab>('today');
  const [futureDraft, setFutureDraft] = useState<Date | null>(null);
  const [departureTimeConfirmed, setDepartureTimeConfirmed] = useState(false);
  const futureOptions = useMemo(() => futureDayOptions(new Date(), 56), []);

  const [suggestedBase, setSuggestedBase] = useState<number | null>(null);
  const [priceDelta, setPriceDelta] = useState(0);
  const [priceMeta, setPriceMeta] = useState<{ distance_km?: number; estimated_minutes?: number } | null>(null);
  const [priceCalcBusy, setPriceCalcBusy] = useState(false);

  const [seatsText, setSeatsText] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [vehicleBrand, setVehicleBrand] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [brandSheetOpen, setBrandSheetOpen] = useState(false);
  const [passengerCountText, setPassengerCountText] = useState('');
  const [passengerBudgetText, setPassengerBudgetText] = useState('');
  const [createBusy, setCreateBusy] = useState(false);
  /** Teklif satırı: car | motorcycle (API ile aynı). */
  const [offerVehicleKind, setOfferVehicleKind] = useState<'car' | 'motorcycle'>('car');

  useEffect(() => {
    if (visible) {
      setCreateRole(initialRole);
      const scope = initialScope === 'intercity' ? 'intercity' : 'local';
      setListingScope(scope);
      setOriginCity(city.trim());
      setDestinationCity(scope === 'intercity' ? '' : city.trim());
      setFromPoint(null);
      setToPoint(null);
      setDepartureTimeConfirmed(false);
      setDepartureTab('today');
      setFuturePick(null);
      setSuggestedBase(null);
      setPriceDelta(0);
      setPriceMeta(null);
      setSeatsText('');
      setPassengerCountText('');
      setOfferVehicleKind('car');
    }
  }, [visible, initialRole, initialScope, city]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => {
      try {
        const raw = await getPersistedUserRaw();
        const tok = (await getPersistedAccessToken())?.trim();
        if (!raw || !tok || cancelled) return;
        const u = JSON.parse(raw) as { id?: string };
        const uid = u?.id ? String(u.id).trim() : '';
        if (!uid) return;
        const res = await fetch(`${base}/driver/kyc/status?user_id=${encodeURIComponent(uid)}`, {
          headers: { Authorization: `Bearer ${tok}` },
        });
        const d = (await res.json().catch(() => ({}))) as {
          vehicle_kind?: string;
          passenger_preferred_vehicle?: string;
        };
        if (cancelled) return;
        if (listingScope === 'intercity') {
          setOfferVehicleKind('car');
          return;
        }
        const pick =
          createRole === 'driver'
            ? d.vehicle_kind === 'motorcycle'
              ? 'motorcycle'
              : 'car'
            : d.passenger_preferred_vehicle === 'motorcycle'
              ? 'motorcycle'
              : 'car';
        setOfferVehicleKind(pick);
      } catch {
        /* varsayılan car */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, createRole, base, listingScope]);

  useEffect(() => {
    if (listingScope === 'intercity') {
      setOfferVehicleKind('car');
    }
  }, [listingScope]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted' || cancelled) return;
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!cancelled && loc?.coords) {
          setUserBias({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        }
      } catch {
        /* bias opsiyonel */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible]);

  useEffect(() => {
    setSuggestedBase(null);
    setPriceDelta(0);
    setPriceMeta(null);
  }, [fromPoint?.latitude, fromPoint?.longitude, toPoint?.latitude, toPoint?.longitude]);

  useEffect(() => {
    if (createRole === 'passenger') setSeatsText('');
  }, [createRole]);

  useEffect(() => {
    setSuggestedBase(null);
    setPriceDelta(0);
    setPriceMeta(null);
  }, [createRole]);

  const driverSeatsValid = useMemo(() => {
    if (createRole !== 'driver') return true;
    const n = parseInt(seatsText.replace(/\D/g, ''), 10);
    return !Number.isNaN(n) && n >= 1;
  }, [createRole, seatsText]);

  const passengerCountValid = useMemo(() => {
    if (listingScope !== 'intercity' || createRole !== 'passenger') return true;
    const n = parseInt(passengerCountText.replace(/\D/g, ''), 10);
    return !Number.isNaN(n) && n >= 1;
  }, [createRole, listingScope, passengerCountText]);

  const missingReasons = useMemo(() => {
    const out: string[] = [];
    const origin = originCity.trim();
    const destination = destinationCity.trim();
    if (listingScope === 'intercity') {
      if (!origin) out.push('Kalkış şehri seçilmedi.');
      if (!destination) out.push('Varış şehri seçilmedi.');
      if (origin && destination && origin.toLocaleLowerCase('tr-TR') === destination.toLocaleLowerCase('tr-TR')) {
        out.push('Şehirler arası teklifte kalkış ve varış şehirleri farklı olmalı.');
      }
    }
    if (!fromPoint) out.push('Nereden seçilmedi.');
    else if (!hasFiniteCoords(fromPoint)) out.push('Nereden: konum koordinatları eksik.');
    else if (mapPinRequired && !fromPoint.mapPinConfirmed) {
      out.push('Nereden: Haritada “Tam burası” ile konumu doğrulamalısın.');
    }

    if (!toPoint) out.push('Nereye seçilmedi.');
    else if (!hasFiniteCoords(toPoint)) out.push('Nereye: konum koordinatları eksik.');
    else if (mapPinRequired && !toPoint.mapPinConfirmed) {
      out.push('Nereye: Haritada “Tam burası” ile konumu doğrulamalısın.');
    }

    if (!departureTimeConfirmed) {
      out.push('Saat: Saat satırına dokunup seçiminizi “Tamam” ile kaydetmelisin.');
    }

    if (suggestedBase == null) {
      out.push(
        listingScope === 'intercity'
          ? 'Önce rota için öneri fiyat hesaplamalısın.'
          : 'Önce rota için taban fiyat hesaplamalısın.',
      );
    }

    if (createRole === 'driver' && !driverSeatsValid) {
      out.push(`${listingScope === 'intercity' ? 'Boş koltuk sayısı' : 'Sürücü teklifi için koltuk sayısı'} (en az 1) zorunlu.`);
    }

    if (listingScope === 'intercity' && createRole === 'passenger' && !passengerCountValid) {
      out.push('Kaç kişi alanı (en az 1) zorunlu.');
    }

    return out;
  }, [
    createRole,
    departureTimeConfirmed,
    destinationCity,
    driverSeatsValid,
    fromPoint,
    listingScope,
    mapPinRequired,
    originCity,
    passengerCountValid,
    suggestedBase,
    toPoint,
  ]);

  const canSubmit = missingReasons.length === 0;

  const showMissingAlert = useCallback(() => {
    if (missingReasons.length === 0) return;
    Alert.alert('Tamamlanması gerekenler', missingReasons.map((m) => `• ${m}`).join('\n\n'));
  }, [missingReasons]);

  const composedNote = useMemo(() => {
    const meta: string[] = [];
    if (listingScope === 'intercity') {
      meta.push(`Kapsam: Şehirler arası (${originCity.trim()} → ${destinationCity.trim()})`);
    }
    if (createRole === 'driver') {
      const sc = parseInt(seatsText.replace(/\D/g, ''), 10);
      if (!Number.isNaN(sc) && sc > 0) meta.push(`${listingScope === 'intercity' ? 'Boş koltuk' : 'Koltuk'}: ${sc}`);
      const vb = vehicleBrand.trim();
      const vm = vehicleModel.trim();
      const vc = vehicleColor.trim();
      if (vb || vm || vc) meta.push(`Araç: ${[vb, vm, vc].filter(Boolean).join(' · ')}`);
    } else {
      meta.push('Yolcu teklifi');
      const pc = parseInt(passengerCountText.replace(/\D/g, ''), 10);
      if (!Number.isNaN(pc) && pc > 0) meta.push(`Kişi: ${pc}`);
      const bud = parseFloat(passengerBudgetText.replace(',', '.'));
      if (!Number.isNaN(bud) && bud >= 0 && passengerBudgetText.trim()) {
        meta.push(`Bütçe üst sınırı: ${bud} ₺`);
      }
    }
    if (suggestedBase != null) {
      const finalP = Math.max(0, Math.round(suggestedBase + priceDelta));
      meta.push(`${listingScope === 'intercity' ? 'Öneri fiyat' : 'Ücret (taban±)'}: ${finalP} ₺`);
    }
    if (priceMeta?.distance_km != null) meta.push(`Mesafe: ~${priceMeta.distance_km} km`);
    const head = meta.join(' · ');
    const tail = noteBody.trim();
    if (head && tail) return `${head}\n${tail}`;
    return head || tail || null;
  }, [
    createRole,
    destinationCity,
    listingScope,
    noteBody,
    originCity,
    passengerCountText,
    passengerBudgetText,
    priceDelta,
    priceMeta?.distance_km,
    seatsText,
    suggestedBase,
    vehicleBrand,
    vehicleColor,
    vehicleModel,
  ]);

  const resetForm = () => {
    setFromPoint(null);
    setToPoint(null);
    setPickerOpen(false);
    setLocationChoiceOpen(false);
    setLocationChoiceLoading(false);
    gpsFetchingRef.current = false;
    setCityPickerOpen(false);
    setUserBias(null);
    const hm = defaultDepartureHm();
    setDepartureHm(hm);
    setTimeDraft(hm);
    setDepartureTab('today');
    setFuturePick(null);
    setTimeModalTabDraft('today');
    setFutureDraft(null);
    setDepartureTimeConfirmed(false);
    setSuggestedBase(null);
    setPriceDelta(0);
    setPriceMeta(null);
    setSeatsText('');
    setNoteBody('');
    setVehicleBrand('');
    setVehicleModel('');
    setVehicleColor('');
    setBrandSheetOpen(false);
    setPassengerCountText('');
    setPassengerBudgetText('');
    setOfferVehicleKind('car');
    setListingScope(initialScope === 'intercity' ? 'intercity' : 'local');
    setOriginCity(city.trim());
    setDestinationCity(initialScope === 'intercity' ? '' : city.trim());
  };

  const openPicker = (field: 'from' | 'to') => {
    if (listingScope === 'intercity') {
      const pc = field === 'from' ? originCity.trim() : destinationCity.trim();
      if (!pc) {
        Alert.alert('Şehir seç', field === 'from' ? 'Önce kalkış şehrini seç.' : 'Önce varış şehrini seç.');
        return;
      }
    }
    setPickerField(field);
    if (field === 'to') {
      setPickerOpen(true);
      return;
    }
    setLocationChoiceOpen(true);
  };

  const openAddressPickerModal = useCallback(() => {
    setLocationChoiceOpen(false);
    setPickerOpen(true);
  }, []);

  const commitCurrentGpsLocation = useCallback(async () => {
    if (gpsFetchingRef.current) return;
    gpsFetchingRef.current = true;
    setLocationChoiceLoading(true);

    const field = pickerField;
    const cityCtx =
      listingScope === 'intercity'
        ? field === 'from'
          ? originCity.trim()
          : destinationCity.trim()
        : city.trim();

    const TEMP_LABEL = 'Mevcut konum';
    const FIVE_MIN_MS = 5 * 60 * 1000;
    const POSITION_TIMEOUT_MS = 8000;

    const coordClose = (a: number, b: number) => Math.abs(a - b) <= 1e-5;

    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert('Konum izni gerekli', 'Konumunu kullanmak için ayarlardan konum iznini aç.');
        return;
      }

      let pos: Location.LocationObject | null = null;
      let usedLastKnown = false;

      try {
        const last = await Location.getLastKnownPositionAsync();
        if (
          last &&
          Number.isFinite(last.coords.latitude) &&
          Number.isFinite(last.coords.longitude)
        ) {
          const age = Date.now() - last.timestamp;
          if (age >= 0 && age <= FIVE_MIN_MS) {
            pos = last;
            usedLastKnown = true;
          }
        }
      } catch {
        /* ignore last-known */
      }

      if (!pos) {
        try {
          pos = await Promise.race([
            Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Low,
            }),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('location_timeout')), POSITION_TIMEOUT_MS),
            ),
          ]);
        } catch {
          Alert.alert('Konum', 'Konum alınamadı, lütfen başka adres seç.');
          return;
        }
      }

      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        Alert.alert('Konum', 'Konum alınamadı, lütfen başka adres seç.');
        return;
      }
      if (cityCtx && !isLatLngWithinRegisteredCity(cityCtx, lat, lng)) {
        Alert.alert(
          'Şehir sınırı',
          'Anlık konumun seçili şehir alanı dışında görünüyor. Haritadan adres seçebilirsin.',
        );
        return;
      }

      const latSnap = lat;
      const lngSnap = lng;
      const placeTemp: MuhabbetCommittedPlace = {
        address: TEMP_LABEL,
        latitude: latSnap,
        longitude: lngSnap,
        mapPinConfirmed: true,
      };

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (field === 'from') setFromPoint(placeTemp);
      else setToPoint(placeTemp);
      setSuggestedBase(null);
      setPriceDelta(0);
      setPriceMeta(null);
      setLocationChoiceOpen(false);

      void (async () => {
        try {
          const addr = await reverseGeocodeTr(latSnap, lngSnap);
          const applyAddr = (prev: MuhabbetCommittedPlace | null) => {
            if (!prev) return prev;
            if (!coordClose(prev.latitude, latSnap) || !coordClose(prev.longitude, lngSnap)) return prev;
            if (prev.address !== TEMP_LABEL) return prev;
            return { ...prev, address: addr };
          };
          if (field === 'from') setFromPoint(applyAddr);
          else setToPoint(applyAddr);
        } catch {
          /* keep temporary label */
        }
      })();

      if (usedLastKnown) {
        void (async () => {
          try {
            const fresh = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Low,
            });
            const flat = fresh.coords.latitude;
            const flng = fresh.coords.longitude;
            if (!Number.isFinite(flat) || !Number.isFinite(flng)) return;
            if (cityCtx && !isLatLngWithinRegisteredCity(cityCtx, flat, flng)) return;

            const bumpCoords = (prev: MuhabbetCommittedPlace | null): MuhabbetCommittedPlace | null => {
              if (!prev) return prev;
              if (!coordClose(prev.latitude, latSnap) || !coordClose(prev.longitude, lngSnap)) return prev;
              return { ...prev, latitude: flat, longitude: flng, address: TEMP_LABEL };
            };
            if (field === 'from') setFromPoint(bumpCoords);
            else setToPoint(bumpCoords);

            const addr2 = await reverseGeocodeTr(flat, flng);
            const applyAddr2 = (prev: MuhabbetCommittedPlace | null) => {
              if (!prev) return prev;
              if (!coordClose(prev.latitude, flat) || !coordClose(prev.longitude, flng)) return prev;
              if (prev.address !== TEMP_LABEL) return prev;
              return { ...prev, address: addr2 };
            };
            if (field === 'from') setFromPoint(applyAddr2);
            else setToPoint(applyAddr2);
          } catch {
            /* ignore background refresh */
          }
        })();
      }
    } catch {
      Alert.alert('Konum', 'Konum alınamadı, lütfen başka adres seç.');
    } finally {
      gpsFetchingRef.current = false;
      setLocationChoiceLoading(false);
    }
  }, [listingScope, pickerField, originCity, destinationCity, city]);

  const openCityPicker = (field: CityPickerField) => {
    setCityPickerField(field);
    setCityPickerOpen(true);
  };

  const selectIntercityCity = (nextCity: string) => {
    const picked = nextCity.trim();
    if (!picked) return;
    const other = cityPickerField === 'origin' ? destinationCity.trim() : originCity.trim();
    if (other && picked.toLocaleLowerCase('tr-TR') === other.toLocaleLowerCase('tr-TR')) {
      Alert.alert('Şehirler farklı olmalı', 'Şehirler arası teklifte nereden ve nereye şehirleri aynı olamaz.');
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (cityPickerField === 'origin') {
      setOriginCity(picked);
      setFromPoint(null);
    } else {
      setDestinationCity(picked);
      setToPoint(null);
    }
    setSuggestedBase(null);
    setPriceDelta(0);
    setPriceMeta(null);
    setCityPickerOpen(false);
  };

  const onPickerCommitted = useCallback(
    (place: MuhabbetCommittedPlace) => {
      if (pickerField === 'from') setFromPoint(place);
      else setToPoint(place);
      setPickerOpen(false);
    },
    [pickerField],
  );

  const onTimeChipPress = (fn: () => void) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fn();
  };

  const calcBasePrice = useCallback(async () => {
    if (!fromPoint || !toPoint) {
      Alert.alert('Eksik', 'Önce nereden ve nereyi seç.');
      return;
    }
    if (mapPinRequired && (!fromPoint.mapPinConfirmed || !toPoint.mapPinConfirmed)) {
      Alert.alert(
        'Harita doğrulaması',
        'Bu cihazda harita açıkken her iki uç için de arama sonrası “Tam burası” ile konumu onaylamalısın.',
      );
      return;
    }
    setPriceCalcBusy(true);
    try {
      const res = await fetch(`${base}/price/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pickup_lat: fromPoint.latitude,
          pickup_lng: fromPoint.longitude,
          dropoff_lat: toPoint.latitude,
          dropoff_lng: toPoint.longitude,
          passenger_vehicle_kind: 'car',
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        suggested_price?: number;
        distance_km?: number;
        trip_distance_km?: number;
        estimated_minutes?: number;
        error?: string;
        detail?: string;
      };
      const distanceKm = Number(data.distance_km ?? data.trip_distance_km ?? 0);
      if (listingScope !== 'intercity' && (!res.ok || !data.success || data.suggested_price == null)) {
        const msg =
          typeof data.detail === 'string'
            ? data.detail
            : typeof data.error === 'string'
              ? data.error
              : 'Ücret şu an hesaplanamadı. Bağlantını kontrol edip tekrar dene.';
        Alert.alert('Ücret', msg);
        return;
      }
      if (listingScope === 'intercity' && (!res.ok || !data.success || !Number.isFinite(distanceKm) || distanceKm <= 0)) {
        const msg =
          typeof data.detail === 'string'
            ? data.detail
            : typeof data.error === 'string'
              ? data.error
              : 'Öneri fiyat şu an hesaplanamadı. Bağlantını kontrol edip tekrar dene.';
        Alert.alert('Öneri fiyat', msg);
        return;
      }
      const nextSuggested =
        listingScope === 'intercity'
          ? calculateIntercitySuggestedPrice({ distanceKm, createRole, seatsText, passengerCountText })
          : Math.round(Number(data.suggested_price));
      setSuggestedBase(nextSuggested);
      setPriceDelta(0);
      setPriceMeta({
        distance_km: distanceKm || undefined,
        estimated_minutes: data.estimated_minutes,
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert('Ücret', 'Bağlantı hatası. Tekrar deneyin.');
    } finally {
      setPriceCalcBusy(false);
    }
  }, [base, createRole, fromPoint, listingScope, mapPinRequired, passengerCountText, seatsText, toPoint]);

  const finalPriceInt = useMemo(() => {
    if (suggestedBase == null) return null;
    return Math.max(0, Math.round(suggestedBase + priceDelta));
  }, [suggestedBase, priceDelta]);

  const submitCreate = async () => {
    const urlPrimary = `${base}/muhabbet/listings`;
    const urlLegacy = `${base}/muhabbet/listings/create`;
    const tokenGateOk = requireToken();
    console.warn('[muhabbet-create] submit start', {
      apiUrlProp: apiUrl,
      base,
      urlPrimary,
      urlLegacy,
      hasToken: !!tok,
      requireTokenReturned: tokenGateOk,
      canSubmit,
      missingCount: missingReasons.length,
    });

    if (!tokenGateOk) {
      console.warn('[muhabbet-create] early exit: requireToken() false (Alert zaten requireToken içinde olabilir)');
      return;
    }
    if (!tok) {
      console.warn('[muhabbet-create] early exit: accessToken boş (modal tok)');
      Alert.alert('Teklif', 'Oturum bilgisi eksik. Lütfen tekrar giriş yapın.');
      return;
    }
    if (!canSubmit) {
      console.warn('[muhabbet-create] validation: eksikler', missingReasons);
      showMissingAlert();
      return;
    }
    if (!fromPoint || !toPoint || suggestedBase == null || finalPriceInt == null) {
      console.warn('[muhabbet-create] validation: guard tekrar', {
        from: !!fromPoint,
        to: !!toPoint,
        suggestedBase,
        finalPriceInt,
      });
      showMissingAlert();
      return;
    }

    setCreateBusy(true);
    try {
      // Backend ile birebir: server.py _MUHABBET_LISTING_TYPES / _MUHABBET_LISTING_ROLES
      const listing_type = createRole === 'driver' ? 'gidiyorum' : 'gidecegim';
      const role_type = createRole === 'driver' ? 'driver' : 'passenger';
      console.log(`[listing-create] scope=${listingScope} role_type=${role_type} listing_type=${listing_type}`);
      const departure_time = buildDepartureIso(departureTab, futurePick, departureHm.h, departureHm.m);
      const origin_city = listingScope === 'intercity' ? originCity.trim() : city.trim();
      const destination_city = listingScope === 'intercity' ? destinationCity.trim() : city.trim();
      const body: Record<string, unknown> = {
        city: origin_city,
        listing_scope: listingScope,
        origin_city,
        destination_city,
        from_text: fromPoint.address.trim(),
        to_text: toPoint.address.trim(),
        start_lat: fromPoint.latitude,
        start_lng: fromPoint.longitude,
        end_lat: toPoint.latitude,
        end_lng: toPoint.longitude,
        listing_type,
        role_type,
        note: composedNote,
        departure_time,
        price_amount: finalPriceInt,
        vehicle_kind: listingScope === 'intercity' ? 'car' : offerVehicleKind,
      };
      if (createRole === 'driver') {
        const sc = parseInt(seatsText.replace(/\D/g, ''), 10);
        if (!Number.isNaN(sc) && sc > 0) body.seats_count = sc;
      } else if (listingScope === 'intercity') {
        const pc = parseInt(passengerCountText.replace(/\D/g, ''), 10);
        if (!Number.isNaN(pc) && pc > 0) body.passenger_count = pc;
      }

      const bodyJson = JSON.stringify(body);
      console.warn('[muhabbet-create] fetch primary', urlPrimary);
      console.warn('[muhabbet-create] request body', body);

      let res = await fetch(urlPrimary, {
        method: 'POST',
        headers: { ...authHeader(tok), 'Content-Type': 'application/json' },
        body: bodyJson,
      });
      let rawBody = await res.text();
      console.warn('[muhabbet-create] primary response', { status: res.status, bodyHead: rawBody.slice(0, 800) });

      if (shouldUseLegacyListingCreate(res.status)) {
        console.warn('[muhabbet-create] fallback legacy (status 404|405|501) →', urlLegacy);
        res = await fetch(urlLegacy, {
          method: 'POST',
          headers: { ...authHeader(tok), 'Content-Type': 'application/json' },
          body: bodyJson,
        });
        rawBody = await res.text();
        console.warn('[muhabbet-create] legacy response', { status: res.status, bodyHead: rawBody.slice(0, 800) });
      }

      if (handleUnauthorizedAndMaybeRedirect(res)) {
        console.warn('[muhabbet-create] 401 — yönlendirme / oturum');
        return;
      }

      let d: { success?: boolean; detail?: string } = {};
      try {
        d = JSON.parse(rawBody) as typeof d;
        console.warn('[muhabbet-create] parsed JSON', { success: d.success, hasDetail: typeof d.detail === 'string' });
      } catch (parseErr) {
        console.warn('[muhabbet-create] JSON parse hatası', parseErr, 'rawHead:', rawBody.slice(0, 200));
        d = {};
      }

      if (!res.ok || !d.success) {
        console.warn('[muhabbet-create] submit başarısız (kullanıcıya sade mesaj)', res.status, rawBody.slice(0, 500));
        const parsed = (() => {
          try {
            return JSON.parse(rawBody) as unknown;
          } catch {
            return null;
          }
        })();
        const serverDetail = detailFromMuhabbetCreateJson(parsed);
        Alert.alert('Teklif', serverDetail || userSubmitFailureMessage());
        return;
      }
      console.warn('[muhabbet-create] submit OK');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Teklif', 'Teklifin açıldı.');
      onClose();
      resetForm();
      onCreated?.();
    } catch (err) {
      console.warn('[muhabbet-create] fetch exception', err);
      Alert.alert('Teklif', userSubmitFailureMessage());
    } finally {
      setCreateBusy(false);
    }
  };

  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);
  const minutes = useMemo(() => Array.from({ length: 12 }, (_, i) => i * 5), []);

  const endpointSummary = (p: MuhabbetCommittedPlace | null) =>
    p ? (p.address.length > 52 ? `${p.address.slice(0, 52)}…` : p.address) : 'Konumu seç';
  /** Uç nokta seçimi — her zaman ilgili alanın şehri (Nereye için varış şehri karışmaz). */
  const pickerCity = useMemo(() => {
    if (listingScope === 'intercity') {
      return pickerField === 'from' ? originCity.trim() : destinationCity.trim();
    }
    return city.trim();
  }, [listingScope, pickerField, originCity, destinationCity, city]);
  const isIntercity = listingScope === 'intercity';
  const formTitle = isIntercity
    ? createRole === 'driver'
      ? 'Şehirler arası sürücü teklifi'
      : 'Şehirler arası yolcu teklifi'
    : createRole === 'driver'
      ? 'Şehir içi sürücü teklifi'
      : 'Şehir içi yolcu teklifi';
  const roleOptions = [
    {
      role: 'driver' as const,
      title: 'Sürücüyüm',
      subtitle: isIntercity ? 'Şehir dışı yolcu arıyorum' : 'Şehir içi aracım var',
      icon: 'car-sport-outline' as const,
    },
    {
      role: 'passenger' as const,
      title: 'Yolcuyum',
      subtitle: isIntercity ? 'Şehir dışı sürücü arıyorum' : 'Şehir içi aracım yok',
      icon: 'person-outline' as const,
    },
  ];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalRoot} edges={['left', 'right', 'bottom']}>
        <ScreenHeaderGradient
          title={formTitle}
          onBack={onClose}
          backIcon="close"
          gradientColors={[...HEADER_GRAD]}
        />

        <KeyboardAvoidingView
          style={styles.kav}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 70 : 0}
        >
          <ScrollView
            contentContainerStyle={[styles.modalScroll, createRole === 'driver' ? styles.modalScrollDriver : styles.modalScrollPassenger]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.sectionEyebrow}>Teklif niyeti</Text>
            <View style={styles.intentSelector}>
              {roleOptions.map((opt) => {
                const selected = createRole === opt.role;
                return (
                  <TouchableOpacity
                    key={opt.role}
                    style={[styles.intentCard, selected && styles.intentCardOn]}
                    onPress={() => {
                      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setCreateRole(opt.role);
                    }}
                    activeOpacity={0.88}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                  >
                    <View style={[styles.intentIconWrap, selected && styles.intentIconWrapOn]}>
                      <Ionicons name={opt.icon} size={21} color={selected ? '#FFFFFF' : '#475569'} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[styles.intentTitle, selected && styles.intentTitleOn]}>{opt.title}</Text>
                      <Text style={[styles.intentSubtitle, selected && styles.intentSubtitleOn]} numberOfLines={2}>
                        {opt.subtitle}
                      </Text>
                    </View>
                    {selected ? <Ionicons name="checkmark-circle" size={20} color="#2563EB" /> : null}
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.sectionEyebrow}>{isIntercity ? 'Şehir dışı rota' : 'Şehir'}</Text>
            {isIntercity ? (
              <View style={styles.card}>
                <Text style={styles.scopeHint}>Nereden ve nereye gideceğini iki şehirle belirle; adres seçici her şehir için ayrı açılır.</Text>
                <View style={styles.cityPairRow}>
                  <TouchableOpacity style={styles.cityPickCard} onPress={() => openCityPicker('origin')} activeOpacity={0.88}>
                    <Text style={styles.inLabel}>Nereden şehir</Text>
                    <Text style={originCity.trim() ? styles.cityPickValue : styles.cityPickPlaceholder}>
                      {originCity.trim() || 'Şehir seç'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.cityPickCard} onPress={() => openCityPicker('destination')} activeOpacity={0.88}>
                    <Text style={styles.inLabel}>Nereye şehir</Text>
                    <Text style={destinationCity.trim() ? styles.cityPickValue : styles.cityPickPlaceholder}>
                      {destinationCity.trim() || 'Şehir seç'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.card}>
                <Text style={styles.cityLock}>{city}</Text>
              </View>
            )}

            {createRole === 'driver' && listingScope === 'local' ? (
              <>
                <Text style={[styles.sectionEyebrow, { marginTop: 14 }]}>Araç türü</Text>
                <View style={styles.roleRow}>
                  <TouchableOpacity
                    style={[styles.roleChip, offerVehicleKind === 'car' && styles.roleChipOn]}
                    onPress={() => setOfferVehicleKind('car')}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.roleChipText, offerVehicleKind === 'car' && styles.roleChipTextOn]}>Araba</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.roleChip, offerVehicleKind === 'motorcycle' && styles.roleChipOn]}
                    onPress={() => setOfferVehicleKind('motorcycle')}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.roleChipText, offerVehicleKind === 'motorcycle' && styles.roleChipTextOn]}>Motor</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : !isIntercity ? (
              <>
                <Text style={[styles.sectionEyebrow, { marginTop: 14 }]}>Taşıma türü</Text>
                <View style={styles.roleRow}>
                  <TouchableOpacity
                    style={[styles.roleChip, offerVehicleKind === 'car' && styles.roleChipOn]}
                    onPress={() => setOfferVehicleKind('car')}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.roleChipText, offerVehicleKind === 'car' && styles.roleChipTextOn]}>Araba</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.roleChip, offerVehicleKind === 'motorcycle' && styles.roleChipOn]}
                    onPress={() => setOfferVehicleKind('motorcycle')}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.roleChipText, offerVehicleKind === 'motorcycle' && styles.roleChipTextOn]}>Motor</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : null}

            <Text style={styles.sectionEyebrow}>Rota</Text>
            <TouchableOpacity style={styles.cardRow} onPress={() => openPicker('from')} activeOpacity={0.88}>
              <View style={[styles.icoWrap, { backgroundColor: 'rgba(59,130,246,0.12)' }]}>
                <Ionicons name="navigate-circle-outline" size={22} color="#2563eb" />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.rowLabel}>{isIntercity ? (createRole === 'driver' ? 'Nereden adres / çıkış noktası' : 'Nereden adres / konum') : 'Nereden'}</Text>
                {isIntercity ? <Text style={styles.rowMetaOk}>{originCity.trim() || 'Nereden şehir seç'}</Text> : null}
                <Text style={styles.rowValue} numberOfLines={2}>
                  {endpointSummary(fromPoint)}
                </Text>
                {fromPoint && mapPinRequired ? (
                  <Text style={styles.rowMeta}>{fromPoint.mapPinConfirmed ? 'Harita onaylı' : 'Haritada “Tam burası” bekleniyor'}</Text>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={20} color={TEXT_MUTED} />
            </TouchableOpacity>

            <TouchableOpacity style={[styles.cardRow, { marginTop: 10 }]} onPress={() => openPicker('to')} activeOpacity={0.88}>
              <View style={[styles.icoWrap, { backgroundColor: 'rgba(234,88,12,0.12)' }]}>
                <Ionicons name="flag-outline" size={22} color={ACCENT_ORANGE} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.rowLabel}>{isIntercity ? (createRole === 'driver' ? 'Nereye adres / varış noktası' : 'Nereye adres / konum') : 'Nereye'}</Text>
                {isIntercity ? <Text style={styles.rowMetaOk}>{destinationCity.trim() || 'Nereye şehir seç'}</Text> : null}
                <Text style={styles.rowValue} numberOfLines={2}>
                  {endpointSummary(toPoint)}
                </Text>
                {toPoint && mapPinRequired ? (
                  <Text style={styles.rowMeta}>{toPoint.mapPinConfirmed ? 'Harita onaylı' : 'Haritada “Tam burası” bekleniyor'}</Text>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={20} color={TEXT_MUTED} />
            </TouchableOpacity>

            {isIntercity && createRole === 'driver' ? (
              <>
                <Text style={[styles.sectionEyebrow, { marginTop: 18 }]}>Boş koltuk sayısı</Text>
                <View style={styles.card}>
                  <TextInput
                    style={styles.inField}
                    value={seatsText}
                    onChangeText={setSeatsText}
                    keyboardType="number-pad"
                    placeholder="Örn. 3"
                    placeholderTextColor={TEXT_MUTED}
                  />
                </View>
              </>
            ) : null}

            {isIntercity && createRole === 'passenger' ? (
              <>
                <Text style={[styles.sectionEyebrow, { marginTop: 18 }]}>Kaç kişi</Text>
                <View style={styles.card}>
                  <TextInput
                    style={styles.inField}
                    value={passengerCountText}
                    onChangeText={setPassengerCountText}
                    keyboardType="number-pad"
                    placeholder="Örn. 2"
                    placeholderTextColor={TEXT_MUTED}
                  />
                </View>
              </>
            ) : null}

            <Text style={[styles.sectionEyebrow, { marginTop: 18 }]}>Saat</Text>
            <TouchableOpacity
              style={styles.cardRow}
              onPress={() => {
                setTimeDraft({ ...departureHm });
                setTimeModalTabDraft(departureTab);
                setFutureDraft(futurePick ?? addLocalDays(new Date(), 2));
                setTimeModalOpen(true);
              }}
              activeOpacity={0.88}
            >
              <View style={[styles.icoWrap, { backgroundColor: 'rgba(148,163,184,0.15)' }]}>
                <Ionicons name="time-outline" size={22} color="#475569" />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.rowLabel}>Kalkış</Text>
                <Text style={styles.rowTimeMain}>
                  {formatDepartureSummary(departureTab, futurePick, departureHm.h, departureHm.m)}
                </Text>
                {!departureTimeConfirmed ? (
                  <Text style={styles.rowMeta}>Onay için dokun — altta “Tamam”</Text>
                ) : (
                  <Text style={styles.rowMetaOk}>Saat onaylandı</Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={20} color={TEXT_MUTED} />
            </TouchableOpacity>

            <Text style={[styles.sectionEyebrow, { marginTop: 18 }]}>{isIntercity ? 'Yol paylaşımı öneri fiyatı' : 'Ücret'}</Text>
            <View style={[styles.priceCard, createRole === 'driver' ? styles.priceCardDriver : styles.priceCardPassenger]}>
              <Text style={styles.priceLead}>{isIntercity ? 'Yakıt maliyetini yolcularla paylaşmaya göre kişi başı öneri fiyat hesaplanır.' : 'Rota mesafesine göre sistem tabanı'}</Text>
              <GradientButton
                label={priceCalcBusy ? 'Hesaplanıyor…' : isIntercity ? 'Öneri fiyat hesapla' : 'Taban fiyat hesapla'}
                loading={priceCalcBusy}
                onPress={() => void calcBasePrice()}
                disabled={!fromPoint || !toPoint || (mapPinRequired && (!fromPoint.mapPinConfirmed || !toPoint.mapPinConfirmed))}
                style={{ marginTop: 12 }}
              />
              {priceMeta?.distance_km != null ? (
                <Text style={styles.priceMeta}>
                  ~{priceMeta.distance_km} km
                  {priceMeta.estimated_minutes != null ? ` · ~${priceMeta.estimated_minutes} dk` : ''}
                </Text>
              ) : null}
              {finalPriceInt != null ? (
                <View style={styles.priceHighlight}>
                  <Text style={styles.priceHuge}>{finalPriceInt} ₺</Text>
                  <Text style={styles.priceSub}>{isIntercity ? 'Yol paylaşımı öneri fiyatı' : 'Önerilen tutar (± ile ince ayar)'}</Text>
                  <View style={styles.stepRow}>
                    <TouchableOpacity
                      style={styles.stepPill}
                      onPress={() => {
                        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setPriceDelta((d) => d - 10);
                      }}
                      disabled={suggestedBase == null}
                    >
                      <Text style={styles.stepPillText}>−10 ₺</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.stepPill}
                      onPress={() => {
                        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setPriceDelta((d) => d + 10);
                      }}
                      disabled={suggestedBase == null}
                    >
                      <Text style={styles.stepPillText}>+10 ₺</Text>
                    </TouchableOpacity>
                    {!isIntercity ? (
                      <TouchableOpacity
                        style={styles.stepPillOrange}
                        onPress={() => {
                          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                          setPriceDelta(0);
                        }}
                        disabled={suggestedBase == null}
                      >
                        <Text style={styles.stepPillOrangeText}>Taban</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              ) : (
                <Text style={styles.priceHintMuted}>Önce {isIntercity ? 'öneri fiyatı' : 'tabanı'} hesapla; sonra istersen ±10 ₺ oynayabilirsin.</Text>
              )}
            </View>

            {createRole === 'driver' ? (
              !isIntercity ? (
              <>
                <Text style={[styles.sectionEyebrow, { marginTop: 18 }]}>Kapasite</Text>
                <View style={styles.card}>
                  <Text style={styles.inLabel}>{isIntercity ? 'Boş koltuk sayısı (zorunlu)' : 'Koltuk (zorunlu)'}</Text>
                  <TextInput
                    style={styles.inField}
                    value={seatsText}
                    onChangeText={setSeatsText}
                    keyboardType="number-pad"
                    placeholder="Örn. 3"
                    placeholderTextColor={TEXT_MUTED}
                  />
                </View>

                <Text style={[styles.sectionEyebrow, { marginTop: 14 }]}>Marka ve model</Text>
                <View style={styles.card}>
                  <Text style={styles.inLabel}>Marka</Text>
                  <TouchableOpacity style={styles.brandPick} onPress={() => setBrandSheetOpen(true)} activeOpacity={0.88}>
                    <Text style={vehicleBrand.trim() ? styles.brandPickOn : styles.brandPickPlaceholder}>
                      {vehicleBrand.trim() || 'Marka seç'}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color={TEXT_MUTED} />
                  </TouchableOpacity>
                  <Text style={[styles.inLabel, { marginTop: 14 }]}>Model</Text>
                  <TextInput
                    style={styles.inField}
                    value={vehicleModel}
                    onChangeText={setVehicleModel}
                    placeholder="Örn. Corolla"
                    placeholderTextColor={TEXT_MUTED}
                  />
                  <Text style={[styles.inLabel, { marginTop: 14 }]}>Renk</Text>
                  <TextInput
                    style={styles.inField}
                    value={vehicleColor}
                    onChangeText={setVehicleColor}
                    placeholder="Örn. Gri"
                    placeholderTextColor={TEXT_MUTED}
                  />
                </View>
              </>
              ) : null
            ) : (
              <>
                {!isIntercity ? (
                  <>
                    <Text style={[styles.sectionEyebrow, { marginTop: 18 }]}>Bütçe (opsiyonel)</Text>
                    <View style={styles.card}>
                      <TextInput
                        style={styles.inField}
                        value={passengerBudgetText}
                        onChangeText={setPassengerBudgetText}
                        keyboardType="decimal-pad"
                        placeholder="Üst limit (₺)"
                        placeholderTextColor={TEXT_MUTED}
                      />
                    </View>
                  </>
                ) : null}
              </>
            )}

            <Text style={[styles.sectionEyebrow, { marginTop: 18 }]}>Ek not</Text>
            <View style={styles.card}>
              <TextInput
                style={styles.noteField}
                value={noteBody}
                onChangeText={setNoteBody}
                multiline
                placeholder="İsteğe bağlı kısa not…"
                placeholderTextColor={TEXT_MUTED}
                textAlignVertical="top"
              />
            </View>

            <GradientButton
              label={isIntercity ? 'İlanı aç' : 'Teklifi aç'}
              loading={createBusy}
              disabled={createBusy}
              onPress={() => void submitCreate()}
              style={{ marginTop: 20 }}
            />
            {!canSubmit && !createBusy ? (
              <TouchableOpacity onPress={showMissingAlert} style={styles.missingLink}>
                <Text style={styles.missingLinkText}>Neler eksik?</Text>
              </TouchableOpacity>
            ) : null}
            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>

        <Modal
          visible={locationChoiceOpen}
          transparent
          animationType="fade"
          onRequestClose={() => {
            if (!locationChoiceLoading) setLocationChoiceOpen(false);
          }}
        >
          <Pressable style={styles.sheetOverlay} onPress={() => !locationChoiceLoading && setLocationChoiceOpen(false)}>
            <Pressable style={styles.locationChoiceSheet} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.locationChoiceTitle}>Konum seç</Text>
              <Text style={styles.locationChoiceDesc}>
                {pickerField === 'from'
                  ? 'Bulunduğun konumu kullanabilir veya farklı bir adres seçebilirsin.'
                  : 'Gideceğin adresi arayıp seç.'}
              </Text>
              {pickerField === 'from' ? (
                <TouchableOpacity
                  style={styles.locationChoiceRow}
                  onPress={() => void commitCurrentGpsLocation()}
                  disabled={locationChoiceLoading}
                  activeOpacity={0.85}
                >
                  <Ionicons name="navigate-circle-outline" size={22} color={ACCENT_ORANGE} />
                  <Text style={styles.locationChoiceRowText}>
                    {locationChoiceLoading ? 'Konum alınıyor...' : 'Konumum'}
                  </Text>
                  {locationChoiceLoading ? <ActivityIndicator size="small" color={ACCENT_ORANGE} /> : null}
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                style={styles.locationChoiceRow}
                onPress={openAddressPickerModal}
                disabled={locationChoiceLoading}
                activeOpacity={0.85}
              >
                <Ionicons name="map-outline" size={22} color="#2563eb" />
                <Text style={styles.locationChoiceRowText}>Başka adres</Text>
                <Ionicons name="chevron-forward" size={18} color={TEXT_SECONDARY} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.sheetClose} onPress={() => !locationChoiceLoading && setLocationChoiceOpen(false)}>
                <Text style={styles.sheetCloseText}>Vazgeç</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>

        <MuhabbetEndpointPickerModal
          visible={pickerOpen}
          title={pickerField === 'from' ? 'Nereden' : 'Nereye'}
          city={pickerCity}
          cityContext={pickerCity}
          biasLatitude={userBias?.latitude}
          biasLongitude={userBias?.longitude}
          onRequestClose={() => setPickerOpen(false)}
          onCommitted={onPickerCommitted}
        />

        <Modal visible={cityPickerOpen} transparent animationType="fade" onRequestClose={() => setCityPickerOpen(false)}>
          <Pressable style={styles.sheetOverlay} onPress={() => setCityPickerOpen(false)}>
            <Pressable style={styles.brandSheet} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.sheetTitle}>{cityPickerField === 'origin' ? 'Kalkış şehri' : 'Varış şehri'}</Text>
              <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
                <View style={styles.brandGrid}>
                  {TR_CITIES.map((c) => (
                    <TouchableOpacity
                      key={c}
                      style={[
                        styles.brandChip,
                        (cityPickerField === 'origin' ? originCity : destinationCity) === c && styles.brandChipOn,
                      ]}
                      onPress={() => selectIntercityCity(c)}
                    >
                      <Text
                        style={[
                          styles.brandChipText,
                          (cityPickerField === 'origin' ? originCity : destinationCity) === c && styles.brandChipTextOn,
                        ]}
                      >
                        {c}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
              <TouchableOpacity style={styles.sheetClose} onPress={() => setCityPickerOpen(false)}>
                <Text style={styles.sheetCloseText}>Kapat</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>

        <Modal visible={brandSheetOpen} transparent animationType="fade" onRequestClose={() => setBrandSheetOpen(false)}>
          <Pressable style={styles.sheetOverlay} onPress={() => setBrandSheetOpen(false)}>
            <Pressable style={styles.brandSheet} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.sheetTitle}>Marka seç</Text>
              <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
                <View style={styles.brandGrid}>
                  {CAR_BRANDS.map((b) => (
                    <TouchableOpacity
                      key={b}
                      style={[styles.brandChip, vehicleBrand === b && styles.brandChipOn]}
                      onPress={() => {
                        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setVehicleBrand(b);
                        setBrandSheetOpen(false);
                      }}
                    >
                      <Text style={[styles.brandChipText, vehicleBrand === b && styles.brandChipTextOn]}>{b}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
              <TouchableOpacity style={styles.sheetClose} onPress={() => setBrandSheetOpen(false)}>
                <Text style={styles.sheetCloseText}>Kapat</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>

        <Modal visible={timeModalOpen} transparent animationType="slide" onRequestClose={() => setTimeModalOpen(false)}>
          <Pressable style={styles.sheetOverlay} onPress={() => setTimeModalOpen(false)}>
            <Pressable style={styles.timeSheetPremium} onPress={(e) => e.stopPropagation()}>
              <View style={styles.timeSheetHeaderBar}>
                <Text style={styles.timeSheetEyebrowDark}>Kalkış zamanı</Text>
                <Text style={styles.timeSheetSummaryText}>
                  {formatDepartureSummary(timeModalTabDraft, timeModalTabDraft === 'future' ? futureDraft : null, timeDraft.h, timeDraft.m)}
                </Text>
              </View>

              <View style={styles.dateTabRow}>
                {(['today', 'tomorrow', 'future'] as const).map((tab) => {
                  const on = timeModalTabDraft === tab;
                  const label = tab === 'today' ? 'Bugün' : tab === 'tomorrow' ? 'Yarın' : 'İleri tarih';
                  return (
                    <TouchableOpacity
                      key={tab}
                      style={[styles.dateTabChip, on && styles.dateTabChipOn]}
                      onPress={() => {
                        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setTimeModalTabDraft(tab);
                        if (tab === 'future') {
                          setFutureDraft((prev) => prev ?? addLocalDays(new Date(), 2));
                        }
                      }}
                      activeOpacity={0.88}
                    >
                      <Text style={[styles.dateTabChipText, on && styles.dateTabChipTextOn]}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {timeModalTabDraft === 'future' ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.futureStrip}
                  style={styles.futureStripWrap}
                >
                  {futureOptions.map((fd) => {
                    const sel =
                      !!futureDraft &&
                      startOfLocalDay(fd).getTime() === startOfLocalDay(futureDraft).getTime();
                    return (
                      <TouchableOpacity
                        key={fd.getTime()}
                        style={[styles.futureChip, sel && styles.futureChipOn]}
                        onPress={() => {
                          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setFutureDraft(new Date(fd));
                        }}
                        activeOpacity={0.88}
                      >
                        <Text style={[styles.futureChipDow, sel && styles.futureChipTextOn]}>{TR_MONTHS[fd.getMonth()].slice(0, 3)}</Text>
                        <Text style={[styles.futureChipDay, sel && styles.futureChipTextOn]}>{fd.getDate()}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              ) : (
                <View style={styles.futurePlaceholder} />
              )}

              <Text style={styles.timePickLabel}>Saat</Text>
              <View style={styles.timeColumns}>
                <ScrollView style={styles.timeScroll} showsVerticalScrollIndicator={false}>
                  {hours.map((h) => (
                    <TouchableOpacity
                      key={h}
                      style={[styles.timeChip, timeDraft.h === h && styles.timeChipOn]}
                      onPress={() => onTimeChipPress(() => setTimeDraft((t) => ({ ...t, h })))}
                    >
                      <Text style={[styles.timeChipText, timeDraft.h === h && styles.timeChipTextOn]}>{pad2(h)}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <ScrollView style={styles.timeScroll} showsVerticalScrollIndicator={false}>
                  {minutes.map((m) => (
                    <TouchableOpacity
                      key={m}
                      style={[styles.timeChip, timeDraft.m === m && styles.timeChipOn]}
                      onPress={() => onTimeChipPress(() => setTimeDraft((t) => ({ ...t, m })))}
                    >
                      <Text style={[styles.timeChipText, timeDraft.m === m && styles.timeChipTextOn]}>{pad2(m)}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              <TouchableOpacity
                style={styles.timeConfirmBtn}
                activeOpacity={0.9}
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  const tab = timeModalTabDraft;
                  setDepartureTab(tab);
                  if (tab === 'future') {
                    const fp = futureDraft ?? addLocalDays(new Date(), 2);
                    setFuturePick(fp);
                  } else {
                    setFuturePick(null);
                  }
                  setDepartureHm({ ...timeDraft });
                  setDepartureTimeConfirmed(true);
                  setTimeModalOpen(false);
                }}
              >
                <Text style={styles.timeConfirmText}>Tamam</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1, backgroundColor: SCREEN_BG },
  kav: { flex: 1 },
  modalScroll: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 48 },
  modalScrollDriver: {
    paddingTop: 14,
    borderLeftWidth: 3,
    paddingLeft: 13,
    borderLeftColor: 'rgba(249,115,22,0.55)',
  },
  modalScrollPassenger: {
    paddingTop: 14,
    borderLeftWidth: 3,
    paddingLeft: 13,
    borderLeftColor: 'rgba(59,130,246,0.35)',
  },
  sectionEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: TEXT_MUTED,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 4,
  },
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
  },
  cityLock: { fontSize: 17, fontWeight: '700', color: TEXT_PRIMARY },
  scopeHint: { fontSize: 13, color: TEXT_SECONDARY, lineHeight: 18, marginBottom: 12 },
  cityPairRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cityPickCard: {
    flex: 1,
    minWidth: 135,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(148,163,184,0.35)',
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  cityPickValue: { fontSize: 16, fontWeight: '800', color: TEXT_PRIMARY },
  cityPickPlaceholder: { fontSize: 16, fontWeight: '700', color: TEXT_MUTED },
  intentSelector: { gap: 10, marginBottom: 14 },
  intentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: CARD_BG,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.24)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  intentCardOn: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
    shadowOpacity: 0.1,
    elevation: 4,
  },
  intentIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  intentIconWrapOn: {
    backgroundColor: '#2563EB',
  },
  intentTitle: { fontSize: 16, fontWeight: '900', color: TEXT_PRIMARY },
  intentTitleOn: { color: '#1D4ED8' },
  intentSubtitle: { marginTop: 3, fontSize: 13, lineHeight: 18, color: TEXT_SECONDARY },
  intentSubtitleOn: { color: '#1E40AF' },
  roleRow: { flexDirection: 'row', gap: 10 },
  roleChip: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.25)',
    alignItems: 'center',
  },
  roleChipOn: {
    backgroundColor: 'rgba(59,130,246,0.18)',
    borderColor: '#3b82f6',
  },
  roleChipText: { fontSize: 15, fontWeight: '700', color: TEXT_MUTED },
  roleChipTextOn: { color: '#93c5fd' },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
  },
  icoWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowLabel: { fontSize: 12, fontWeight: '600', color: TEXT_SECONDARY },
  rowValue: { marginTop: 4, fontSize: 15, fontWeight: '600', color: TEXT_PRIMARY },
  rowTimeMain: { marginTop: 4, fontSize: 18, fontWeight: '800', color: TEXT_PRIMARY },
  rowMeta: { marginTop: 4, fontSize: 12, color: TEXT_SECONDARY },
  rowMetaOk: { marginTop: 4, fontSize: 12, color: '#15803d', fontWeight: '600' },
  priceCard: {
    backgroundColor: CARD_BG,
    borderRadius: 18,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.15)',
  },
  priceCardDriver: {
    borderColor: 'rgba(234,88,12,0.38)',
    shadowOpacity: 0.1,
  },
  priceCardPassenger: {
    borderColor: 'rgba(59,130,246,0.22)',
    shadowOpacity: 0.06,
  },
  priceLead: { fontSize: 13, color: TEXT_SECONDARY, lineHeight: 18 },
  priceMeta: { marginTop: 10, fontSize: 12, color: TEXT_SECONDARY },
  priceHintMuted: { marginTop: 10, fontSize: 13, color: TEXT_SECONDARY, lineHeight: 18 },
  priceHighlight: { marginTop: 14 },
  priceHuge: { fontSize: 36, fontWeight: '800', color: TEXT_PRIMARY, letterSpacing: -0.5 },
  priceSub: { marginTop: 4, fontSize: 13, color: TEXT_SECONDARY },
  stepRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  stepPill: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: 'rgba(59,130,246,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.25)',
  },
  stepPillText: { fontSize: 14, fontWeight: '700', color: '#1d4ed8' },
  stepPillOrange: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: 'rgba(234,88,12,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(234,88,12,0.35)',
  },
  stepPillOrangeText: { fontSize: 14, fontWeight: '700', color: ACCENT_ORANGE_SOFT },
  inLabel: { fontSize: 12, fontWeight: '600', color: TEXT_SECONDARY, marginBottom: 6 },
  inField: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(148,163,184,0.35)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: TEXT_PRIMARY,
    backgroundColor: '#f8fafc',
  },
  noteField: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(148,163,184,0.35)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: TEXT_PRIMARY,
    backgroundColor: '#f8fafc',
    minHeight: 110,
  },
  brandPick: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(148,163,184,0.35)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: '#f8fafc',
  },
  brandPickOn: { fontSize: 16, fontWeight: '700', color: TEXT_PRIMARY },
  brandPickPlaceholder: { fontSize: 16, color: TEXT_MUTED },
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  brandSheet: {
    backgroundColor: CARD_BG,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 28,
    maxHeight: '70%',
  },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: TEXT_PRIMARY, marginBottom: 14 },
  brandGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  brandChip: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  brandChipOn: { backgroundColor: 'rgba(59,130,246,0.15)', borderColor: '#3b82f6' },
  brandChipText: { fontSize: 14, fontWeight: '700', color: TEXT_PRIMARY },
  brandChipTextOn: { color: '#1d4ed8' },
  sheetClose: { marginTop: 16, alignSelf: 'center', paddingVertical: 10 },
  sheetCloseText: { fontSize: 15, fontWeight: '600', color: TEXT_SECONDARY },
  locationChoiceSheet: {
    backgroundColor: CARD_BG,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 28,
  },
  locationChoiceTitle: { fontSize: 18, fontWeight: '800', color: TEXT_PRIMARY, marginBottom: 8 },
  locationChoiceDesc: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    lineHeight: 20,
    marginBottom: 18,
  },
  locationChoiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(148,163,184,0.35)',
  },
  locationChoiceRowText: { flex: 1, fontSize: 16, fontWeight: '700', color: TEXT_PRIMARY },
  timeSheetPremium: {
    backgroundColor: CARD_BG,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: 'hidden',
    paddingBottom: 22,
  },
  timeSheetHeaderBar: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148,163,184,0.25)',
    backgroundColor: '#f8fafc',
  },
  timeSheetEyebrowDark: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: TEXT_SECONDARY,
    textTransform: 'uppercase',
  },
  timeSheetSummaryText: { marginTop: 8, fontSize: 22, fontWeight: '800', color: TEXT_PRIMARY },
  dateTabRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 8,
    justifyContent: 'space-between',
  },
  dateTabChip: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  dateTabChipOn: {
    backgroundColor: 'rgba(59,130,246,0.14)',
    borderColor: '#3b82f6',
  },
  dateTabChipText: { fontSize: 13, fontWeight: '700', color: TEXT_SECONDARY },
  dateTabChipTextOn: { color: '#1d4ed8' },
  futureStripWrap: { maxHeight: 72, marginBottom: 4 },
  futureStrip: { paddingHorizontal: 14, gap: 8, alignItems: 'center', paddingVertical: 6 },
  futurePlaceholder: { height: 72, marginBottom: 4 },
  futureChip: {
    width: 52,
    height: 58,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  futureChipOn: {
    backgroundColor: 'rgba(59,130,246,0.16)',
    borderColor: '#3b82f6',
  },
  futureChipDow: { fontSize: 10, fontWeight: '700', color: TEXT_SECONDARY, textTransform: 'uppercase' },
  futureChipDay: { marginTop: 2, fontSize: 17, fontWeight: '800', color: TEXT_PRIMARY },
  futureChipTextOn: { color: '#1d4ed8' },
  timePickLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: TEXT_SECONDARY,
    paddingHorizontal: 18,
    marginTop: 4,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  timeColumns: { flexDirection: 'row', gap: 14, paddingHorizontal: 16, maxHeight: 160, marginTop: 8 },
  timeScroll: { flex: 1 },
  timeChip: {
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 11,
    marginBottom: 6,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
  },
  timeChipOn: { backgroundColor: 'rgba(59,130,246,0.18)' },
  timeChipText: { fontSize: 17, fontWeight: '600', color: TEXT_PRIMARY },
  timeChipTextOn: { color: '#1d4ed8', fontWeight: '800' },
  timeConfirmBtn: {
    marginHorizontal: 16,
    marginTop: 18,
    backgroundColor: ACCENT_ORANGE,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: ACCENT_ORANGE,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  timeConfirmText: { fontSize: 17, fontWeight: '800', color: '#fff' },
  missingLink: { marginTop: 14, alignSelf: 'center', paddingVertical: 8 },
  missingLinkText: { fontSize: 14, color: '#93c5fd', fontWeight: '600' },
});
