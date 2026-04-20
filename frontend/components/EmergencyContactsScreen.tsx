import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Contacts from 'expo-contacts';
import {
  apiEmergencyContactCreate,
  apiEmergencyContactDelete,
  apiEmergencyContactPatch,
  apiEmergencyContactsList,
  type EmergencyContactRow,
} from '../lib/emergencyContactsApi';

type Props = {
  onBack: () => void;
};

function validateTurkishMobileDigits(input: string): { ok: true; ten: string } | { ok: false; message: string } {
  const raw = String(input || '').replace(/\D/g, '');
  let c = raw;
  if (c.startsWith('90') && c.length >= 12) c = c.slice(2);
  if (c.startsWith('0') && c.length >= 11) c = c.slice(1);
  if (c.length !== 10) {
    return { ok: false, message: 'Cep telefonu 10 hane olmalıdır (5 ile başlar).' };
  }
  if (!c.startsWith('5')) {
    return { ok: false, message: 'Geçerli bir Türkiye cep numarası girin (5XX…).' };
  }
  if (!/^\d{10}$/.test(c)) {
    return { ok: false, message: 'Numara yalnızca rakamlardan oluşmalıdır.' };
  }
  return { ok: true, ten: c };
}

function backendDetailMessage(json: Record<string, unknown>, fallback: string): string {
  const d = json?.detail;
  if (typeof d === 'string' && d.trim()) return d.trim();
  return fallback;
}

export default function EmergencyContactsScreen({ onBack }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<EmergencyContactRow[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiEmergencyContactsList();
      if (data?.success && Array.isArray(data.contacts)) {
        setRows(data.contacts);
      } else {
        setRows([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const openAdd = () => {
    setEditId(null);
    setFormName('');
    setFormPhone('');
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (r: EmergencyContactRow) => {
    setEditId(r.id);
    setFormName(r.name);
    setFormPhone('');
    setFormError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
  };

  const submitForm = async () => {
    const name = formName.trim();
    if (!name) {
      setFormError('İsim gerekli.');
      return;
    }
    if (editId) {
      const patch: { name?: string; phone?: string } = { name };
      const ph = formPhone.trim();
      if (ph) {
        const v = validateTurkishMobileDigits(ph);
        if (!v.ok) {
          setFormError(v.message);
          return;
        }
        patch.phone = ph;
      }
      setSaving(true);
      setFormError(null);
      try {
        const { ok, status, json } = await apiEmergencyContactPatch(editId, patch);
        if (!ok) {
          setFormError(backendDetailMessage(json, 'Güncellenemedi.'));
          if (status === 401) Alert.alert('Oturum', 'Lütfen tekrar giriş yapın.');
          return;
        }
        setModalOpen(false);
        await refresh();
      } finally {
        setSaving(false);
      }
      return;
    }

    const ph = formPhone.trim();
    if (!ph) {
      setFormError('Telefon gerekli.');
      return;
    }
    const v = validateTurkishMobileDigits(ph);
    if (!v.ok) {
      setFormError(v.message);
      return;
    }
    if (rows.length >= 3) {
      setFormError('En fazla 3 acil kişi ekleyebilirsiniz.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const { ok, status, json } = await apiEmergencyContactCreate({
        name,
        phone: ph,
        source: 'manual',
        sort_order: rows.length,
      });
      if (!ok) {
        if (status === 409) {
          setFormError(backendDetailMessage(json, 'Bu numara zaten kayıtlı.'));
        } else if (status === 422) {
          setFormError(backendDetailMessage(json, 'Bilgiler geçersiz.'));
        } else if (status === 401) {
          Alert.alert('Oturum', 'Lütfen tekrar giriş yapın.');
        } else {
          setFormError(backendDetailMessage(json, 'Kayıt eklenemedi.'));
        }
        return;
      }
      setModalOpen(false);
      await refresh();
    } finally {
      setSaving(false);
    }
  };

  const pickFromDevice = async () => {
    if (rows.length >= 3) {
      Alert.alert('Limit', 'En fazla 3 acil kişi ekleyebilirsiniz.');
      return;
    }
    if (Platform.OS === 'web') {
      Alert.alert('Bilgi', 'Rehber seçimi bu platformda desteklenmiyor. Lütfen numarayı elle girin.');
      return;
    }
    try {
      const perm = await Contacts.requestPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert('İzin gerekli', 'Rehberden kişi seçmek için rehber izni vermeniz gerekir.');
        return;
      }
      if (typeof Contacts.presentContactPickerAsync !== 'function') {
        Alert.alert('Hata', 'Rehber seçici kullanılamıyor. Uygulamayı güncelleyin veya numarayı elle girin.');
        return;
      }
      const picked = await Contacts.presentContactPickerAsync();
      if (!picked) return;
      const nums = picked.phoneNumbers || [];
      const raw =
        nums.find((n) => String(n.number || '').replace(/\D/g, '').length >= 10)?.number ||
        nums[0]?.number ||
        '';
      if (!raw) {
        Alert.alert('Numara yok', 'Seçilen kişide telefon numarası bulunamadı.');
        return;
      }
      const v = validateTurkishMobileDigits(raw);
      if (!v.ok) {
        Alert.alert('Numara', v.message);
        return;
      }
      const disp =
        [picked.firstName, picked.lastName].filter(Boolean).join(' ').trim() ||
        picked.name ||
        'Kişi';
      setSaving(true);
      try {
        const { ok, status, json } = await apiEmergencyContactCreate({
          name: disp,
          phone: raw,
          source: 'device_contact',
          sort_order: rows.length,
        });
        if (!ok) {
          if (status === 409) {
            Alert.alert('Çift kayıt', backendDetailMessage(json, 'Bu numara zaten kayıtlı.'));
          } else if (status === 401) {
            Alert.alert('Oturum', 'Lütfen tekrar giriş yapın.');
          } else {
            Alert.alert('Hata', backendDetailMessage(json, 'Kişi eklenemedi.'));
          }
          return;
        }
        await refresh();
      } finally {
        setSaving(false);
      }
    } catch (e) {
      console.warn('[EmergencyContacts] picker', e);
      Alert.alert('Hata', 'Rehber açılamadı. Tekrar deneyin veya numarayı elle girin.');
    }
  };

  const confirmDelete = (r: EmergencyContactRow) => {
    Alert.alert(
      'Kişiyi sil',
      `${r.name} listeden kaldırılsın mı?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              const { ok, status, detail } = await apiEmergencyContactDelete(r.id);
              if (!ok) {
                if (status === 409) {
                  Alert.alert('Silinemez', detail || 'Son acil kişiyi silemezsiniz.');
                } else if (status === 401) {
                  Alert.alert('Oturum', 'Lütfen tekrar giriş yapın.');
                } else {
                  Alert.alert('Hata', 'Silinemedi.');
                }
                return;
              }
              await refresh();
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color="#E2E8F0" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Acil durum kişileri</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.ruleBanner}>
        <Ionicons name="information-circle" size={20} color="#7DD3FC" />
        <Text style={styles.ruleText}>
          En az <Text style={styles.ruleStrong}>1</Text>, en çok <Text style={styles.ruleStrong}>3</Text> kişi
          kaydedebilirsiniz. Panik SMS yalnızca bu listedeki numaralara gider.
        </Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#3FA9F5" />
          <Text style={styles.muted}>Yükleniyor…</Text>
        </View>
      ) : rows.length === 0 ? (
        <ScrollView contentContainerStyle={styles.emptyWrap} keyboardShouldPersistTaps="handled">
          <Ionicons name="people-outline" size={56} color="#64748B" />
          <Text style={styles.emptyTitle}>Henüz acil kişi yok</Text>
          <Text style={styles.emptyBody}>
            Güvenliğiniz için en az bir güvendiğiniz kişiyi ekleyin. Numarayı elle girebilir veya rehberinizden tek
            seferde bir kişi seçebilirsiniz.
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={openAdd} disabled={saving}>
            <Ionicons name="add-circle-outline" size={22} color="#0F172A" />
            <Text style={styles.primaryBtnText}>Manuel ekle</Text>
          </TouchableOpacity>
          {Platform.OS !== 'web' ? (
            <TouchableOpacity style={styles.secondaryBtn} onPress={pickFromDevice} disabled={saving}>
              <Ionicons name="book-outline" size={20} color="#E2E8F0" />
              <Text style={styles.secondaryBtnText}>Rehberden seç</Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.listPad} keyboardShouldPersistTaps="handled">
          {rows.map((r) => (
            <View key={r.id} style={styles.card}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName}>{r.name}</Text>
                <Text style={styles.cardPhone}>{r.phone_masked}</Text>
                <Text style={styles.cardMeta}>
                  {r.source === 'device_contact' ? 'Rehberden eklendi' : 'Manuel'}
                </Text>
              </View>
              <View style={styles.cardActions}>
                <TouchableOpacity onPress={() => openEdit(r)} style={styles.iconHit} disabled={saving}>
                  <Ionicons name="pencil" size={20} color="#93C5FD" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => confirmDelete(r)} style={styles.iconHit} disabled={saving}>
                  <Ionicons name="trash-outline" size={20} color="#FCA5A5" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
          {rows.length < 3 ? (
            <View style={styles.addRow}>
              <TouchableOpacity style={styles.primaryBtn} onPress={openAdd} disabled={saving}>
                <Ionicons name="add" size={22} color="#0F172A" />
                <Text style={styles.primaryBtnText}>Manuel ekle</Text>
              </TouchableOpacity>
              {Platform.OS !== 'web' ? (
                <TouchableOpacity style={styles.secondaryBtn} onPress={pickFromDevice} disabled={saving}>
                  <Ionicons name="book-outline" size={20} color="#E2E8F0" />
                  <Text style={styles.secondaryBtnText}>Rehberden seç</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : (
            <Text style={styles.limitNote}>Maksimum 3 kişiye ulaştınız. Yeni eklemek için önce silin veya düzenleyin.</Text>
          )}
        </ScrollView>
      )}

      <Modal visible={modalOpen} transparent animationType="fade" onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editId ? 'Kişiyi düzenle' : 'Kişi ekle'}</Text>
            <Text style={styles.label}>İsim</Text>
            <TextInput
              value={formName}
              onChangeText={setFormName}
              placeholder="Ad Soyad"
              placeholderTextColor="#64748B"
              style={styles.input}
              editable={!saving}
            />
            <Text style={styles.label}>{editId ? 'Telefon (değiştirmek için girin)' : 'Telefon'}</Text>
            <TextInput
              value={formPhone}
              onChangeText={setFormPhone}
              placeholder={editId ? 'Boş bırakırsanız numara değişmez' : '5XX XXX XX XX'}
              placeholderTextColor="#64748B"
              style={styles.input}
              keyboardType="phone-pad"
              editable={!saving}
            />
            {formError ? <Text style={styles.formErr}>{formError}</Text> : null}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={closeModal} disabled={saving}>
                <Text style={styles.secondaryBtnText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryBtn} onPress={() => void submitForm()} disabled={saving}>
                {saving ? (
                  <ActivityIndicator color="#0F172A" />
                ) : (
                  <Text style={styles.primaryBtnText}>{editId ? 'Kaydet' : 'Ekle'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F172A' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1E293B',
  },
  backBtn: { padding: 8 },
  headerTitle: { color: '#F8FAFC', fontSize: 17, fontWeight: '700' },
  ruleBanner: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    marginHorizontal: 12,
    marginTop: 10,
    backgroundColor: '#1E3A5F',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  ruleText: { flex: 1, color: '#CBD5E1', fontSize: 13, lineHeight: 19 },
  ruleStrong: { color: '#F8FAFC', fontWeight: '800' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  muted: { color: '#94A3B8', marginTop: 10 },
  emptyWrap: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
  },
  emptyTitle: { color: '#F1F5F9', fontSize: 20, fontWeight: '700', marginTop: 16, textAlign: 'center' },
  emptyBody: {
    color: '#94A3B8',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 24,
  },
  listPad: { padding: 16, paddingBottom: 32 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardName: { color: '#F8FAFC', fontSize: 16, fontWeight: '700' },
  cardPhone: { color: '#94A3B8', fontSize: 14, marginTop: 4 },
  cardMeta: { color: '#64748B', fontSize: 12, marginTop: 4 },
  cardActions: { flexDirection: 'row', alignItems: 'center' },
  iconHit: { padding: 10 },
  addRow: { marginTop: 8, gap: 10 },
  limitNote: { color: '#94A3B8', fontSize: 13, marginTop: 8, textAlign: 'center' },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#3FA9F5',
    paddingVertical: 14,
    borderRadius: 12,
    minWidth: 200,
  },
  primaryBtnText: { color: '#0F172A', fontWeight: '800', fontSize: 16 },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#475569',
    paddingVertical: 12,
    borderRadius: 12,
    minWidth: 200,
  },
  secondaryBtnText: { color: '#E2E8F0', fontWeight: '700', fontSize: 15 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalTitle: { color: '#F8FAFC', fontSize: 18, fontWeight: '800', marginBottom: 14 },
  label: { color: '#94A3B8', fontSize: 13, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#475569',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#F8FAFC',
    marginBottom: 12,
    fontSize: 16,
  },
  formErr: { color: '#FCA5A5', marginBottom: 8, fontSize: 13 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 8 },
});
