import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeaderGradient } from './ScreenHeaderGradient';
import { getPersistedAccessToken, getPersistedUserRaw } from '../lib/sessionToken';
import { handleUnauthorizedAndMaybeRedirect } from '../lib/muhabbetAuthRedirect';

const PRIMARY_GRAD = ['#3B82F6', '#60A5FA'] as const;
const VEHICLE_PH = ['#DBEAFE', '#E0E7FF'] as const;
const TEXT_PRIMARY = '#111111';
const TEXT_SECONDARY = '#6E6E73';
const CARD_BG = '#FFFFFF';
const CARD_SHADOW = Platform.select({
  ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 },
  android: { elevation: 2 },
  default: {},
});

const LEYLEK_NAME_BAD = new Set(
  ['leylek', 'leylek kullanıcısı', 'leylek kullanicisi'].map((s) => s.toLowerCase()),
);

export type PublicProfilePayload = {
  id?: string;
  /** Bazı yanıtlarda ek kimlik alanları */
  user_id?: string;
  full_name?: string;
  /** API legacy alanı — görünümde ilk kelimeye indirgenir */
  name?: string;
  first_name?: string;
  public_name?: string;
  role_label?: string | null;
  is_kyc_driver?: boolean;
  rating?: number | null;
  total_trips?: number | null;
  completed_trips?: number | null;
  completed_matches?: number;
  active_listings_count?: number;
  about?: string | null;
  profile_photo_url?: string | null;
  vehicle_photo_url?: string | null;
  vehicle_kind_label?: string | null;
  muhabbet_bio?: string | null;
};

export type ProfileScreenProps = {
  apiBaseUrl: string;
  userId: string;
  onBack?: () => void;
};

type PersistedForProfile = {
  idNorm: string;
  full_name?: string;
  name?: string;
  first_name?: string;
  phone?: string;
};

function normId(v: unknown): string {
  return String(v ?? '').trim().toLowerCase();
}

function parsePersistedForProfile(raw: string): PersistedForProfile | null {
  try {
    const u = JSON.parse(raw) as Record<string, unknown>;
    const idRaw = u.id ?? u.user_id ?? u._id;
    if (idRaw == null || String(idRaw).trim() === '') return null;
    return {
      idNorm: normId(idRaw),
      full_name: typeof u.full_name === 'string' ? u.full_name : undefined,
      name: typeof u.name === 'string' ? u.name : undefined,
      first_name: typeof u.first_name === 'string' ? u.first_name : undefined,
      phone: typeof u.phone === 'string' ? u.phone : undefined,
    };
  } catch {
    return null;
  }
}

function maskPhoneShort(phone?: string): string {
  const d = String(phone || '').replace(/\D/g, '');
  if (d.length < 4) return '';
  return `••••${d.slice(-4)}`;
}

function detailFromApiBody(d: Record<string, unknown>): string {
  const det = d.detail;
  if (typeof det === 'string' && det.trim()) return det.trim();
  if (Array.isArray(det)) {
    const parts = det
      .map((x) => (x && typeof x === 'object' && 'msg' in x ? String((x as { msg?: unknown }).msg ?? '').trim() : ''))
      .filter(Boolean);
    if (parts.length) return parts.join(' ');
  }
  const err = d.error;
  if (typeof err === 'string' && err.trim()) return err.trim();
  return '';
}

function initialsFromName(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'LK';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
}

/** Soyad gösterme: önce kayıtlı adları topla; yalnızca ilk kelime. "Leylek…" placeholder'larını kullanma. */
function getSafeDisplayName(
  profile: PublicProfilePayload | null | undefined,
  persisted: PersistedForProfile | null | undefined,
): string {
  const rawCandidates: string[] = [];
  const push = (s?: string | null) => {
    const t = (s || '').trim();
    if (t) rawCandidates.push(t);
  };
  if (profile) {
    push(profile.public_name);
    push(profile.full_name);
    push(profile.name);
    push(profile.first_name);
  }
  if (persisted) {
    push(persisted.full_name);
    push(persisted.name);
    push(persisted.first_name);
  }
  const masked = maskPhoneShort(persisted?.phone);
  if (masked) rawCandidates.push(masked);

  for (const raw of rawCandidates) {
    const normFull = raw.toLowerCase();
    if (LEYLEK_NAME_BAD.has(normFull)) continue;
    const parts = raw.split(/\s+/).filter(Boolean);
    const first = parts[0] || '';
    if (!first) continue;
    if (LEYLEK_NAME_BAD.has(first.toLowerCase())) continue;
    return first;
  }
  return 'Kullanıcı';
}

export default function ProfileScreen({ apiBaseUrl, userId, onBack }: ProfileScreenProps) {
  const router = useRouter();
  const base = apiBaseUrl.replace(/\/$/, '');
  const [loading, setLoading] = useState(true);
  const [p, setP] = useState<PublicProfilePayload | null>(null);
  const [myId, setMyId] = useState<string>('');
  const [persistedForProfile, setPersistedForProfile] = useState<PersistedForProfile | null>(null);
  const [bioDraft, setBioDraft] = useState('');
  const [savingBio, setSavingBio] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingVehicle, setUploadingVehicle] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await getPersistedUserRaw();
        if (!raw) return;
        const parsed = parsePersistedForProfile(raw);
        if (parsed) {
          setMyId(parsed.idNorm);
          setPersistedForProfile(parsed);
        }
      } catch {
        /* noop */
      }
    })();
  }, []);

  const isSelf = useMemo(() => {
    const m = normId(myId);
    const r = normId(userId);
    const pid = normId(p?.id);
    const puid = normId(p?.user_id);
    if (!m) return false;
    if (r && m === r) return true;
    if (pid && m === pid) return true;
    if (puid && m === puid) return true;
    return false;
  }, [myId, userId, p?.id, p?.user_id]);

  useEffect(() => {
    console.log('PROFILE_SELF_CHECK', {
      routeUserId: userId,
      myId,
      profileId: p?.id,
      profileUserId: p?.user_id,
      isSelf,
    });
  }, [userId, myId, p?.id, p?.user_id, isSelf]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = (await getPersistedAccessToken())?.trim();
      if (!token) {
        setP(null);
        return;
      }

      let persistedId = '';
      try {
        const raw = await getPersistedUserRaw();
        if (raw) {
          const parsed = parsePersistedForProfile(raw);
          if (parsed) persistedId = parsed.idNorm;
        }
      } catch {
        /* noop */
      }

      const routeN = normId(userId);
      const useMe = !!persistedId && !!routeN && persistedId === routeN;
      const path = useMe ? '/muhabbet/profile/me' : `/muhabbet/profile/${encodeURIComponent(userId.trim())}`;

      const res = await fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${token}` } });
      if (handleUnauthorizedAndMaybeRedirect(res)) {
        setP(null);
        return;
      }
      const d = (await res.json().catch(() => ({}))) as { success?: boolean; profile?: PublicProfilePayload };
      if (!res.ok || !d.success || !d.profile) {
        setP(null);
        return;
      }
      setP(d.profile);
      setBioDraft((d.profile.about || d.profile.muhabbet_bio || '').trim());
    } catch {
      setP(null);
    } finally {
      setLoading(false);
    }
  }, [base, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const displayName = p ? getSafeDisplayName(p, persistedForProfile) : getSafeDisplayName(null, persistedForProfile);
  const roleLabel = p?.role_label || (p?.is_kyc_driver ? 'Sürücü' : 'Yolcu');
  const photo = (p?.profile_photo_url || '').trim();
  const vehiclePhoto = (p?.vehicle_photo_url || '').trim();
  const vehicleKind = (p?.vehicle_kind_label || '').trim() || 'Araba';
  const completedTrips = Number(p?.completed_trips ?? p?.total_trips ?? 0);
  const rating = p?.rating != null ? Number(p.rating).toFixed(1) : '—';
  const completedMatches = Number(p?.completed_matches || 0);
  const activeListings = Number(p?.active_listings_count || 0);
  const aboutText = (p?.about || p?.muhabbet_bio || '').trim();
  const showDriverExtras = p?.is_kyc_driver === true;

  const saveBio = async () => {
    if (!isSelf) {
      Alert.alert('Profil', 'Bu profili düzenleyemezsiniz.');
      return;
    }
    setSavingBio(true);
    try {
      const token = (await getPersistedAccessToken())?.trim();
      if (!token) {
        Alert.alert('Profil', 'Oturum bilgisi bulunamadı. Lütfen tekrar giriş yapın.');
        return;
      }
      console.log('PROFILE_BIO_SAVE_START');
      const res = await fetch(`${base}/muhabbet/profile/about`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ bio: bioDraft.trim() }),
      });
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown> & { success?: boolean; bio?: string | null };
      console.log('PROFILE_BIO_SAVE_RESPONSE', { status: res.status, body });
      if (handleUnauthorizedAndMaybeRedirect(res)) return;
      if (!res.ok || !body.success) {
        const msg = detailFromApiBody(body) || 'Kaydedilemedi.';
        Alert.alert('Profil', msg);
        return;
      }
      const nextBio = bioDraft.trim() || null;
      setP((prev) => (prev ? { ...prev, about: nextBio, muhabbet_bio: nextBio } : prev));
      void load();
    } catch (e) {
      console.warn('PROFILE_BIO_SAVE_ERROR', e);
      Alert.alert('Profil', 'Bağlantı hatası.');
    } finally {
      setSavingBio(false);
    }
  };

  const pickPhoto = async () => {
    if (!isSelf) {
      Alert.alert('Profil', 'Bu profili düzenleyemezsiniz.');
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return Alert.alert('İzin', 'Fotoğraf seçmek için galeri izni gerekir.');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.65,
    });
    const uri = !result.canceled && result.assets?.[0]?.uri ? result.assets[0].uri : null;
    if (!uri) return;
    setUploading(true);
    try {
      const token = (await getPersistedAccessToken())?.trim();
      if (!token) {
        Alert.alert('Profil', 'Oturum bilgisi bulunamadı. Lütfen tekrar giriş yapın.');
        return;
      }
      console.log('PROFILE_PHOTO_UPLOAD_START');
      const form = new FormData();
      form.append('file', {
        uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
        name: 'profile.jpg',
        type: 'image/jpeg',
      } as never);
      const res = await fetch(`${base}/muhabbet/profile/photo`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
      const d = (await res.json().catch(() => ({}))) as Record<string, unknown> & { success?: boolean; url?: string };
      console.log('PROFILE_PHOTO_UPLOAD_RESPONSE', { status: res.status, body: d });
      if (handleUnauthorizedAndMaybeRedirect(res)) return;
      if (!res.ok || !d.success || !d.url) {
        console.warn('[ProfileScreen] profile photo upload failed', res.status, d);
        const msg = detailFromApiBody(d) || 'Fotoğraf yüklenemedi. Lütfen tekrar deneyin.';
        Alert.alert('Profil', msg);
        return;
      }
      void load();
    } catch (e) {
      console.warn('[ProfileScreen] profile photo upload error', e);
      Alert.alert('Profil', 'Fotoğraf yüklenemedi. Lütfen tekrar deneyin.');
    } finally {
      setUploading(false);
    }
  };

  const pickVehiclePhoto = async () => {
    if (!isSelf || !showDriverExtras) {
      if (!isSelf) Alert.alert('Profil', 'Bu profili düzenleyemezsiniz.');
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return Alert.alert('İzin', 'Fotoğraf seçmek için galeri izni gerekir.');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.65,
    });
    const uri = !result.canceled && result.assets?.[0]?.uri ? result.assets[0].uri : null;
    if (!uri) return;
    setUploadingVehicle(true);
    try {
      const token = (await getPersistedAccessToken())?.trim();
      if (!token) return;
      const form = new FormData();
      form.append('file', {
        uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
        name: 'vehicle.jpg',
        type: 'image/jpeg',
      } as never);
      const res = await fetch(`${base}/muhabbet/profile/vehicle-photo`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
      const d = (await res.json().catch(() => ({}))) as { success?: boolean; url?: string; detail?: string };
      if (!res.ok || !d.success || !d.url) return Alert.alert('Araç fotoğrafı', d.detail || 'Yüklenemedi.');
      setP((prev) => (prev ? { ...prev, vehicle_photo_url: d.url } : prev));
    } catch {
      Alert.alert('Araç fotoğrafı', 'Yükleme hatası.');
    } finally {
      setUploadingVehicle(false);
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
        <View style={styles.center}>
          <Text style={styles.muted}>Profil yüklenemedi.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.heroCard}>
            <Pressable onPress={() => (isSelf ? void pickPhoto() : null)} style={styles.avatarWrap}>
              {photo ? (
                <Image source={{ uri: photo }} style={styles.avatar} />
              ) : (
                <LinearGradient colors={PRIMARY_GRAD} style={styles.avatarFallback}>
                  <Text style={styles.avatarInitials}>{initialsFromName(displayName)}</Text>
                </LinearGradient>
              )}
              {isSelf ? (
                <View style={styles.avatarEditBadge}>{uploading ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="camera" size={14} color="#fff" />}</View>
              ) : null}
            </Pressable>
            <Text style={styles.name}>{displayName}</Text>
            <View style={styles.badgesRow}>
              <Text style={[styles.badgePill, roleLabel === 'Sürücü' ? styles.badgeDriver : styles.badgePassenger]}>{roleLabel}</Text>
              {showDriverExtras ? <Text style={[styles.badgePill, styles.badgeKyc]}>KYC Onaylı</Text> : null}
            </View>
            {isSelf ? (
              <Pressable onPress={() => void pickPhoto()} style={styles.inlineLinkBtn}>
                <Text style={styles.inlineLinkTxt}>Profil fotoğrafı değiştir</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.statGrid}>
            <View style={styles.statCard}><Text style={styles.statNum}>{completedTrips}</Text><Text style={styles.statLab}>Tamamlanan yolculuk</Text></View>
            <View style={styles.statCard}><Text style={styles.statNum}>{rating}</Text><Text style={styles.statLab}>Puan</Text></View>
            <View style={styles.statCard}><Text style={styles.statNum}>{completedMatches}</Text><Text style={styles.statLab}>Başarılı eşleşme</Text></View>
            <View style={styles.statCard}><Text style={styles.statNum}>{activeListings}</Text><Text style={styles.statLab}>Aktif teklif</Text></View>
          </View>

          {showDriverExtras ? (
            <View style={styles.card}>
              <Text style={styles.section}>Araç kartı</Text>
              {vehiclePhoto ? (
                <Image source={{ uri: vehiclePhoto }} style={styles.vehicleImg} />
              ) : (
                <LinearGradient colors={VEHICLE_PH} style={styles.vehiclePh}>
                  <Ionicons name="car-sport" size={34} color="#3B82F6" />
                  <Text style={styles.vehiclePhTxt}>Araç fotoğrafı eklenmemiş</Text>
                </LinearGradient>
              )}
              <View style={styles.vehicleMetaRow}>
                <Text style={styles.vehicleMetaKey}>Araç türü</Text>
                <Text style={styles.vehicleMetaVal}>{vehicleKind}</Text>
              </View>
              {isSelf ? (
                <Pressable onPress={() => void pickVehiclePhoto()} style={styles.inlineLinkBtn}>
                  {uploadingVehicle ? <ActivityIndicator size="small" color={PRIMARY_GRAD[0]} /> : <Text style={styles.inlineLinkTxt}>Araç fotoğrafı değiştir</Text>}
                </Pressable>
              ) : null}
            </View>
          ) : null}

          <View style={styles.card}>
            <Text style={styles.section}>Hakkımda</Text>
            {isSelf ? (
              <>
                <TextInput
                  style={styles.bioInput}
                  value={bioDraft}
                  onChangeText={setBioDraft}
                  placeholder="Kısa açıklama ekleyin."
                  placeholderTextColor={TEXT_SECONDARY}
                  multiline
                  maxLength={500}
                />
                <Pressable onPress={() => void saveBio()} style={styles.saveBtn}>
                  {savingBio ? <ActivityIndicator size="small" color={PRIMARY_GRAD[0]} /> : <Text style={styles.inlineLinkTxt}>Hakkımda düzenle</Text>}
                </Pressable>
              </>
            ) : (
              <Text style={styles.aboutText}>{aboutText || 'Henüz bir açıklama eklenmemiş.'}</Text>
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F3F4F6' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  muted: { color: TEXT_SECONDARY, fontSize: 15 },
  scroll: { padding: 16, paddingBottom: 36 },
  heroCard: { backgroundColor: CARD_BG, borderRadius: 22, padding: 18, alignItems: 'center', marginBottom: 12, ...CARD_SHADOW },
  avatarWrap: { position: 'relative' },
  avatar: { width: 118, height: 118, borderRadius: 59, backgroundColor: '#E5E7EB' },
  avatarFallback: { width: 118, height: 118, borderRadius: 59, justifyContent: 'center', alignItems: 'center' },
  avatarInitials: { color: '#fff', fontSize: 34, fontWeight: '800' },
  avatarEditBadge: { position: 'absolute', right: 1, bottom: 1, backgroundColor: '#2563EB', borderRadius: 16, width: 32, height: 32, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  name: { marginTop: 12, fontSize: 25, fontWeight: '800', color: TEXT_PRIMARY, textAlign: 'center' },
  badgesRow: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap', justifyContent: 'center' },
  badgePill: { paddingVertical: 6, paddingHorizontal: 11, borderRadius: 999, fontSize: 12, fontWeight: '800' },
  badgeDriver: { backgroundColor: 'rgba(37,99,235,0.14)', color: '#1D4ED8' },
  badgePassenger: { backgroundColor: 'rgba(249,115,22,0.16)', color: '#C2410C' },
  badgeKyc: { backgroundColor: 'rgba(22,163,74,0.14)', color: '#15803D' },
  inlineLinkBtn: { marginTop: 11, paddingVertical: 6, paddingHorizontal: 10 },
  inlineLinkTxt: { color: '#2563EB', fontSize: 14, fontWeight: '700' },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  statCard: { width: '48%', backgroundColor: CARD_BG, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 10, alignItems: 'center', ...CARD_SHADOW },
  statNum: { fontSize: 20, fontWeight: '800', color: TEXT_PRIMARY },
  statLab: { marginTop: 4, fontSize: 12, color: TEXT_SECONDARY, textAlign: 'center' },
  card: { backgroundColor: CARD_BG, borderRadius: 18, padding: 16, marginBottom: 12, ...CARD_SHADOW },
  section: { fontSize: 17, fontWeight: '800', color: TEXT_PRIMARY, marginBottom: 8 },
  vehicleImg: { width: '100%', height: 180, borderRadius: 14, backgroundColor: '#E5E7EB' },
  vehiclePh: { width: '100%', height: 160, borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 8 },
  vehiclePhTxt: { fontSize: 13, color: '#475569', fontWeight: '600' },
  vehicleMetaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  vehicleMetaKey: { color: TEXT_SECONDARY, fontSize: 13, fontWeight: '700' },
  vehicleMetaVal: { color: TEXT_PRIMARY, fontSize: 14, fontWeight: '800' },
  bioInput: { minHeight: 84, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(15,23,42,0.2)', borderRadius: 12, padding: 12, fontSize: 15, color: TEXT_PRIMARY, textAlignVertical: 'top' },
  saveBtn: { marginTop: 8, alignSelf: 'flex-end' },
  aboutText: { fontSize: 15, color: TEXT_PRIMARY, lineHeight: 22 },
});
