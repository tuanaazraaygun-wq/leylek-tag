/**
 * Muhabbet — teklif sahibine gelen talepler (/listing-match-requests/me).
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
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

export type MatchRequestMeRow = {
  id: string;
  sender_user_id?: string;
  sender_name?: string | null;
  sender_user_name?: string | null;
  sender_rating?: number | null;
  sender_total_trips?: number | null;
  message?: string | null;
  time_match_hint?: string | null;
  status?: string | null;
  conversation_id?: string | null;
  listing?: { from_text?: string | null; to_text?: string | null } | null;
};

function routeLine(from?: string | null, to?: string | null): string {
  return `${(from && String(from).trim()) || '—'} → ${(to && String(to).trim()) || '—'}`;
}

function pushToChat(
  router: { push: (h: Href) => void },
  p: { conversationId: string; otherUserName: string; fromText: string; toText: string; otherUserId?: string }
) {
  const q = new URLSearchParams();
  if (p.otherUserName) q.set('n', p.otherUserName);
  if (p.fromText) q.set('f', p.fromText);
  if (p.toText) q.set('t', p.toText);
  if (p.otherUserId) q.set('ou', p.otherUserId);
  const s = q.toString();
  const path = s
    ? (`/muhabbet-chat/${encodeURIComponent(p.conversationId)}?${s}` as const)
    : (`/muhabbet-chat/${encodeURIComponent(p.conversationId)}` as const);
  router.push(path as Href);
}

export type MatchRequestsScreenProps = {
  apiBaseUrl: string;
  onBack?: () => void;
};

export default function MatchRequestsScreen({ apiBaseUrl, onBack }: MatchRequestsScreenProps) {
  const router = useRouter();
  const base = apiBaseUrl.replace(/\/$/, '');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rows, setRows] = useState<MatchRequestMeRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<'accept' | 'reject' | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = (await getPersistedAccessToken())?.trim();
      if (!token) {
        setRows([]);
        return;
      }
      let res = await fetch(`${base}/muhabbet/listing-match-requests/me?status=pending&limit=80`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 404) {
        res = await fetch(`${base}/muhabbet/match-requests/incoming?status=pending&limit=80`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      if (handleUnauthorizedAndMaybeRedirect(res)) {
        setRows([]);
        return;
      }
      const d = (await res.json().catch(() => ({}))) as { success?: boolean; requests?: MatchRequestMeRow[] };
      if (res.ok && d.success && Array.isArray(d.requests)) setRows(d.requests);
      else setRows([]);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [base]);

  useEffect(() => {
    void load();
  }, [load]);

  const onPull = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  const onAccept = async (row: MatchRequestMeRow) => {
    const token = (await getPersistedAccessToken())?.trim();
    if (!token) return;
    setBusyId(row.id);
    setBusyAction('accept');
    try {
      const res = await fetch(`${base}/muhabbet/match-requests/${encodeURIComponent(row.id)}/accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (handleUnauthorizedAndMaybeRedirect(res)) return;
      const d = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        conversation_id?: string;
        detail?: string;
      };
      if (!res.ok || !d.success || !d.conversation_id) {
        Alert.alert('Talep', typeof d.detail === 'string' && d.detail ? d.detail : 'Kabul edilemedi.');
        return;
      }
      const sid = String(row.sender_user_id || '').trim();
      pushToChat(router, {
        conversationId: d.conversation_id,
        otherUserName: (row.sender_user_name || row.sender_name || 'Kullanıcı').trim(),
        fromText: String(row.listing?.from_text || ''),
        toText: String(row.listing?.to_text || ''),
        otherUserId: sid || undefined,
      });
      void load();
    } catch {
      Alert.alert('Talep', 'Bağlantı hatası.');
    } finally {
      setBusyId(null);
      setBusyAction(null);
    }
  };

  const onReject = async (row: MatchRequestMeRow) => {
    const token = (await getPersistedAccessToken())?.trim();
    if (!token) return;
    setBusyId(row.id);
    setBusyAction('reject');
    try {
      const res = await fetch(`${base}/muhabbet/match-requests/${encodeURIComponent(row.id)}/reject`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: '{}',
      });
      const d = (await res.json().catch(() => ({}))) as { success?: boolean; detail?: string };
      if (!res.ok || !d.success) {
        Alert.alert('Talep', typeof d.detail === 'string' && d.detail ? d.detail : 'Reddedilemedi.');
        return;
      }
      void load();
    } catch {
      Alert.alert('Talep', 'Bağlantı hatası.');
    } finally {
      setBusyId(null);
      setBusyAction(null);
    }
  };

  const openProfile = (userId: string | undefined) => {
    const id = (userId || '').trim();
    if (!id) return;
    router.push(`/muhabbet-profile/${encodeURIComponent(id)}` as Href);
  };

  return (
    <SafeAreaView style={styles.root} edges={['left', 'right', 'bottom']}>
      <ScreenHeaderGradient
        title="Gelen talepler"
        onBack={onBack ?? (() => router.back())}
        gradientColors={PRIMARY_GRAD}
      />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={PRIMARY_GRAD[0]} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void onPull()} tintColor={PRIMARY_GRAD[0]} />
          }
        >
          <Text style={styles.lead}>Teklifine gelen talepler — kabul sonrası sohbet açılır.</Text>
          {rows.length === 0 ? (
            <Text style={styles.muted}>Bekleyen talep yok.</Text>
          ) : (
            rows.map((r) => {
              const name = (r.sender_user_name || r.sender_name || 'Kullanıcı').trim();
              const rating = r.sender_rating != null ? Number(r.sender_rating).toFixed(1) : '—';
              const trips = r.sender_total_trips != null ? String(r.sender_total_trips) : '—';
              const acceptBusy = busyId === r.id && busyAction === 'accept';
              const rejectBusy = busyId === r.id && busyAction === 'reject';
              return (
                <View key={r.id} style={styles.card}>
                  <Text style={styles.name}>{name}</Text>
                  <Text style={styles.meta}>
                    ⭐ {rating} · 🧭 {trips} yolculuk
                  </Text>
                  <Text style={styles.route}>{routeLine(r.listing?.from_text, r.listing?.to_text)}</Text>
                  {r.message ? (
                    <Text style={styles.msg} numberOfLines={4}>
                      “{r.message}”
                    </Text>
                  ) : null}
                  <Text style={styles.hint}>Saat uyumu: {r.time_match_hint || '—'}</Text>
                  <View style={styles.row}>
                    <Pressable onPress={() => openProfile(r.sender_user_id)} style={styles.linkBtn}>
                      <Text style={styles.linkText}>Profili Gör</Text>
                    </Pressable>
                    <Pressable onPress={() => void onReject(r)} disabled={!!busyId}>
                      <Text style={styles.reject}>{rejectBusy ? '…' : 'Reddet'}</Text>
                    </Pressable>
                    <GradientButton
                      label="Kabul Et"
                      loading={acceptBusy}
                      onPress={() => void onAccept(r)}
                      style={{ minWidth: 112 }}
                    />
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F2F2F7' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 16, paddingBottom: 32 },
  lead: { fontSize: 14, color: TEXT_SECONDARY, marginBottom: 14, lineHeight: 20 },
  muted: { fontSize: 15, color: TEXT_SECONDARY },
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    ...CARD_SHADOW,
  },
  name: { fontSize: 17, fontWeight: '800', color: TEXT_PRIMARY },
  meta: { marginTop: 4, fontSize: 13, color: TEXT_SECONDARY },
  route: { marginTop: 8, fontSize: 15, color: TEXT_PRIMARY, fontWeight: '600', lineHeight: 22 },
  msg: { marginTop: 8, fontSize: 14, color: TEXT_PRIMARY, lineHeight: 20 },
  hint: { marginTop: 6, fontSize: 12, color: TEXT_SECONDARY },
  row: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  linkBtn: { paddingVertical: 6, paddingHorizontal: 4 },
  linkText: { color: PRIMARY_GRAD[0], fontWeight: '700', fontSize: 15 },
  reject: { color: TEXT_SECONDARY, fontWeight: '600', fontSize: 15, paddingHorizontal: 8 },
});
