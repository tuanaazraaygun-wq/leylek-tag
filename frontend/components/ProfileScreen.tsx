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
  full_name?: string;
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

function initialsFromName(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'LK';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
}

export default function ProfileScreen({ apiBaseUrl, userId, onBack }: ProfileScreenProps) {
  const router = useRouter();
  const base = apiBaseUrl.replace(/\/$/, '');
  const [loading, setLoading] = useState(true);
  const [p, setP] = useState<PublicProfilePayload | null>(null);
  const [myId, setMyId] = useState<string>('');
  const [bioDraft, setBioDraft] = useState('');
  const [savingBio, setSavingBio] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingVehicle, setUploadingVehicle] = useState(false);
  const [keyBusy, setKeyBusy] = useState(false);
  const [lastKey, setLastKey] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const raw = await getPersistedUserRaw();
        if (!raw) return;
        const u = JSON.parse(raw) as { id?: string };
        if (u?.id) setMyId(String(u.id).trim().toLowerCase());
      } catch {
        /* noop */
      }
    })();
  }, []);

  const isSelf = useMemo(() => myId && userId && myId === String(userId).trim().toLowerCase(), [myId, userId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = (await getPersistedAccessToken())?.trim();
      if (!token) return setP(null);
      const path = isSelf ? '/muhabbet/profile/me' : `/muhabbet/profile/${encodeURIComponent(userId.trim())}`;
      const res = await fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${token}` } });
      if (handleUnauthorizedAndMaybeRedirect(res)) return setP(null);
      const d = (await res.json().catch(() => ({}))) as { success?: boolean; profile?: PublicProfilePayload };
      if (!res.ok || !d.success || !d.profile) return setP(null);
      setP(d.profile);
      setBioDraft((d.profile.about || d.profile.muhabbet_bio || '').trim());
    } catch {
      setP(null);
    } finally {
      setLoading(false);
    }
  }, [base, isSelf, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const displayName = isSelf ? p?.full_name || p?.public_name || 'Leylek kullanıcısı' : p?.public_name || 'Leylek kullanıcısı';
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
    if (!isSelf) return;
    setSavingBio(true);
    try {
      const token = (await getPersistedAccessToken())?.trim();
      if (!token) return;
      const res = await fetch(`${base}/muhabbet/profile/about`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ bio: bioDraft.trim() }),
      });
      if (handleUnauthorizedAndMaybeRedirect(res)) return;
      const d = (await res.json().catch(() => ({}))) as { success?: boolean; detail?: string };
      if (!res.ok || !d.success) {
        Alert.alert('Profil', typeof d.detail === 'string' && d.detail ? d.detail : 'Kaydedilemedi.');
        return;
      }
      setP((prev) => (prev ? { ...prev, about: bioDraft.trim() || null } : prev));
    } catch {
      Alert.alert('Profil', 'Bağlantı hatası.');
    } finally {
      setSavingBio(false);
    }
  };

  const pickPhoto = async () => {
    if (!isSelf) return;
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
      if (!token) return;
      const form = new FormData();
      form.append('file', {
        uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
        name: 'profile.jpg',
        type: 'image/jpeg',
      } as never);
      const res = await fetch(`${base}/muhabbet/profile/photo`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
      const d = (await res.json().catch(() => ({}))) as { success?: boolean; url?: string; detail?: string };
      if (!res.ok || !d.success || !d.url) return Alert.alert('Fotoğraf', d.detail || 'Yüklenemedi.');
      setP((prev) => (prev ? { ...prev, profile_photo_url: d.url } : prev));
    } catch {
      Alert.alert('Fotoğraf', 'Yükleme hatası.');
    } finally {
      setUploading(false);
    }
  };

  const pickVehiclePhoto = async () => {
    if (!isSelf || !showDriverExtras) return;
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

  const createLeylekKey = async () => {
    if (!isSelf) return;
    setKeyBusy(true);
    setLastKey(null);
    try {
      const token = (await getPersistedAccessToken())?.trim();
      if (!token) return;
      const res = await fetch(`${base}/muhabbet/leylek-key/create`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      if (handleUnauthorizedAndMaybeRedirect(res)) return;
      const d = (await res.json().catch(() => ({}))) as { success?: boolean; key?: string; detail?: string };
      if (!res.ok || !d.success || !d.key) return Alert.alert('Leylek Anahtar', d.detail || 'Oluşturulamadı.');
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
                  placeholder="Kısa açıklama (en fazla 500 karakter)"
                  placeholderTextColor={TEXT_SECONDARY}
                  multiline
                  maxLength={500}
                />
                <Pressable onPress={() => void saveBio()} style={styles.saveBtn}>
                  {savingBio ? <ActivityIndicator size="small" color={PRIMARY_GRAD[0]} /> : <Text style={styles.inlineLinkTxt}>Hakkımda düzenle</Text>}
                </Pressable>
              </>
            ) : (
              <Text style={styles.aboutText}>{aboutText || 'Açıklama eklenmemiş.'}</Text>
            )}
          </View>

          {isSelf ? (
            <View style={styles.card}>
              <Text style={styles.section}>Leylek Anahtar</Text>
              <Text style={styles.helpText}>Sohbet içi güvenli eşleşme için tek kullanımlık anahtar.</Text>
              <Pressable disabled={keyBusy} onPress={() => void createLeylekKey()} style={styles.keyBtnWrap}>
                <LinearGradient colors={ORANGE_GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.keyBtn}>
                  {keyBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.keyBtnTxt}>Leylek Anahtar Oluştur</Text>}
                </LinearGradient>
              </Pressable>
              {lastKey ? <Text style={styles.keyOut}>{lastKey}</Text> : null}
            </View>
          ) : null}
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
  helpText: { color: TEXT_SECONDARY, fontSize: 14, lineHeight: 20, marginBottom: 10 },
  keyBtnWrap: { borderRadius: 14, overflow: 'hidden' },
  keyBtn: { minHeight: 48, justifyContent: 'center', alignItems: 'center' },
  keyBtnTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
  keyOut: { marginTop: 10, fontSize: 18, fontWeight: '800', color: TEXT_PRIMARY },
});
