/**
 * Muhabbet keşfî ekranı: şehir ilan akışı, gelen/giden eşleşme istekleri → sohbet (Expo Router).
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
  Platform,
} from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { handleUnauthorizedAndMaybeRedirect } from '../lib/muhabbetAuthRedirect';
import { GradientButton } from './GradientButton';

const TEXT_PRIMARY = '#111111';
const TEXT_SECONDARY = '#6E6E73';
const ACCENT = '#007AFF';
const CARD_BG = '#FFFFFF';
const CARD_RADIUS = 20;
const CARD_SHADOW = Platform.select({
  ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 },
  android: { elevation: 2 },
  default: {},
});

type ListingRow = {
  id: string;
  from_text?: string | null;
  to_text?: string | null;
  creator_name?: string | null;
  match_request_status?: string;
  conversation_id?: string | null;
  incoming_request_count?: number;
};

type MatchRequestRow = {
  id: string;
  status?: string | null;
  conversation_id?: string | null;
  sender_name?: string | null;
  receiver_name?: string | null;
  sender_user_id?: string;
  listing?: { from_text?: string | null; to_text?: string | null } | null;
};

type Props = {
  apiUrl: string;
  accessToken: string;
  selectedCity: string;
  syncVersion: number;
  requireToken: () => boolean;
};

function authHeader(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

function pushToChat(
  router: { push: (h: Href) => void },
  p: { conversationId: string; otherUserName: string; fromText: string; toText: string }
) {
  const q = new URLSearchParams();
  if (p.otherUserName) q.set('n', p.otherUserName);
  if (p.fromText) q.set('f', p.fromText);
  if (p.toText) q.set('t', p.toText);
  const s = q.toString();
  const path = s
    ? (`/muhabbet-chat/${encodeURIComponent(p.conversationId)}?${s}` as const)
    : (`/muhabbet-chat/${encodeURIComponent(p.conversationId)}` as const);
  router.push(path as Href);
}

function routeLine(from?: string | null, to?: string | null): string {
  return `${(from && String(from).trim()) || '—'} → ${(to && String(to).trim()) || '—'}`;
}

export default function LeylekMuhabbetiListingInboxBlock({
  apiUrl,
  accessToken,
  selectedCity,
  syncVersion,
  requireToken,
}: Props) {
  const router = useRouter();
  const tok = accessToken.trim();
  const base = apiUrl.replace(/\/$/, '');

  const [loadingFeed, setLoadingFeed] = useState(false);
  const [listings, setListings] = useState<ListingRow[]>([]);
  const [loadingIn, setLoadingIn] = useState(false);
  const [incoming, setIncoming] = useState<MatchRequestRow[]>([]);
  const [loadingOut, setLoadingOut] = useState(false);
  const [outgoing, setOutgoing] = useState<MatchRequestRow[]>([]);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  const loadFeed = useCallback(async () => {
    if (!tok) {
      setListings([]);
      return;
    }
    setLoadingFeed(true);
    try {
      const u = new URLSearchParams({ city: selectedCity, limit: '30' });
      const res = await fetch(`${base}/muhabbet/listings/feed?${u.toString()}`, {
        headers: authHeader(tok),
      });
      const d = (await res.json().catch(() => ({}))) as { success?: boolean; listings?: ListingRow[] };
      if (res.ok && d.success && Array.isArray(d.listings)) setListings(d.listings);
      else setListings([]);
    } catch {
      setListings([]);
    } finally {
      setLoadingFeed(false);
    }
  }, [base, selectedCity, tok]);

  const loadIncoming = useCallback(async () => {
    if (!tok) {
      setIncoming([]);
      return;
    }
    setLoadingIn(true);
    try {
      const u = new URLSearchParams({ status: 'pending', limit: '50' });
      const res = await fetch(`${base}/muhabbet/match-requests/incoming?${u.toString()}`, {
        headers: authHeader(tok),
      });
      const d = (await res.json().catch(() => ({}))) as { success?: boolean; requests?: MatchRequestRow[] };
      if (res.ok && d.success && Array.isArray(d.requests)) setIncoming(d.requests);
      else setIncoming([]);
    } catch {
      setIncoming([]);
    } finally {
      setLoadingIn(false);
    }
  }, [base, tok]);

  const loadOutgoing = useCallback(async () => {
    if (!tok) {
      setOutgoing([]);
      return;
    }
    setLoadingOut(true);
    try {
      const u = new URLSearchParams({ status: 'all', limit: '50' });
      const res = await fetch(`${base}/muhabbet/match-requests/outgoing?${u.toString()}`, {
        headers: authHeader(tok),
      });
      const d = (await res.json().catch(() => ({}))) as { success?: boolean; requests?: MatchRequestRow[] };
      if (res.ok && d.success && Array.isArray(d.requests)) setOutgoing(d.requests);
      else setOutgoing([]);
    } catch {
      setOutgoing([]);
    } finally {
      setLoadingOut(false);
    }
  }, [base, tok]);

  const loadAll = useCallback(async () => {
    await Promise.all([loadFeed(), loadIncoming(), loadOutgoing()]);
  }, [loadFeed, loadIncoming, loadOutgoing]);

  useEffect(() => {
    if (tok) void loadAll();
  }, [tok, loadAll, selectedCity, syncVersion]);

  const onAccept = async (row: MatchRequestRow) => {
    if (!requireToken() || !tok) return;
    setAcceptingId(row.id);
    try {
      const res = await fetch(`${base}/muhabbet/match-requests/${encodeURIComponent(row.id)}/accept`, {
        method: 'POST',
        headers: { ...authHeader(tok), 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (handleUnauthorizedAndMaybeRedirect(res)) return;
      const d = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        conversation_id?: string;
        detail?: string;
      };
      if (!res.ok || !d.success || !d.conversation_id) {
        Alert.alert('İstek', typeof d.detail === 'string' && d.detail ? d.detail : 'Kabul edilemedi.');
        return;
      }
      const fromT = (row.listing?.from_text as string) || '';
      const toT = (row.listing?.to_text as string) || '';
      const other = (row.sender_name as string) || 'Kullanıcı';
      pushToChat(router, {
        conversationId: d.conversation_id,
        otherUserName: other,
        fromText: fromT,
        toText: toT,
      });
      void loadIncoming();
      void loadFeed();
    } catch {
      Alert.alert('İstek', 'Bağlantı hatası.');
    } finally {
      setAcceptingId(null);
    }
  };

  const onReject = async (row: MatchRequestRow) => {
    if (!requireToken() || !tok) return;
    setRejectingId(row.id);
    try {
      const res = await fetch(`${base}/muhabbet/match-requests/${encodeURIComponent(row.id)}/reject`, {
        method: 'POST',
        headers: { ...authHeader(tok), 'Content-Type': 'application/json' },
        body: '{}',
      });
      const d = (await res.json().catch(() => ({}))) as { success?: boolean; detail?: string };
      if (!res.ok || !d.success) {
        Alert.alert('İstek', typeof d.detail === 'string' && d.detail ? d.detail : 'Reddedilemedi.');
        return;
      }
      void loadIncoming();
    } catch {
      Alert.alert('İstek', 'Bağlantı hatası.');
    } finally {
      setRejectingId(null);
    }
  };

  if (!tok) return null;

  return (
    <View style={styles.block}>
      <View style={styles.convoCtaRow}>
        <Text style={styles.blockTitle}>Sohbetlerin</Text>
        <Pressable
          onPress={() => router.push('/muhabbet-conversations' as Href)}
          style={({ pressed }) => [styles.sohbetListBtn, pressed && { opacity: 0.9 }]}
        >
          <Text style={styles.sohbetListBtnText}>Tümünü aç</Text>
        </Pressable>
      </View>
      <Text style={styles.blockSub}>Kabul edilen eşleşmelerin ve mesajların listesi</Text>

      <Text style={styles.sectionTitle}>Güzergah ilanları</Text>
      <Text style={styles.muted}>
        {selectedCity} · açık yolculuk / ilanlar
      </Text>
      {loadingFeed ? <ActivityIndicator color={ACCENT} style={{ marginVertical: 10 }} /> : null}
      {!loadingFeed && listings.length === 0 ? (
        <Text style={styles.mutedPad}>Bu şehirde şu an listelenebilir ilan yok.</Text>
      ) : null}
      {listings.map((L) => {
        const st = (L.match_request_status || 'none').toLowerCase();
        const accepted = st === 'accepted' && L.conversation_id;
        return (
          <View key={L.id} style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.cardName} numberOfLines={1}>
                {L.creator_name || 'Kullanıcı'}
              </Text>
              {typeof L.incoming_request_count === 'number' && L.incoming_request_count > 0 ? (
                <View style={styles.crowdPill}>
                  <Text style={styles.crowdPillText}>{L.incoming_request_count} yanıt</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.cardRoute} numberOfLines={2}>
              {routeLine(L.from_text, L.to_text)}
            </Text>
            <View style={styles.badgeRow}>
              <View style={styles.pillLight}>
                <Text style={styles.pillLightText}>
                  {st === 'none' ? 'İstek yok' : st === 'pending' ? 'İsteğin beklemede' : st === 'accepted' ? 'Eşleşme tamam' : st}
                </Text>
              </View>
            </View>
            {accepted ? (
              <GradientButton
                label="Mesaja Git"
                variant="secondary"
                onPress={() => {
                  const other = (L.creator_name || 'Kullanıcı').trim();
                  const fromT = (L.from_text && String(L.from_text)) || '';
                  const toT = (L.to_text && String(L.to_text)) || '';
                  if (!L.conversation_id) return;
                  pushToChat(router, {
                    conversationId: L.conversation_id!,
                    otherUserName: other,
                    fromText: fromT,
                    toText: toT,
                  });
                }}
                style={{ marginTop: 10 }}
              />
            ) : null}
          </View>
        );
      })}

      <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Gelen eşleşme istekleri</Text>
      {loadingIn ? <ActivityIndicator color={ACCENT} style={{ marginVertical: 8 }} /> : null}
      {!loadingIn && incoming.length === 0 ? (
        <Text style={styles.mutedPad}>Bekleyen istek yok.</Text>
      ) : null}
      {incoming.map((r) => (
        <View key={r.id} style={styles.card}>
          <Text style={styles.cardName} numberOfLines={1}>
            {r.sender_name || 'Kullanıcı'}
          </Text>
          <Text style={styles.cardRoute} numberOfLines={2}>
            {routeLine(r.listing?.from_text, r.listing?.to_text)}
          </Text>
          <View style={styles.row2}>
            <View style={styles.pillAction}>
              <Text style={styles.pillActionText}>Beklemede</Text>
            </View>
            <View style={styles.inRow}>
              <Pressable
                onPress={() => void onReject(r)}
                disabled={rejectingId === r.id}
                style={styles.rejectLink}
              >
                <Text style={styles.rejectLinkText}>
                  {rejectingId === r.id ? '…' : 'Reddet'}
                </Text>
              </Pressable>
              <GradientButton
                label="Kabul et"
                loading={acceptingId === r.id}
                onPress={() => void onAccept(r)}
                style={{ minWidth: 120 }}
              />
            </View>
          </View>
        </View>
      ))}

      <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Giden istekler</Text>
      {loadingOut ? <ActivityIndicator color={ACCENT} style={{ marginVertical: 8 }} /> : null}
      {!loadingOut && outgoing.length === 0 ? (
        <Text style={styles.mutedPad}>Henüz istek yok.</Text>
      ) : null}
      {outgoing.map((r) => {
        const st = (r.status || '').toLowerCase();
        const isAcc = st === 'accepted' && r.conversation_id;
        return (
          <View key={r.id} style={styles.card}>
            <Text style={styles.cardName} numberOfLines={1}>
              {r.receiver_name || 'İlan sahibi'}
            </Text>
            <Text style={styles.cardRoute} numberOfLines={2}>
              {routeLine(r.listing?.from_text, r.listing?.to_text)}
            </Text>
            <View style={styles.pillRow}>
              <View style={styles.pillLight}>
                <Text style={styles.pillLightText}>
                  {st === 'pending' ? 'Beklemede' : st === 'accepted' ? 'Kabul' : st === 'rejected' ? 'Red' : st}
                </Text>
              </View>
            </View>
            {isAcc ? (
              <GradientButton
                label="Mesaja Git"
                variant="secondary"
                onPress={() => {
                  const other = (r.receiver_name || 'Kullanıcı').trim();
                  const fromT = (r.listing?.from_text as string) || '';
                  const toT = (r.listing?.to_text as string) || '';
                  if (!r.conversation_id) return;
                  pushToChat(router, {
                    conversationId: r.conversation_id!,
                    otherUserName: other,
                    fromText: fromT,
                    toText: toT,
                  });
                }}
                style={{ marginTop: 10 }}
              />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { marginTop: 4 },
  blockTitle: { color: TEXT_PRIMARY, fontSize: 22, fontWeight: '700' },
  blockSub: { color: TEXT_SECONDARY, fontSize: 15, lineHeight: 20, marginBottom: 12 },
  convoCtaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  sohbetListBtn: {
    backgroundColor: 'rgba(0,122,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  sohbetListBtnText: { color: ACCENT, fontWeight: '700', fontSize: 14 },
  sectionTitle: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '700', marginTop: 4, marginBottom: 4 },
  muted: { color: TEXT_SECONDARY, fontSize: 14, marginBottom: 8, lineHeight: 20 },
  mutedPad: { color: TEXT_SECONDARY, fontSize: 15, marginVertical: 6, lineHeight: 22 },
  card: {
    backgroundColor: CARD_BG,
    borderRadius: CARD_RADIUS,
    padding: 14,
    marginBottom: 10,
    ...CARD_SHADOW,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardName: { flex: 1, fontSize: 16, fontWeight: '700', color: TEXT_PRIMARY },
  crowdPill: { backgroundColor: 'rgba(255,138,0,0.12)', paddingHorizontal: 8, borderRadius: 8, paddingVertical: 3 },
  crowdPillText: { fontSize: 11, fontWeight: '700', color: '#C65D00' },
  cardRoute: { marginTop: 6, fontSize: 15, color: TEXT_PRIMARY, lineHeight: 22 },
  badgeRow: { marginTop: 8, flexDirection: 'row' },
  pillLight: { alignSelf: 'flex-start', backgroundColor: 'rgba(60,60,67,0.08)', paddingHorizontal: 10, borderRadius: 8, paddingVertical: 3 },
  pillLightText: { fontSize: 12, color: TEXT_SECONDARY, fontWeight: '600' },
  row2: { marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  inRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pillAction: { backgroundColor: 'rgba(255,138,0,0.12)', paddingHorizontal: 8, borderRadius: 8, paddingVertical: 3 },
  pillActionText: { color: '#C65D00', fontSize: 12, fontWeight: '600' },
  rejectLink: { paddingVertical: 4, paddingHorizontal: 4 },
  rejectLinkText: { color: TEXT_SECONDARY, fontWeight: '600', fontSize: 15 },
  pillRow: { marginTop: 6 },
});
