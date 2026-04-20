import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiEmergencyContactsList, type EmergencyContactRow } from '../lib/emergencyContactsApi';
import { apiPanicSendSms, type PanicSendSmsPayload } from '../lib/panicApi';

type Props = {
  visible: boolean;
  onClose: () => void;
  role: 'driver' | 'passenger';
  /** Aktif yolculuk; backend matched/in_progress + üyelik doğrular */
  tagId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  locationAccuracyM?: number | null;
};

type PostOutcome = null | 'success' | 'partial';

function formatHttpPanicError(httpStatus: number, body: unknown): string {
  const o = body as { detail?: unknown };
  let detail = o?.detail;
  if (Array.isArray(detail)) {
    detail = detail
      .map((x: { msg?: string }) => (typeof x?.msg === 'string' ? x.msg : JSON.stringify(x)))
      .join(' ');
  }
  const s = typeof detail === 'string' ? detail.trim() : '';
  if (s.startsWith('panic_rate_limit:')) {
    return 'Çok sık acil SMS gönderdiniz. Lütfen bir süre sonra tekrar deneyin.';
  }
  if (httpStatus === 429) {
    return 'Çok sık deneme. Lütfen bekleyip tekrar deneyin.';
  }
  if (httpStatus === 403) {
    if (s && s.length < 220) return s;
    return 'Bu yolculuk için acil SMS gönderemezsiniz veya seçilen kişiler geçersiz.';
  }
  if (httpStatus === 400 || httpStatus === 422) {
    if (s) return s;
    return 'İstek geçersiz. Seçimlerinizi kontrol edin.';
  }
  if (httpStatus >= 500) {
    return 'Sunucu hatası. Lütfen daha sonra tekrar deneyin.';
  }
  if (s) return s;
  return 'Mesaj gönderilemedi. Lütfen tekrar deneyin.';
}

/**
 * Acil durum modalı — liste GET /emergency-contacts, gönderim POST /panic/send-sms.
 */
export default function PanicModalFlow({
  visible,
  onClose,
  role,
  tagId,
  latitude,
  longitude,
  locationAccuracyM,
}: Props) {
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contacts, setContacts] = useState<EmergencyContactRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sendInFlight, setSendInFlight] = useState(false);
  const sendLockRef = useRef(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [postOutcome, setPostOutcome] = useState<PostOutcome>(null);

  const reset = useCallback(() => {
    setContactsLoading(false);
    setContacts([]);
    setSelectedIds(new Set());
    setSendInFlight(false);
    sendLockRef.current = false;
    setSendError(null);
    setPostOutcome(null);
  }, []);

  useEffect(() => {
    if (!visible) {
      reset();
      return;
    }
    setPostOutcome(null);
    setSendError(null);
    let cancelled = false;
    setContactsLoading(true);
    void (async () => {
      try {
        const data = await apiEmergencyContactsList();
        if (cancelled) return;
        const raw =
          data?.success && Array.isArray(data.contacts) ? (data.contacts as EmergencyContactRow[]) : [];
        const sorted = [...raw].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
        setContacts(sorted);
        const defaultPick = sorted.length > 3 ? sorted.slice(0, 3).map((c) => c.id) : sorted.map((c) => c.id);
        setSelectedIds(new Set(defaultPick));
      } finally {
        if (!cancelled) setContactsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, reset]);

  const toggle = (id: string) => {
    if (sendInFlight) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size <= 1) return prev;
        next.delete(id);
      } else {
        if (next.size >= 3) return prev;
        next.add(id);
      }
      return next;
    });
  };

  const buildPayload = useCallback((): PanicSendSmsPayload => {
    const ids = Array.from(selectedIds);
    const payload: PanicSendSmsPayload = {
      role,
      contact_ids: ids,
      tag_id: tagId ?? null,
    };
    if (latitude != null && longitude != null && Number.isFinite(latitude) && Number.isFinite(longitude)) {
      payload.latitude = latitude;
      payload.longitude = longitude;
      payload.location_captured_at = new Date().toISOString();
    }
    if (locationAccuracyM != null && Number.isFinite(locationAccuracyM)) {
      payload.location_accuracy_m = locationAccuracyM;
    }
    return payload;
  }, [role, tagId, latitude, longitude, locationAccuracyM, selectedIds]);

  const performSend = useCallback(async () => {
    if (sendLockRef.current || selectedIds.size < 1) return;
    sendLockRef.current = true;
    setSendInFlight(true);
    setSendError(null);
    try {
      const result = await apiPanicSendSms(buildPayload());
      if (result.kind === 'network') {
        setSendError('Bağlantı kurulamadı. İnternetinizi kontrol edip tekrar deneyin.');
        return;
      }
      if (result.kind === 'http_error') {
        setSendError(formatHttpPanicError(result.httpStatus, result.body));
        return;
      }
      const b = result.body;
      if (!b.success) {
        setSendError('Seçilen kişilere hiçbir SMS gönderilemedi. Lütfen daha sonra tekrar deneyin.');
        return;
      }
      if (b.partial_failure) {
        setPostOutcome('partial');
      } else {
        setPostOutcome('success');
      }
    } finally {
      sendLockRef.current = false;
      setSendInFlight(false);
    }
  }, [buildPayload, selectedIds]);

  const handleSendPress = () => {
    if (selectedIds.size < 1 || sendInFlight) return;
    Alert.alert('Onay', 'Seçilen kişilere mesaj gönderilsin mi?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Gönder',
        style: 'default',
        onPress: () => {
          void performSend();
        },
      },
    ]);
  };

  const handleClose = () => {
    if (sendInFlight) return;
    reset();
    onClose();
  };

  const showResult = postOutcome === 'success' || postOutcome === 'partial';
  const listInteractive = !contactsLoading && !sendInFlight && !showResult;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!sendInFlight) handleClose();
      }}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {!showResult ? (
            <>
              <Text style={styles.title}>Acil durum</Text>
              <Text style={styles.desc}>
                Seçtiğiniz kişilere konumunuz SMS ile gönderilecektir.
              </Text>

              {contactsLoading ? (
                <View style={styles.center}>
                  <ActivityIndicator color="#3FA9F5" />
                </View>
              ) : contacts.length === 0 ? (
                <Text style={styles.empty}>
                  Kayıtlı acil kişiniz yok. Ayarlardan acil durum kişilerinizi ekleyebilirsiniz.
                </Text>
              ) : (
                <>
                  <Text style={styles.hint}>En az 1, en çok 3 kişi seçebilirsiniz.</Text>
                  <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
                    {contacts.map((c) => {
                      const on = selectedIds.has(c.id);
                      return (
                        <TouchableOpacity
                          key={c.id}
                          style={[styles.row, on && styles.rowOn]}
                          onPress={() => toggle(c.id)}
                          activeOpacity={0.85}
                          disabled={!listInteractive}
                        >
                          <Ionicons
                            name={on ? 'checkbox' : 'square-outline'}
                            size={22}
                            color={on ? '#3FA9F5' : '#94A3B8'}
                          />
                          <View style={{ flex: 1, marginLeft: 10 }}>
                            <Text style={styles.name}>{c.name}</Text>
                            <Text style={styles.phone}>{c.phone_masked}</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                  {sendError ? <Text style={styles.errorText}>{sendError}</Text> : null}
                  <TouchableOpacity
                    style={[
                      styles.sendBtn,
                      (selectedIds.size < 1 || sendInFlight) && styles.sendBtnOff,
                    ]}
                    disabled={selectedIds.size < 1 || sendInFlight}
                    onPress={handleSendPress}
                  >
                    {sendInFlight ? (
                      <View style={styles.sendRow}>
                        <ActivityIndicator color="#FFF" style={{ marginRight: 10 }} />
                        <Text style={styles.sendBtnText}>Gönderiliyor…</Text>
                      </View>
                    ) : (
                      <Text style={styles.sendBtnText}>Mesaj gönder</Text>
                    )}
                  </TouchableOpacity>
                </>
              )}

              <TouchableOpacity
                style={[styles.closeGhost, sendInFlight && styles.closeGhostDisabled]}
                onPress={handleClose}
                disabled={sendInFlight}
              >
                <Text style={[styles.closeGhostText, sendInFlight && styles.mutedText]}>Kapat</Text>
              </TouchableOpacity>
            </>
          ) : postOutcome === 'partial' ? (
            <>
              <View style={styles.successIcon}>
                <Ionicons name="alert-circle" size={48} color="#F59E0B" />
              </View>
              <Text style={styles.title}>Mesaj kısmen gönderildi</Text>
              <Text style={styles.warnBody}>
                Seçilen kişilerden en az birine SMS ulaştı; bir veya daha fazlasına ulaşılamadı. Ulaşmayan
                kişilere telefon veya başka kanallarla ulaşmayı deneyin.
              </Text>
              <TouchableOpacity style={styles.primaryClose} onPress={handleClose}>
                <Text style={styles.primaryCloseText}>Tamam</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.successIcon}>
                <Ionicons name="checkmark-circle" size={48} color="#22C55E" />
              </View>
              <Text style={styles.title}>Mesaj gönderildi</Text>
              <TouchableOpacity style={styles.primaryClose} onPress={handleClose}>
                <Text style={styles.primaryCloseText}>Tamam</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.72)',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#334155',
    maxHeight: '88%',
  },
  title: { color: '#F8FAFC', fontSize: 20, fontWeight: '800', marginBottom: 8 },
  desc: { color: '#94A3B8', fontSize: 14, lineHeight: 20, marginBottom: 14 },
  hint: { color: '#64748B', fontSize: 12, marginBottom: 8 },
  list: { maxHeight: 280, marginBottom: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
  },
  rowOn: { borderColor: '#3FA9F5' },
  name: { color: '#F1F5F9', fontSize: 16, fontWeight: '700' },
  phone: { color: '#94A3B8', fontSize: 13, marginTop: 2 },
  sendBtn: {
    backgroundColor: '#B91C1C',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  sendBtnOff: { opacity: 0.45 },
  sendRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  sendBtnText: { color: '#FFF', fontWeight: '800', fontSize: 16 },
  closeGhost: { marginTop: 12, alignItems: 'center', paddingVertical: 8 },
  closeGhostDisabled: { opacity: 0.5 },
  closeGhostText: { color: '#94A3B8', fontSize: 15, fontWeight: '600' },
  mutedText: { color: '#64748B' },
  center: { paddingVertical: 24, alignItems: 'center' },
  empty: { color: '#94A3B8', fontSize: 14, lineHeight: 21, marginBottom: 8 },
  errorText: {
    color: '#FCA5A5',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  successIcon: { alignItems: 'center', marginBottom: 8 },
  warnBody: { color: '#FCD34D', fontSize: 14, lineHeight: 21, marginBottom: 8 },
  primaryClose: {
    marginTop: 16,
    backgroundColor: '#3FA9F5',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryCloseText: { color: '#0F172A', fontWeight: '800', fontSize: 16 },
});
