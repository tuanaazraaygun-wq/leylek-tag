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
import { LinearGradient } from 'expo-linear-gradient';
import { ScreenHeaderGradient } from './ScreenHeaderGradient';
import { GradientButton } from './GradientButton';
import { handleUnauthorizedAndMaybeRedirect } from '../lib/muhabbetAuthRedirect';
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

function defaultDepartureHm(): { h: number; m: number } {
  const d = new Date();
  d.setMinutes(d.getMinutes() + 50, 0, 0);
  return { h: d.getHours(), m: Math.round(d.getMinutes() / 5) * 5 % 60 };
}

function buildDepartureIsoFromHm(h: number, m: number): string {
  const now = new Date();
  let d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
  if (d.getTime() <= now.getTime() + 5 * 60 * 1000) {
    d = new Date(d.getTime() + 24 * 60 * 60 * 1000);
  }
  return d.toISOString();
}

function departureDayLabel(h: number, m: number): string {
  const now = new Date();
  let d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
  const rollsTomorrow = d.getTime() <= now.getTime() + 5 * 60 * 1000;
  const prefix = rollsTomorrow ? 'Yarın' : 'Bugün';
  return `${prefix} ${pad2(h)}:${pad2(m)}`;
}

function hasFiniteCoords(p: MuhabbetCommittedPlace | null): boolean {
  if (!p) return false;
  return Number.isFinite(p.latitude) && Number.isFinite(p.longitude);
}

function userSafeSubmitError(status: number, detail: unknown, bodyText: string): string {
  const d = typeof detail === 'string' ? detail : '';
  if (status >= 500) return 'Teklif oluşturulamadı. Lütfen tekrar deneyin.';
  if (/column|schema|could not find|postgres|sql/i.test(d + bodyText)) {
    return 'Teklif oluşturulamadı. Lütfen tekrar deneyin.';
  }
  if (d.trim()) return d.trim();
  return 'Teklif oluşturulamadı. Lütfen tekrar deneyin.';
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
  const base = apiUrl.replace(/\/$/, '');
  const mapPinRequired = muhabbetListingMapPinFlowAvailable();

  const [createRole, setCreateRole] = useState<'driver' | 'passenger'>(initialRole);
  const [fromPoint, setFromPoint] = useState<MuhabbetCommittedPlace | null>(null);
  const [toPoint, setToPoint] = useState<MuhabbetCommittedPlace | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerField, setPickerField] = useState<'from' | 'to'>('from');
  const [userBias, setUserBias] = useState<{ latitude: number; longitude: number } | null>(null);

  const [departureHm, setDepartureHm] = useState(defaultDepartureHm);
  const [timeModalOpen, setTimeModalOpen] = useState(false);
  const [timeDraft, setTimeDraft] = useState(defaultDepartureHm);
  const [departureTimeConfirmed, setDepartureTimeConfirmed] = useState(false);

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
    if (!requireToken() || !tok) return;
    if (!canSubmit) {
      showMissingAlert();
      return;
    }
    if (!fromPoint || !toPoint || suggestedBase == null || finalPriceInt == null) {
      showMissingAlert();
      return;
    }
    setCreateBusy(true);
    try {
      const listing_type = createRole === 'driver' ? 'gidiyorum' : 'gidecegim';
      const role_type = createRole === 'driver' ? 'driver' : 'passenger';
      const departure_time = buildDepartureIsoFromHm(departureHm.h, departureHm.m);
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

      let res = await fetch(`${base}/muhabbet/listings`, {
        method: 'POST',
        headers: { ...authHeader(tok), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      let rawBody = await res.text();
      if (shouldUseLegacyListingCreate(res.status)) {
        res = await fetch(`${base}/muhabbet/listings/create`, {
          method: 'POST',
          headers: { ...authHeader(tok), 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        rawBody = await res.text();
      }
      if (handleUnauthorizedAndMaybeRedirect(res)) return;
      let d: { success?: boolean; detail?: string } = {};
      try {
        d = JSON.parse(rawBody) as typeof d;
      } catch {
        d = {};
      }
      if (!res.ok || !d.success) {
        const friendly = userSafeSubmitError(res.status, d.detail, rawBody);
        Alert.alert('Teklif', friendly);
        return;
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Teklif', 'Teklifin açıldı.');
      onClose();
      resetForm();
      onCreated?.();
    } catch {
      Alert.alert('Teklif', 'Teklif oluşturulamadı. Lütfen tekrar deneyin.');
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
            contentContainerStyle={styles.modalScroll}
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
                setTimeModalOpen(true);
              }}
              activeOpacity={0.88}
            >
              <View style={[styles.icoWrap, { backgroundColor: 'rgba(148,163,184,0.15)' }]}>
                <Ionicons name="time-outline" size={22} color="#475569" />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.rowLabel}>Kalkış</Text>
                <Text style={styles.rowTimeMain}>{departureDayLabel(departureHm.h, departureHm.m)}</Text>
                {!departureTimeConfirmed ? (
                  <Text style={styles.rowMeta}>Onay için dokun — altta “Tamam”</Text>
                ) : (
                  <Text style={styles.rowMetaOk}>Saat onaylandı</Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={20} color={TEXT_MUTED} />
            </TouchableOpacity>

            <Text style={[styles.sectionEyebrow, { marginTop: 18 }]}>Ücret</Text>
            <View style={styles.priceCard}>
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
              disabled={!canSubmit}
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
              <LinearGradient colors={['#1e293b', '#0f172a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.timeSheetHero}>
                <Text style={styles.timeSheetEyebrow}>Kalkış saati</Text>
                <Text style={styles.timeSheetBig}>{departureDayLabel(timeDraft.h, timeDraft.m)}</Text>
              </LinearGradient>
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
    paddingBottom: 28,
  },
  timeSheetHero: { paddingHorizontal: 20, paddingVertical: 22 },
  timeSheetEyebrow: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.65)', letterSpacing: 1 },
  timeSheetBig: { marginTop: 8, fontSize: 28, fontWeight: '800', color: '#fff' },
  timeColumns: { flexDirection: 'row', gap: 14, paddingHorizontal: 16, maxHeight: 240, marginTop: 16 },
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
