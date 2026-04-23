/**
 * Muhabbet teklif oluşturma modalı — sürücü / yolcu formları.
 * Konum: PlacesAutocomplete + harita doğrulama; ücret: /price/calculate tabanı.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
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
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeaderGradient } from './ScreenHeaderGradient';
import { GradientButton } from './GradientButton';
import { handleUnauthorizedAndMaybeRedirect } from '../lib/muhabbetAuthRedirect';
import MuhabbetEndpointPickerModal, {
  muhabbetListingMapPinFlowAvailable,
  type MuhabbetCommittedPlace,
} from './MuhabbetEndpointPickerModal';

const PRIMARY_GRAD = ['#3B82F6', '#60A5FA'] as const;
const TEXT_PRIMARY = '#111111';
const TEXT_SECONDARY = '#6E6E73';

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

/** Geçmişe düşen saat ertesi güne alınır (kalkış ISO ile uyumlu). */
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
  const [repeatType, setRepeatType] = useState<'once' | 'daily' | 'weekly'>('once');
  const [selectedDays, setSelectedDays] = useState('');
  const [timeWindow, setTimeWindow] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [vehicleBrand, setVehicleBrand] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
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
      meta.push(`Tekrar: ${repeatType === 'once' ? 'bir kez' : repeatType === 'daily' ? 'günlük' : 'haftalık'}`);
      const sc = parseInt(seatsText.replace(/\D/g, ''), 10);
      if (!Number.isNaN(sc) && sc > 0) meta.push(`Koltuk: ${sc}`);
      if (selectedDays.trim()) meta.push(`Günler: ${selectedDays.trim()}`);
      if (timeWindow.trim()) meta.push(`Vakit: ${timeWindow.trim()}`);
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
    repeatType,
    seatsText,
    selectedDays,
    suggestedBase,
    timeWindow,
    vehicleBrand,
    vehicleModel,
    vehicleColor,
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
    setRepeatType('once');
    setSelectedDays('');
    setTimeWindow('');
    setNoteBody('');
    setVehicleBrand('');
    setVehicleModel('');
    setVehicleColor('');
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
              : 'Fiyat hesaplanamadı.';
        Alert.alert('Ücret', msg);
        return;
      }
      setSuggestedBase(Math.round(Number(data.suggested_price)));
      setPriceDelta(0);
      setPriceMeta({
        distance_km: Number(data.distance_km ?? data.trip_distance_km ?? 0) || undefined,
        estimated_minutes: data.estimated_minutes,
      });
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
      if (shouldUseLegacyListingCreate(res.status)) {
        res = await fetch(`${base}/muhabbet/listings/create`, {
          method: 'POST',
          headers: { ...authHeader(tok), 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }
      if (handleUnauthorizedAndMaybeRedirect(res)) return;
      const d = (await res.json().catch(() => ({}))) as { success?: boolean; detail?: string };
      if (!res.ok || !d.success) {
        Alert.alert('Teklif', typeof d.detail === 'string' && d.detail ? d.detail : 'Kaydedilemedi.');
        return;
      }
      Alert.alert('Teklif', 'Teklifin açıldı.');
      onClose();
      resetForm();
      onCreated?.();
    } catch {
      Alert.alert('Teklif', 'Bağlantı hatası.');
    } finally {
      setCreateBusy(false);
    }
  };

  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);
  const minutes = useMemo(() => Array.from({ length: 12 }, (_, i) => i * 5), []);

  const endpointSummary = (p: MuhabbetCommittedPlace | null) =>
    p ? (p.address.length > 52 ? `${p.address.slice(0, 52)}…` : p.address) : 'Seçmek için dokun';

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalRoot} edges={['left', 'right', 'bottom']}>
        <ScreenHeaderGradient
          title={createRole === 'driver' ? 'Sürücü teklifi oluştur' : 'Yolcu teklifi oluştur'}
          onBack={onClose}
          backIcon="close"
          gradientColors={PRIMARY_GRAD}
        />
        <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.inputLabel}>Şehir (şehir içi)</Text>
          <Text style={styles.cityLock}>{city}</Text>

          <Text style={styles.inputLabel}>Teklif türü</Text>
          <View style={styles.rolePick}>
            <TouchableOpacity
              style={[styles.roleOpt, createRole === 'passenger' && styles.roleOptOn]}
              onPress={() => setCreateRole('passenger')}
            >
              <Text style={styles.roleOptText}>Yolcu</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.roleOpt, createRole === 'driver' && styles.roleOptOn]}
              onPress={() => setCreateRole('driver')}
            >
              <Text style={styles.roleOptText}>Sürücü</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.inputLabel}>Nereden</Text>
          <TouchableOpacity style={styles.endpointRow} onPress={() => openPicker('from')} activeOpacity={0.88}>
            <Ionicons name="navigate-circle-outline" size={22} color="#3B82F6" />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.endpointText} numberOfLines={2}>
                {endpointSummary(fromPoint)}
              </Text>
              {fromPoint && mapPinRequired ? (
                <Text style={styles.endpointMeta}>
                  Harita: {fromPoint.mapPinConfirmed ? 'doğrulandı' : '“Tam burası” bekleniyor'}
                </Text>
              ) : null}
            </View>
            <Ionicons name="chevron-forward" size={20} color={TEXT_SECONDARY} />
          </TouchableOpacity>

          <Text style={styles.inputLabel}>Nereye</Text>
          <TouchableOpacity style={styles.endpointRow} onPress={() => openPicker('to')} activeOpacity={0.88}>
            <Ionicons name="flag-outline" size={22} color="#F59E0B" />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.endpointText} numberOfLines={2}>
                {endpointSummary(toPoint)}
              </Text>
              {toPoint && mapPinRequired ? (
                <Text style={styles.endpointMeta}>
                  Harita: {toPoint.mapPinConfirmed ? 'doğrulandı' : '“Tam burası” bekleniyor'}
                </Text>
              ) : null}
            </View>
            <Ionicons name="chevron-forward" size={20} color={TEXT_SECONDARY} />
          </TouchableOpacity>

          <Text style={styles.inputLabel}>Saat</Text>
          <TouchableOpacity
            style={styles.endpointRow}
            onPress={() => {
              setTimeDraft({ ...departureHm });
              setTimeModalOpen(true);
            }}
            activeOpacity={0.88}
          >
            <Ionicons name="time-outline" size={22} color="#3B82F6" />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.endpointText}>{departureDayLabel(departureHm.h, departureHm.m)}</Text>
              {!departureTimeConfirmed ? (
                <Text style={styles.endpointMeta}>Onay için dokunup altta “Tamam”a bas.</Text>
              ) : (
                <Text style={styles.endpointMetaOk}>Saat onaylandı</Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={20} color={TEXT_SECONDARY} />
          </TouchableOpacity>

          <Text style={styles.inputLabel}>Ücret</Text>
          <View style={styles.priceCard}>
            <Text style={styles.priceHint}>
              Ana uygulama ile aynı taban: nereden / nereye koordinatlarından sunucu hesaplar.
            </Text>
            <GradientButton
              label={priceCalcBusy ? 'Hesaplanıyor…' : 'Taban fiyat hesapla'}
              loading={priceCalcBusy}
              onPress={() => void calcBasePrice()}
              disabled={!fromPoint || !toPoint || (mapPinRequired && (!fromPoint.mapPinConfirmed || !toPoint.mapPinConfirmed))}
              style={{ marginTop: 8 }}
            />
            {priceMeta?.distance_km != null ? (
              <Text style={styles.metaSmall}>
                ~{priceMeta.distance_km} km
                {priceMeta.estimated_minutes != null ? ` · ~${priceMeta.estimated_minutes} dk` : ''}
              </Text>
            ) : null}
            {finalPriceInt != null ? (
              <View style={styles.priceFinalRow}>
                <Text style={styles.priceBig}>{finalPriceInt} ₺</Text>
                <View style={styles.stepRow}>
                  <TouchableOpacity
                    style={styles.stepBtn}
                    onPress={() => setPriceDelta((d) => d - 10)}
                    disabled={suggestedBase == null}
                  >
                    <Text style={styles.stepBtnText}>−10</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.stepBtn}
                    onPress={() => setPriceDelta((d) => d + 10)}
                    disabled={suggestedBase == null}
                  >
                    <Text style={styles.stepBtnText}>+10</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.stepBtn}
                    onPress={() => setPriceDelta(0)}
                    disabled={suggestedBase == null}
                  >
                    <Text style={styles.stepBtnText}>Taban</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <Text style={styles.metaSmall}>Taban alındıktan sonra ±10 ₺ ile oynayabilir veya tabana dönebilirsiniz.</Text>
            )}
          </View>

          {createRole === 'driver' ? (
            <>
              <Text style={styles.inputLabel}>Koltuk (zorunlu)</Text>
              <TextInput style={styles.input} value={seatsText} onChangeText={setSeatsText} keyboardType="number-pad" placeholder="Örn. 3" />
              <Text style={styles.inputLabel}>Araç bilgisi (opsiyonel)</Text>
              <TextInput style={styles.input} value={vehicleBrand} onChangeText={setVehicleBrand} placeholder="Marka (örn. Toyota)" />
              <TextInput
                style={[styles.input, { marginTop: 8 }]}
                value={vehicleModel}
                onChangeText={setVehicleModel}
                placeholder="Model (örn. Corolla)"
              />
              <TextInput
                style={[styles.input, { marginTop: 8 }]}
                value={vehicleColor}
                onChangeText={setVehicleColor}
                placeholder="Renk (örn. Gri)"
              />
              <Text style={styles.inputLabel}>Tekrar</Text>
              <View style={styles.rolePick}>
                {(['once', 'daily', 'weekly'] as const).map((rt) => (
                  <TouchableOpacity key={rt} style={[styles.roleOpt, repeatType === rt && styles.roleOptOn]} onPress={() => setRepeatType(rt)}>
                    <Text style={styles.roleOptText}>{rt === 'once' ? 'Bir kez' : rt === 'daily' ? 'Günlük' : 'Haftalık'}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.inputLabel}>Seçili günler (opsiyonel)</Text>
              <TextInput style={styles.input} value={selectedDays} onChangeText={setSelectedDays} placeholder="örn. Cmt–Paz" />
              <Text style={styles.inputLabel}>Vakit penceresi (opsiyonel)</Text>
              <TextInput style={styles.input} value={timeWindow} onChangeText={setTimeWindow} placeholder="08:00–09:00" />
              <Text style={styles.inputLabel}>Ek not</Text>
              <TextInput style={[styles.input, { minHeight: 88 }]} value={noteBody} onChangeText={setNoteBody} multiline placeholder="Ek bilgi" />
              <Text style={styles.hint}>
                Geçici: tekrar, koltuk, günler, vakit ve araç bilgisi şimdilik not metnine eklenir; kalıcı çözüm değildir.
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.inputLabel}>Bütçe üst sınırı (opsiyonel, ₺)</Text>
              <TextInput
                style={styles.input}
                value={passengerBudgetText}
                onChangeText={setPassengerBudgetText}
                keyboardType="decimal-pad"
                placeholder="İstersen yaz"
              />
              <Text style={styles.inputLabel}>Ek not</Text>
              <TextInput style={[styles.input, { minHeight: 88 }]} value={noteBody} onChangeText={setNoteBody} multiline placeholder="Ek bilgi" />
            </>
          )}

          <View style={{ height: 8 }} />
          <GradientButton
            label="Teklifi aç"
            loading={createBusy}
            disabled={!canSubmit}
            onPress={() => void submitCreate()}
            style={{ marginTop: 8 }}
          />
          {!canSubmit && !createBusy ? (
            <TouchableOpacity onPress={showMissingAlert} style={styles.missingLink}>
              <Text style={styles.missingLinkText}>Neler eksik? — dokun ve listeyi gör</Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>

        <MuhabbetEndpointPickerModal
          visible={pickerOpen}
          title={pickerField === 'from' ? 'Nereden' : 'Nereye'}
          city={city.trim()}
          biasLatitude={userBias?.latitude}
          biasLongitude={userBias?.longitude}
          onRequestClose={() => setPickerOpen(false)}
          onCommitted={onPickerCommitted}
        />

        <Modal visible={timeModalOpen} transparent animationType="fade" onRequestClose={() => setTimeModalOpen(false)}>
          <Pressable style={styles.timeOverlay} onPress={() => setTimeModalOpen(false)}>
            <Pressable style={styles.timeSheet} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.timeSheetTitle}>Saat seç</Text>
              <Text style={styles.timePreview}>{departureDayLabel(timeDraft.h, timeDraft.m)}</Text>
              <View style={styles.timeColumns}>
                <ScrollView style={styles.timeScroll} showsVerticalScrollIndicator={false}>
                  {hours.map((h) => (
                    <TouchableOpacity
                      key={h}
                      style={[styles.timeChip, timeDraft.h === h && styles.timeChipOn]}
                      onPress={() => setTimeDraft((t) => ({ ...t, h }))}
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
                      onPress={() => setTimeDraft((t) => ({ ...t, m }))}
                    >
                      <Text style={[styles.timeChipText, timeDraft.m === m && styles.timeChipTextOn]}>{pad2(m)}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              <GradientButton
                label="Tamam"
                onPress={() => {
                  setDepartureHm({ ...timeDraft });
                  setDepartureTimeConfirmed(true);
                  setTimeModalOpen(false);
                }}
              />
            </Pressable>
          </Pressable>
        </Modal>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1, backgroundColor: '#F2F2F7' },
  modalScroll: { padding: 16, paddingBottom: 40 },
  inputLabel: { marginTop: 12, marginBottom: 6, fontSize: 13, fontWeight: '600', color: TEXT_SECONDARY },
  cityLock: { fontSize: 17, fontWeight: '700', color: TEXT_PRIMARY },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60,60,67,0.2)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: TEXT_PRIMARY,
    backgroundColor: '#fff',
  },
  rolePick: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  roleOpt: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: 'rgba(60,60,67,0.08)' },
  roleOptOn: { backgroundColor: 'rgba(59,130,246,0.2)' },
  roleOptText: { fontSize: 14, fontWeight: '600', color: TEXT_PRIMARY },
  hint: { marginTop: 10, fontSize: 12, color: TEXT_SECONDARY, lineHeight: 18 },
  endpointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60,60,67,0.2)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  endpointText: { fontSize: 15, color: TEXT_PRIMARY, fontWeight: '500' },
  endpointMeta: { marginTop: 4, fontSize: 12, color: TEXT_SECONDARY },
  endpointMetaOk: { marginTop: 4, fontSize: 12, color: '#15803D', fontWeight: '600' },
  priceCard: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60,60,67,0.2)',
    padding: 14,
    backgroundColor: '#fff',
  },
  priceHint: { fontSize: 13, color: TEXT_SECONDARY, lineHeight: 18 },
  metaSmall: { marginTop: 8, fontSize: 12, color: TEXT_SECONDARY },
  priceFinalRow: { marginTop: 12 },
  priceBig: { fontSize: 28, fontWeight: '800', color: TEXT_PRIMARY },
  stepRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  stepBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(59,130,246,0.12)',
  },
  stepBtnText: { fontSize: 14, fontWeight: '700', color: '#1D4ED8' },
  missingLink: { marginTop: 10, alignSelf: 'center', paddingVertical: 6 },
  missingLinkText: { fontSize: 13, color: '#2563EB', fontWeight: '600' },
  timeOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  timeSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 18,
    paddingBottom: 28,
  },
  timeSheetTitle: { fontSize: 17, fontWeight: '800', color: TEXT_PRIMARY, marginBottom: 8 },
  timePreview: { fontSize: 15, fontWeight: '700', color: '#1D4ED8', marginBottom: 12 },
  timeColumns: { flexDirection: 'row', gap: 12, maxHeight: 220, marginBottom: 16 },
  timeScroll: { flex: 1 },
  timeChip: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 6,
    backgroundColor: 'rgba(60,60,67,0.06)',
    alignItems: 'center',
  },
  timeChipOn: { backgroundColor: 'rgba(59,130,246,0.22)' },
  timeChipText: { fontSize: 16, fontWeight: '600', color: TEXT_PRIMARY },
  timeChipTextOn: { color: '#1D4ED8' },
});
