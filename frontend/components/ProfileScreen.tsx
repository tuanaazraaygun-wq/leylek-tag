/**
 * Muhabbet kullanıcı profili (GET /muhabbet/users/{id}/public-profile).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ScreenHeaderGradient } from './ScreenHeaderGradient';
import { GradientButton } from './GradientButton';
import { getPersistedAccessToken } from '../lib/sessionToken';
import { handleUnauthorizedAndMaybeRedirect } from '../lib/muhabbetAuthRedirect';

const PRIMARY_GRAD = ['#3B82F6', '#60A5FA'] as const;
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
  extras?: {
    vehicle_summary?: Record<string, unknown> | null;
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
      if (res.ok && d.success && d.profile) setP(d.profile);
      else setP(null);
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
  const showLeylekKey = (p?.completed_matches ?? 0) > 0;

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
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.card}>
            <Text style={styles.name}>{p.name || 'Kullanıcı'}</Text>
            <Text style={styles.meta}>
              ⭐ {p.rating != null ? Number(p.rating).toFixed(1) : '—'} · 🧭 {p.total_trips ?? 0} yolculuk
            </Text>
            <Text style={styles.line}>Tamamlanan eşleşme: {p.completed_matches ?? 0}</Text>
            <Text style={styles.line}>Aktif teklif: {p.active_listings ?? 0}</Text>
          </View>

          {isDriver && p.extras?.vehicle_summary ? (
            <View style={styles.card}>
              <Text style={styles.section}>Araç</Text>
              <Text style={styles.mono}>{JSON.stringify(p.extras.vehicle_summary, null, 2)}</Text>
              <Text style={styles.mutedSmall}>
                Günlük yolculuk / haftalık kazanç: henüz bağlı değil (Faz 4 öncesi placeholder).
              </Text>
            </View>
          ) : !isDriver ? (
            <View style={styles.card}>
              <Text style={styles.section}>Yolcu</Text>
              <Text style={styles.mutedSmall}>Geçmiş yolculuklar ve yorumlar sonraki fazda genişletilecek.</Text>
            </View>
          ) : null}

          {showLeylekKey ? (
            <View style={styles.card}>
              <Text style={styles.section}>Leylek Anahtar</Text>
              <Text style={styles.mutedSmall}>Aktif eşleşme geçmişin var. Anahtar oluşturma yakında bağlanacak.</Text>
              <GradientButton
                label="Leylek Anahtar Oluştur"
                variant="secondary"
                onPress={() =>
                  Alert.alert('Leylek Anahtar', 'Bu özellik henüz sunucuya bağlı değil; arayüz hazırlandı (Faz 4).')
                }
                style={{ marginTop: 12 }}
              />
            </View>
          ) : null}
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
  card: { backgroundColor: CARD_BG, borderRadius: 18, padding: 16, marginBottom: 12, ...CARD_SHADOW },
  name: { fontSize: 22, fontWeight: '800', color: TEXT_PRIMARY },
  meta: { marginTop: 6, fontSize: 14, color: TEXT_SECONDARY },
  line: { marginTop: 8, fontSize: 15, color: TEXT_PRIMARY },
  section: { fontSize: 16, fontWeight: '800', color: TEXT_PRIMARY, marginBottom: 8 },
  mono: { fontSize: 12, color: TEXT_SECONDARY, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  muted: { fontSize: 15, color: TEXT_SECONDARY, textAlign: 'center' },
  mutedSmall: { fontSize: 13, color: TEXT_SECONDARY, lineHeight: 18, marginTop: 8 },
});
