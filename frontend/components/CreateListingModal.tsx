/**
 * Muhabbet teklif oluşturma modalı — sürücü / yolcu formları (UI dili).
 * Ekstra alanların bir kısmı geçici olarak `note` içinde birleştirilir (kalıcı değildir).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeaderGradient } from './ScreenHeaderGradient';
import { GradientButton } from './GradientButton';
import { handleUnauthorizedAndMaybeRedirect } from '../lib/muhabbetAuthRedirect';

const PRIMARY_GRAD = ['#3B82F6', '#60A5FA'] as const;
const TEXT_PRIMARY = '#111111';
const TEXT_SECONDARY = '#6E6E73';

function authHeader(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

/** Yeni route yok / proxy uyumsuz: legacy create’e düş. */
function shouldUseLegacyListingCreate(status: number): boolean {
  return status === 404 || status === 405 || status === 501;
}

export type CreateListingModalProps = {
  visible: boolean;
  onClose: () => void;
  apiUrl: string;
  accessToken: string;
  city: string;
  /** Modal açıldığında seçili rol */
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

  const [createRole, setCreateRole] = useState<'driver' | 'passenger'>(initialRole);
  const [fromText, setFromText] = useState('');
  const [toText, setToText] = useState('');
  const [departureIso, setDepartureIso] = useState('');
  const [priceText, setPriceText] = useState('');
  const [seatsText, setSeatsText] = useState('');
  const [repeatType, setRepeatType] = useState<'once' | 'daily' | 'weekly'>('once');
  const [selectedDays, setSelectedDays] = useState('');
  const [timeWindow, setTimeWindow] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [vehicleBrand, setVehicleBrand] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [createBusy, setCreateBusy] = useState(false);

  useEffect(() => {
    if (visible) setCreateRole(initialRole);
  }, [visible, initialRole]);

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
      const pv = parseFloat(priceText.replace(',', '.'));
      if (!Number.isNaN(pv) && pv >= 0) meta.push(`Bütçe: ${pv} ₺`);
    }
    const head = meta.join(' · ');
    const tail = noteBody.trim();
    if (head && tail) return `${head}\n${tail}`;
    return head || tail || null;
  }, [
    createRole,
    noteBody,
    priceText,
    repeatType,
    seatsText,
    selectedDays,
    timeWindow,
    vehicleBrand,
    vehicleModel,
    vehicleColor,
  ]);

  const resetForm = () => {
    setFromText('');
    setToText('');
    setDepartureIso('');
    setPriceText('');
    setSeatsText('');
    setRepeatType('once');
    setSelectedDays('');
    setTimeWindow('');
    setNoteBody('');
    setVehicleBrand('');
    setVehicleModel('');
    setVehicleColor('');
  };

  const submitCreate = async () => {
    if (!requireToken() || !tok) return;
    const ft = fromText.trim();
    const tt = toText.trim();
    if (!ft || !tt) {
      Alert.alert('Teklif', 'Nereden ve nereye alanlarını doldurun.');
      return;
    }
    setCreateBusy(true);
    try {
      const listing_type = createRole === 'driver' ? 'gidiyorum' : 'gidecegim';
      const role_type = createRole === 'driver' ? 'driver' : 'passenger';
      let departure_time: string | undefined;
      if (departureIso.trim()) {
        const d = new Date(departureIso.trim());
        if (!Number.isNaN(d.getTime())) departure_time = d.toISOString();
      }
      const priceVal = parseFloat(priceText.replace(',', '.'));
      const body: Record<string, unknown> = {
        city: city.trim(),
        from_text: ft,
        to_text: tt,
        listing_type,
        role_type,
        note: composedNote,
      };
      if (departure_time) body.departure_time = departure_time;
      if (!Number.isNaN(priceVal) && priceVal >= 0) body.price_amount = priceVal;

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
          <TextInput style={styles.input} value={fromText} onChangeText={setFromText} placeholder="Örn. Kızılay" />
          <Text style={styles.inputLabel}>Nereye</Text>
          <TextInput style={styles.input} value={toText} onChangeText={setToText} placeholder="Örn. Batıkent" />

          {createRole === 'driver' ? (
            <>
              <Text style={styles.inputLabel}>Saat</Text>
              <TextInput
                style={styles.input}
                value={departureIso}
                onChangeText={setDepartureIso}
                placeholder="2026-04-25T08:00:00"
                autoCapitalize="none"
              />
              <Text style={styles.inputLabel}>Ücret</Text>
              <TextInput style={styles.input} value={priceText} onChangeText={setPriceText} keyboardType="decimal-pad" placeholder="150 ₺" />
              <Text style={styles.inputLabel}>Koltuk</Text>
              <TextInput style={styles.input} value={seatsText} onChangeText={setSeatsText} keyboardType="number-pad" placeholder="3" />
              <Text style={styles.inputLabel}>Araç bilgisi</Text>
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
              <Text style={styles.inputLabel}>Saat</Text>
              <TextInput
                style={styles.input}
                value={departureIso}
                onChangeText={setDepartureIso}
                placeholder="2026-04-25T08:00:00"
                autoCapitalize="none"
              />
              <Text style={styles.inputLabel}>Ücret</Text>
              <TextInput style={styles.input} value={priceText} onChangeText={setPriceText} keyboardType="decimal-pad" placeholder="120 ₺" />
              <Text style={styles.inputLabel}>Ek not</Text>
              <TextInput style={[styles.input, { minHeight: 88 }]} value={noteBody} onChangeText={setNoteBody} multiline placeholder="Ek bilgi" />
            </>
          )}

          <View style={{ height: 8 }} />
          <GradientButton label="Teklifi aç" loading={createBusy} onPress={() => void submitCreate()} style={{ marginTop: 8 }} />
        </ScrollView>
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
});
