/**
 * Muhabbet teklif oluşturma — konum, taban ücret, doğrulamalar (premium UI).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
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
import MuhabbetEndpointPickerModal, {
  muhabbetListingMapPinFlowAvailable,
  type MuhabbetCommittedPlace,
} from './MuhabbetEndpointPickerModal';

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

export type CreateListingModalProps = {
  visible: boolean;
  onClose: () => void;
  apiUrl: string;
  accessToken: string;
  city: string;
  initialRole: 'driver' | 'passenger';
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
  const [fromPoint, setFromPoint] = useState<MuhabbetCommittedPlace | null>(null);
  const [toPoint, setToPoint] = useState<MuhabbetCommittedPlace | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
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
  const [passengerBudgetText, setPassengerBudgetText] = useState('');
  const [createBusy, setCreateBusy] = useState(false);

  useEffect(() => {
    if (visible) {
      setCreateRole(initialRole);
      setDepartureTimeConfirmed(false);
      setDepartureTab('today');
      setFuturePick(null);
    }
  }, [visible, initialRole]);

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

  const driverSeatsValid = useMemo(() => {
    if (createRole !== 'driver') return true;
    const n = parseInt(seatsText.replace(/\D/g, ''), 10);
    return !Number.isNaN(n) && n >= 1;
  }, [createRole, seatsText]);

  const missingReasons = useMemo(() => {
    const out: string[] = [];
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
      out.push('Önce rota için taban fiyat hesaplamalısın.');
    }

    if (createRole === 'driver' && !driverSeatsValid) {
      out.push('Sürücü teklifi için koltuk sayısı (en az 1) zorunlu.');
    }

    return out;
  }, [fromPoint, toPoint, mapPinRequired, departureTimeConfirmed, suggestedBase, createRole, driverSeatsValid]);

  const canSubmit = missingReasons.length === 0;

  const showMissingAlert = useCallback(() => {
    if (missingReasons.length === 0) return;
    Alert.alert('Tamamlanması gerekenler', missingReasons.map((m) => `• ${m}`).join('\n\n'));
  }, [missingReasons]);

  const composedNote = useMemo(() => {
    const meta: string[] = [];
    if (createRole === 'driver') {
      const sc = parseInt(seatsText.replace(/\D/g, ''), 10);
      if (!Number.isNaN(sc) && sc > 0) meta.push(`Koltuk: ${sc}`);
      const vb = vehicleBrand.trim();
      const vm = vehicleModel.trim();
      const vc = vehicleColor.trim();
      if (vb || vm || vc) meta.push(`Araç: ${[vb, vm, vc].filter(Boolean).join(' · ')}`);
    } else {
      meta.push('Yolcu teklifi');
      const bud = parseFloat(passengerBudgetText.replace(',', '.'));
      if (!Number.isNaN(bud) && bud >= 0 && passengerBudgetText.trim()) {
        meta.push(`Bütçe üst sınırı: ${bud} ₺`);
      }
    }
    if (suggestedBase != null) {
      const finalP = Math.max(0, Math.round(suggestedBase + priceDelta));
      meta.push(`Ücret (taban±): ${finalP} ₺`);
    }
    if (priceMeta?.distance_km != null) meta.push(`Mesafe: ~${priceMeta.distance_km} km`);
    const head = meta.join(' · ');
    const tail = noteBody.trim();
    if (head && tail) return `${head}\n${tail}`;
    return head || tail || null;
  }, [
    createRole,
    noteBody,
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
    setPassengerBudgetText('');
  };

  const openPicker = (field: 'from' | 'to') => {
    setPickerField(field);
    setPickerOpen(true);
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
      if (!res.ok || !data.success || data.suggested_price == null) {
        const msg =
          typeof data.detail === 'string'
            ? data.detail
            : typeof data.error === 'string'
              ? data.error
              : 'Ücret şu an hesaplanamadı. Bağlantını kontrol edip tekrar dene.';
        Alert.alert('Ücret', msg);
        return;
      }
      setSuggestedBase(Math.round(Number(data.suggested_price)));
      setPriceDelta(0);
      setPriceMeta({
        distance_km: Number(data.distance_km ?? data.trip_distance_km ?? 0) || undefined,
        estimated_minutes: data.estimated_minutes,
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert('Ücret', 'Bağlantı hatası. Tekrar deneyin.');
    } finally {
      setPriceCalcBusy(false);
    }
  }, [base, fromPoint, toPoint, mapPinRequired]);

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
      const departure_time = buildDepartureIso(departureTab, futurePick, departureHm.h, departureHm.m);
      const body: Record<string, unknown> = {
        city: city.trim(),
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
      };

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

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalRoot} edges={['left', 'right', 'bottom']}>
        <ScreenHeaderGradient
          title={createRole === 'driver' ? 'Sürücü teklifi oluştur' : 'Yolcu teklifi oluştur'}
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
            <Text style={styles.sectionEyebrow}>Şehir</Text>
            <View style={styles.card}>
              <Text style={styles.cityLock}>{city}</Text>
            </View>

            <Text style={styles.sectionEyebrow}>Teklif türü</Text>
            <View style={styles.roleRow}>
              <TouchableOpacity
                style={[styles.roleChip, createRole === 'passenger' && styles.roleChipOn]}
                onPress={() => setCreateRole('passenger')}
                activeOpacity={0.85}
              >
                <Text style={[styles.roleChipText, createRole === 'passenger' && styles.roleChipTextOn]}>Yolcu</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.roleChip, createRole === 'driver' && styles.roleChipOn]}
                onPress={() => setCreateRole('driver')}
                activeOpacity={0.85}
              >
                <Text style={[styles.roleChipText, createRole === 'driver' && styles.roleChipTextOn]}>Sürücü</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionEyebrow}>Rota</Text>
            <TouchableOpacity style={styles.cardRow} onPress={() => openPicker('from')} activeOpacity={0.88}>
              <View style={[styles.icoWrap, { backgroundColor: 'rgba(59,130,246,0.12)' }]}>
                <Ionicons name="navigate-circle-outline" size={22} color="#2563eb" />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.rowLabel}>Nereden</Text>
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
                <Text style={styles.rowLabel}>Nereye</Text>
                <Text style={styles.rowValue} numberOfLines={2}>
                  {endpointSummary(toPoint)}
                </Text>
                {toPoint && mapPinRequired ? (
                  <Text style={styles.rowMeta}>{toPoint.mapPinConfirmed ? 'Harita onaylı' : 'Haritada “Tam burası” bekleniyor'}</Text>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={20} color={TEXT_MUTED} />
            </TouchableOpacity>

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

            <Text style={[styles.sectionEyebrow, { marginTop: 18 }]}>Ücret</Text>
            <View style={[styles.priceCard, createRole === 'driver' ? styles.priceCardDriver : styles.priceCardPassenger]}>
              <Text style={styles.priceLead}>Rota mesafesine göre sistem tabanı</Text>
              <GradientButton
                label={priceCalcBusy ? 'Hesaplanıyor…' : 'Taban fiyat hesapla'}
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
                  <Text style={styles.priceSub}>Önerilen tutar (± ile ince ayar)</Text>
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
                  </View>
                </View>
              ) : (
                <Text style={styles.priceHintMuted}>Önce tabanı hesapla; sonra istersen ±10 ₺ oynayabilirsin.</Text>
              )}
            </View>

            {createRole === 'driver' ? (
              <>
                <Text style={[styles.sectionEyebrow, { marginTop: 18 }]}>Kapasite</Text>
                <View style={styles.card}>
                  <Text style={styles.inLabel}>Koltuk (zorunlu)</Text>
                  <TextInput
                    style={styles.inField}
                    value={seatsText}
                    onChangeText={setSeatsText}
                    keyboardType="number-pad"
                    placeholder="Örn. 3"
                    placeholderTextColor={TEXT_MUTED}
                  />
                </View>

                <Text style={[styles.sectionEyebrow, { marginTop: 14 }]}>Araç bilgisi</Text>
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
            ) : (
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
              label="Teklifi aç"
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

        <MuhabbetEndpointPickerModal
          visible={pickerOpen}
          title={pickerField === 'from' ? 'Nereden' : 'Nereye'}
          city={city.trim()}
          biasLatitude={userBias?.latitude}
          biasLongitude={userBias?.longitude}
          onRequestClose={() => setPickerOpen(false)}
          onCommitted={onPickerCommitted}
        />

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
