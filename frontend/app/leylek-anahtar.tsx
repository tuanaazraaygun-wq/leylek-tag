import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ScreenHeaderGradient } from '../components/ScreenHeaderGradient';
import { getPersistedAccessToken } from '../lib/sessionToken';
import { handleUnauthorizedAndMaybeRedirect } from '../lib/muhabbetAuthRedirect';
import { API_BASE_URL } from '../lib/backendConfig';
import { buildMuhabbetChatHref } from '../components/ConversationsScreen';

const GRAD = ['#3B82F6', '#60A5FA'] as const;
const ORANGE = ['#F59E0B', '#FBBF24'] as const;

export default function LeylekAnahtarRoute() {
  const router = useRouter();
  const base = API_BASE_URL.replace(/\/$/, '');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [expAt, setExpAt] = useState<string | null>(null);

  const createKey = async () => {
    setCreateBusy(true);
    setNewKey(null);
    try {
      const token = (await getPersistedAccessToken())?.trim();
      if (!token) {
        Alert.alert('Oturum', 'Lütfen giriş yapın.');
        return;
      }
      const res = await fetch(`${base}/muhabbet/leylek-key/create`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (handleUnauthorizedAndMaybeRedirect(res)) return;
      const d = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        key?: string;
        expires_at?: string;
        detail?: string;
      };
      if (!res.ok || !d.success || !d.key) {
        Alert.alert('Hata', typeof d.detail === 'string' && d.detail ? d.detail : 'Anahtar oluşturulamadı.');
        return;
      }
      setNewKey(d.key);
      setExpAt(d.expires_at || null);
    } catch {
      Alert.alert('Hata', 'Bağlantı sorunu.');
    } finally {
      setCreateBusy(false);
    }
  };

  const redeem = async () => {
    const c = code.trim();
    if (!c) {
      Alert.alert('Leylek Anahtar', 'Lütfen karşı taraftan aldığınız anahtarı girin.');
      return;
    }
    setLoading(true);
    try {
      const token = (await getPersistedAccessToken())?.trim();
      if (!token) {
        Alert.alert('Oturum', 'Lütfen giriş yapın.');
        return;
      }
      const res = await fetch(`${base}/muhabbet/leylek-key/redeem`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: c }),
      });
      if (handleUnauthorizedAndMaybeRedirect(res)) return;
      const d = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        conversation_id?: string;
        message?: string;
        detail?: string;
      };
      if (!res.ok || !d.success || !d.conversation_id) {
        Alert.alert('Anahtar', typeof d.detail === 'string' && d.detail ? d.detail : 'Anahtar kullanılamadı.');
        return;
      }
      Alert.alert('Eşleşme', d.message || 'Eşleşme tamamlandı.', [
        {
          text: 'Sohbete git',
          onPress: () => {
            router.push(
              buildMuhabbetChatHref(String(d.conversation_id), {
                otherUserName: 'Sohbet',
                fromText: '',
                toText: '',
              }),
            );
          },
        },
        { text: 'Tamam', style: 'cancel' },
      ]);
    } catch {
      Alert.alert('Hata', 'Bağlantı sorunu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['left', 'right', 'bottom']}>
      <ScreenHeaderGradient title="Leylek Anahtar" onBack={() => router.back()} gradientColors={GRAD} />
      <View style={styles.body}>
        <Text style={styles.lead}>
          Leylek Anahtar, ön görüşme sonrası iki tarafın onayıyla güvenli eşleşme başlatır. Anahtar tek
          kullanımlıktır ve kısa süre içinde geçerliliğini kaybeder.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Yeni anahtar oluştur</Text>
          <Text style={styles.cardSub}>Anahtarınız 15 dakika geçerlidir; tek eşleşme içindir.</Text>
          <Pressable
            onPress={() => void createKey()}
            disabled={createBusy}
            style={({ pressed }) => [pressed && { opacity: 0.9 }]}
          >
            <LinearGradient colors={ORANGE} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.btnOr}>
              {createBusy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnTxt}>Leylek Anahtar Oluştur</Text>
              )}
            </LinearGradient>
          </Pressable>
          {newKey ? (
            <View style={styles.keyBox}>
              <Text style={styles.keyLabel}>Oluşturulan anahtar (paylaşın)</Text>
              <Text style={styles.keyVal} selectable>
                {newKey}
              </Text>
              {expAt ? <Text style={styles.expSmall}>Geçerlilik: {String(expAt)}</Text> : null}
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Anahtar gir</Text>
          <Text style={styles.cardSub}>Karşı taraftan aldığınız kodu aynen veya boşluksuz girebilirsiniz.</Text>
          <TextInput
            style={styles.input}
            value={code}
            onChangeText={setCode}
            placeholder="Örn. LX-8K4P-2M9N"
            placeholderTextColor="#8E8E93"
            autoCapitalize="characters"
            autoCorrect={false}
          />
          <Pressable onPress={() => void redeem()} disabled={loading} style={({ pressed }) => [pressed && { opacity: 0.9 }]}>
            <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.btnBl}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnTxt}>Leylek Anahtar Gir</Text>}
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F2F2F7' },
  body: { padding: 16, gap: 16 },
  lead: { fontSize: 14, color: '#3C3C43', lineHeight: 20, marginBottom: 4 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 },
      android: { elevation: 2 },
    }),
  },
  cardTitle: { fontSize: 17, fontWeight: '800', color: '#111' },
  cardSub: { fontSize: 13, color: '#6E6E73', marginTop: 6, marginBottom: 12, lineHeight: 18 },
  btnOr: { borderRadius: 14, paddingVertical: 14, alignItems: 'center', minHeight: 50, justifyContent: 'center' },
  btnBl: { borderRadius: 14, paddingVertical: 14, alignItems: 'center', minHeight: 50, justifyContent: 'center' },
  btnTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },
  keyBox: { marginTop: 14, padding: 12, backgroundColor: 'rgba(245,158,11,0.1)', borderRadius: 12 },
  keyLabel: { fontSize: 12, color: '#6E6E73', fontWeight: '600' },
  keyVal: { fontSize: 20, fontWeight: '800', color: '#111', marginTop: 6, letterSpacing: 0.5 },
  expSmall: { fontSize: 12, color: '#6E6E73', marginTop: 6 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60,60,67,0.2)',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    color: '#111',
    marginBottom: 12,
  },
});
