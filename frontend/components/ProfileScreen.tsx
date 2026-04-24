/**
 * Leylek Muhabbeti — kullanıcı profili (kendi / karşı taraf) + Leylek Anahtar kartı.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeaderGradient } from './ScreenHeaderGradient';
import { getPersistedAccessToken, getPersistedUserRaw } from '../lib/sessionToken';
import { handleUnauthorizedAndMaybeRedirect } from '../lib/muhabbetAuthRedirect';

const PRIMARY_GRAD = ['#3B82F6', '#60A5FA'] as const;
const ORANGE_GRAD = ['#F59E0B', '#FBBF24'] as const;
const TEXT_PRIMARY = '#111111';
const TEXT_SECONDARY = '#6E6E73';
const CARD_BG = '#FFFFFF';
const CARD_SHADOW = Platform.select({
  ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 },
  android: { elevation: 2 },
  default: {},
});

export type PublicProfilePayload = {
  id?: string;
  name?: string;
  rating?: number | null;
  total_trips?: number | null;
  total_ratings?: number | null;
  role?: string | null;
  active_listings?: number;
  completed_matches?: number;
  profile_photo?: string | null;
  muhabbet_bio?: string | null;
  extras?: {
    vehicle_summary?: Record<string, unknown> | null;
    vehicle_label?: string | null;
    daily_trips_hint?: number | null;
    weekly_earning_hint?: number | null;
    past_trips_hint?: unknown;
  };
};

export type ProfileScreenProps = {
  apiBaseUrl: string;
  userId: string;
  onBack?: () => void;
};

export default function ProfileScreen({ apiBaseUrl, userId, onBack }: ProfileScreenProps) {
  const router = useRouter();
  const base = apiBaseUrl.replace(/\/$/, '');
  const [loading, setLoading] = useState(true);
  const [p, setP] = useState<PublicProfilePayload | null>(null);
  const [myId, setMyId] = useState<string>('');
  const [bioDraft, setBioDraft] = useState('');
  const [savingBio, setSavingBio] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [keyBusy, setKeyBusy] = useState(false);
  const [lastKey, setLastKey] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const raw = await getPersistedUserRaw();
        if (raw) {
          const u = JSON.parse(raw) as { id?: string };
          if (u?.id) setMyId(String(u.id).trim().toLowerCase());
        }
      } catch {
        /* noop */
      }
    })();
  }, []);

  const isSelf = useMemo(
    () => myId && userId && myId === String(userId).trim().toLowerCase(),
    [myId, userId],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = (await getPersistedAccessToken())?.trim();
      if (!token) {
        setP(null);
        return;
      }
      const uid = encodeURIComponent(userId.trim());
      const res = await fetch(`${base}/muhabbet/users/${uid}/public-profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (handleUnauthorizedAndMaybeRedirect(res)) {
        setP(null);
        return;
      }
      const d = (await res.json().catch(() => ({}))) as { success?: boolean; profile?: PublicProfilePayload };
      if (res.ok && d.success && d.profile) {
        setP(d.profile);
        setBioDraft((d.profile.muhabbet_bio || '').trim());
      } else setP(null);
    } catch {
      setP(null);
    } finally {
      setLoading(false);
    }
  }, [base, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const role = (p?.role || '').toLowerCase();
  const isDriver = role === 'driver' || role === 'private_driver';
  const vLabel = (p?.extras?.vehicle_label as string) || '';

  const saveBio = async () => {
    if (!isSelf) return;
    setSavingBio(true);
    try {
      const token = (await getPersistedAccessToken())?.trim();
      if (!token) return;
      const res = await fetch(`${base}/muhabbet/me/bio`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ bio: bioDraft.trim() }),
      });
      if (handleUnauthorizedAndMaybeRedirect(res)) return;
      const d = (await res.json().catch(() => ({}))) as { success?: boolean; detail?: string };
      if (!res.ok || !d.success) {
        Alert.alert('Profil', typeof d.detail === 'string' && d.detail ? d.detail : 'Kaydedilemedi.');
        return;
      }
      setP((prev) => (prev ? { ...prev, muhabbet_bio: bioDraft.trim() || null } : prev));
    } catch {
      Alert.alert('Profil', 'Bağlantı hatası.');
    } finally {
      setSavingBio(false);
    }
  };

  const pickPhoto = async () => {
    if (!isSelf) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('İzin', 'Fotoğraf seçmek için galeri izni gerekir.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
    });
    const uri = !result.canceled && result.assets?.[0]?.uri ? result.assets[0].uri : null;
    if (!uri || !myId) return;
    setUploading(true);
    try {
      const token = (await getPersistedAccessToken())?.trim();
      if (!token) return;
      const form = new FormData();
      form.append('file', {
        uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
        name: 'profile.jpg',
        type: 'image/jpeg',
      } as any);
      const res = await fetch(`${base}/storage/upload-profile-photo?user_id=${encodeURIComponent(myId)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const d = (await res.json().catch(() => ({}))) as { success?: boolean; url?: string; detail?: string };
      if (!res.ok || !d.success || !d.url) {
        Alert.alert('Fotoğraf', typeof d.detail === 'string' && d.detail ? d.detail : 'Yüklenemedi.');
        return;
      }
      setP((prev) => (prev ? { ...prev, profile_photo: d.url } : prev));
    } catch {
      Alert.alert('Fotoğraf', 'Yükleme hatası.');
    } finally {
      setUploading(false);
    }
  };

  const createLeylekKey = async () => {
    if (!isSelf) return;
    setKeyBusy(true);
    setLastKey(null);
    try {
      const token = (await getPersistedAccessToken())?.trim();
      if (!token) return;
      const res = await fetch(`${base}/muhabbet/leylek-key/create`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (handleUnauthorizedAndMaybeRedirect(res)) return;
      const d = (await res.json().catch(() => ({}))) as { success?: boolean; key?: string; detail?: string };
      if (!res.ok || !d.success || !d.key) {
        Alert.alert('Leylek Anahtar', typeof d.detail === 'string' && d.detail ? d.detail : 'Oluşturulamadı.');
        return;
      }
      setLastKey(d.key);
    } catch {
      Alert.alert('Leylek Anahtar', 'Bağlantı hatası.');
    } finally {
      setKeyBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['left', 'right', 'bottom']}>
      <ScreenHeaderGradient title="Profil" onBack={onBack ?? (() => router.back())} gradientColors={PRIMARY_GRAD} />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={PRIMARY_GRAD[0]} />
        </View>
      ) : !p ? (
        <View style={styles.centerPad}>
          <Text style={styles.muted}>Profil yüklenemedi.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.headerCard}>
            <Pressable onPress={() => (isSelf ? void pickPhoto() : null)} style={styles.avatarWrap}>
              {p.profile_photo ? (
                <Image source={{ uri: p.profile_photo }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPh}>
                  <Ionicons name="person" size={44} color="#8E8E93" />
                </View>
              )}
              {isSelf && uploading ? (
                <View style={styles.avOverlay}>
                  <ActivityIndicator color="#fff" />
                </View>
              ) : null}
              {isSelf ? (
                <View style={styles.editBadge}>
                  <Ionicons name="camera" size={16} color="#fff" />
                </View>
              ) : null}
            </Pressable>
            <Text style={styles.name}>{p.name || 'Kullanıcı'}</Text>
            <Text style={styles.badgeLine}>
              {isDriver ? 'Sürücü' : 'Yolcu'} · ⭐ {p.rating != null ? Number(p.rating).toFixed(1) : '—'} · 🧭 {p.total_trips ?? 0}{' '}
              yolculuk
            </Text>
            <View style={styles.statRow}>
              <View style={styles.statBox}>
                <Text style={styles.statNum}>{p.completed_matches ?? 0}</Text>
                <Text style={styles.statLab}>Tamamlanan eşleşme</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statNum}>{p.active_listings ?? 0}</Text>
                <Text style={styles.statLab}>Aktif teklif</Text>
              </View>
            </View>
          </View>

          {isDriver && vLabel ? (
            <View style={styles.card}>
              <Text style={styles.section}>Araç bilgisi</Text>
              <Text style={styles.bodyText}>{vLabel}</Text>
            </View>
          ) : isDriver && !vLabel ? (
            <View style={styles.card}>
              <Text style={styles.section}>Araç</Text>
              <Text style={styles.mutedSmall}>Araç marka/model profilinizde tanımlı değil.</Text>
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.section}>Yolcu profili</Text>
              <Text style={styles.mutedSmall}>Leylek Muhabbeti üzerinden güvenli ön görüşme ve eşleşme için profil bilgileriniz görüntülenir.</Text>
            </View>
          )}

          <View style={styles.card}>
            <Text style={styles.section}>Hakkımda</Text>
            {isSelf ? (
              <>
                <TextInput
                  style={styles.bioIn}
                  value={bioDraft}
                  onChangeText={setBioDraft}
                  placeholder="Kısa açıklama (isteğe bağlı, en fazla 500 karakter)"
                  placeholderTextColor={TEXT_SECONDARY}
                  multiline
                  maxLength={500}
                />
                <Pressable onPress={() => void saveBio()} style={({ pressed }) => [styles.saveRow, pressed && { opacity: 0.88 }]}>
                  {savingBio ? (
                    <ActivityIndicator size="small" color={PRIMARY_GRAD[0]} />
                  ) : (
                    <Text style={styles.saveTxt}>Açıklamayı kaydet</Text>
                  )}
                </Pressable>
              </>
            ) : p.muhabbet_bio ? (
              <Text style={styles.bodyText}>{p.muhabbet_bio}</Text>
            ) : (
              <Text style={styles.mutedSmall}>Açıklama eklenmemiş.</Text>
            )}
          </View>

          {isSelf ? (
            <View style={styles.card}>
              <Text style={styles.section}>Leylek Anahtar</Text>
              <Text style={styles.official}>
                Leylek Anahtar, ön görüşme sonrası iki tarafın onayıyla güvenli eşleşme başlatır. Anahtar tek
                kullanımlıktır ve kısa süre içinde geçerliliğini kaybeder.
              </Text>
              <Pressable
                onPress={() => void createLeylekKey()}
                disabled={keyBusy}
                style={({ pressed }) => [styles.ctaOr, pressed && { opacity: 0.9 }]}
              >
                <LinearGradient colors={ORANGE_GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ctaIn}>
                  {keyBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaTxt}>Leylek Anahtar Oluştur</Text>}
                </LinearGradient>
              </Pressable>
              {lastKey ? (
                <View style={styles.keyOut}>
                  <Text style={styles.keyHint}>Oluşturduğunuz anahtar (paylaşın):</Text>
                  <Text style={styles.keyBig} selectable>
                    {lastKey}
                  </Text>
                </View>
              ) : null}
              <Pressable
                onPress={() => router.push('/leylek-anahtar' as Href)}
                style={({ pressed }) => [styles.ctaBl, pressed && { opacity: 0.9 }]}
              >
                <LinearGradient colors={PRIMARY_GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ctaIn}>
                  <Text style={styles.ctaTxt}>Leylek Anahtar Gir</Text>
                </LinearGradient>
              </Pressable>
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.section}>Eşleşme</Text>
              <Text style={styles.mutedSmall}>
                Sohbet ön görüşmedir. Güvenli yolculuk eşleşmesi için Leylek Anahtar ile onaylayın.
              </Text>
              <Pressable
                onPress={() => router.push('/leylek-anahtar' as Href)}
                style={({ pressed }) => [styles.ctaBl, { marginTop: 12 }, pressed && { opacity: 0.9 }]}
              >
                <LinearGradient colors={PRIMARY_GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ctaIn}>
                  <Text style={styles.ctaTxt}>Leylek Anahtar gir</Text>
                </LinearGradient>
              </Pressable>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F2F2F7' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  centerPad: { padding: 24 },
  scroll: { padding: 16, paddingBottom: 40 },
  headerCard: { alignItems: 'center', marginBottom: 8 },
  avatarWrap: { position: 'relative' },
  avatar: { width: 108, height: 108, borderRadius: 54, backgroundColor: '#E5E5EA' },
  avatarPh: {
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: '#E5E5EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: PRIMARY_GRAD[0],
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  name: { fontSize: 24, fontWeight: '800', color: TEXT_PRIMARY, marginTop: 12 },
  badgeLine: { fontSize: 14, color: TEXT_SECONDARY, marginTop: 4, textAlign: 'center' },
  statRow: { flexDirection: 'row', gap: 12, marginTop: 16, width: '100%', justifyContent: 'center' },
  statBox: {
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 20,
    minWidth: 120,
    alignItems: 'center',
    ...CARD_SHADOW,
  },
  statNum: { fontSize: 20, fontWeight: '800', color: TEXT_PRIMARY },
  statLab: { fontSize: 12, color: TEXT_SECONDARY, marginTop: 4, textAlign: 'center' },
  card: { backgroundColor: CARD_BG, borderRadius: 18, padding: 16, marginBottom: 12, ...CARD_SHADOW },
  section: { fontSize: 17, fontWeight: '800', color: TEXT_PRIMARY, marginBottom: 8 },
  bodyText: { fontSize: 15, color: TEXT_PRIMARY, lineHeight: 22 },
  official: { fontSize: 14, color: '#3C3C43', lineHeight: 20, marginBottom: 12 },
  muted: { fontSize: 15, color: TEXT_SECONDARY, textAlign: 'center' },
  mutedSmall: { fontSize: 13, color: TEXT_SECONDARY, lineHeight: 18, marginTop: 4 },
  bioIn: {
    minHeight: 80,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60,60,67,0.2)',
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: TEXT_PRIMARY,
    textAlignVertical: 'top',
  },
  saveRow: { marginTop: 10, alignSelf: 'flex-end' },
  saveTxt: { color: PRIMARY_GRAD[0], fontWeight: '700' },
  ctaOr: { borderRadius: 14, overflow: 'hidden' },
  ctaBl: { borderRadius: 14, overflow: 'hidden' },
  ctaIn: { paddingVertical: 14, alignItems: 'center', minHeight: 50, justifyContent: 'center' },
  ctaTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },
  keyOut: { marginTop: 12, padding: 12, backgroundColor: 'rgba(245,158,11,0.1)', borderRadius: 12 },
  keyHint: { fontSize: 12, color: TEXT_SECONDARY, fontWeight: '600' },
  keyBig: { fontSize: 18, fontWeight: '800', color: TEXT_PRIMARY, marginTop: 6 },
});
