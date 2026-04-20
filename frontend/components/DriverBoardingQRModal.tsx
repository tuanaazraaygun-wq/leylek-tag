import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { API_BASE_URL } from '../lib/backendConfig';
import { waitForPersistedAccessToken } from '../lib/sessionToken';

type Props = {
  visible: boolean;
  onClose: () => void;
  tagId: string;
};

export default function DriverBoardingQRModal({ visible, onClose, tagId }: Props) {
  const [qrString, setQrString] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCode = useCallback(async () => {
    if (!tagId) return;
    setLoading(true);
    setError(null);
    setQrString(null);
    console.log('BOARDING_QR_REQUESTED', { tag_id: tagId });
    try {
      const tok = await waitForPersistedAccessToken();
      if (!tok?.trim()) {
        setError('Oturum bulunamadı; yeniden giriş yapın.');
        return;
      }
      const q = new URLSearchParams({ tag_id: String(tagId) });
      const res = await fetch(`${API_BASE_URL}/qr/boarding-code?${q.toString()}`, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${tok.trim()}` },
      });
      const raw = await res.text();
      let json: { success?: boolean; qr_string?: string; detail?: string } = {};
      try {
        json = raw ? JSON.parse(raw) : {};
      } catch {
        setError('Sunucu yanıtı okunamadı');
        return;
      }
      if (res.status === 401) {
        setError(json.detail || 'Oturum doğrulanamadı');
        return;
      }
      if (json.success && json.qr_string) {
        setQrString(json.qr_string);
      } else {
        setError(json.detail || 'Karekod alınamadı');
      }
    } catch {
      setError('Ağ hatası');
    } finally {
      setLoading(false);
    }
  }, [tagId]);

  useEffect(() => {
    if (visible) {
      void fetchCode();
    } else {
      setQrString(null);
      setError(null);
    }
  }, [visible, fetchCode]);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <LinearGradient colors={['#0c1a2e', '#0f3d5c']} style={styles.header}>
            <Text style={styles.title}>Biniş karekodu</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={12}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </LinearGradient>
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <Text style={styles.instruction}>
              Yolcu yakındayken bu kodu gösterin. Yolculuk, yolcu kodu tarayıp onayladıktan sonra başlar.
            </Text>
            {loading ? (
              <View style={styles.center}>
                <ActivityIndicator size="large" color="#38bdf8" />
                <Text style={styles.muted}>Karekod hazırlanıyor…</Text>
              </View>
            ) : error ? (
              <View style={styles.center}>
                <Text style={styles.err}>{error}</Text>
                <TouchableOpacity style={styles.retry} onPress={() => void fetchCode()}>
                  <Text style={styles.retryText}>Yeniden dene</Text>
                </TouchableOpacity>
              </View>
            ) : qrString ? (
              <View style={styles.qrBox}>
                <QRCode value={qrString} size={220} backgroundColor="#fff" color="#0f172a" />
              </View>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.88)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#f8fafc',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  title: { color: '#f8fafc', fontSize: 18, fontWeight: '800', flex: 1 },
  closeBtn: { padding: 8 },
  closeText: { color: '#e2e8f0', fontSize: 20 },
  body: { padding: 20, paddingBottom: 32 },
  instruction: { color: '#334155', fontSize: 14, lineHeight: 21, marginBottom: 16 },
  center: { alignItems: 'center', paddingVertical: 24 },
  muted: { color: '#64748b', marginTop: 12 },
  err: { color: '#b91c1c', textAlign: 'center', fontWeight: '600' },
  retry: { marginTop: 16, backgroundColor: '#0ea5e9', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  retryText: { color: '#fff', fontWeight: '700' },
  qrBox: {
    alignSelf: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
});
