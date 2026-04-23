/**
 * Leylek Muhabbeti — İlanlar sekmesi: filtre, feed, eşleşme, ilan oluşturma.
 *
 * GEÇİCİ (test / Faz 1): seats_count, repeat_type, selected_days, time_window
 * bilgileri ayrı API kolonları yokken `note` metnine gömülür — kalıcı çözüm DEĞİLDİR.
 * Sonraki faz: ride_listings + API + migration ile gerçek kolonlara taşınacak.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View, Platform } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { GradientButton } from './GradientButton';
import { handleUnauthorizedAndMaybeRedirect } from '../lib/muhabbetAuthRedirect';
import CreateListingModal from './CreateListingModal';

const PRIMARY_GRAD = ['#3B82F6', '#60A5FA'] as const;
const ACCENT = '#F59E0B';
const TEXT_PRIMARY = '#111111';
const TEXT_SECONDARY = '#6E6E73';
const CARD_BG = '#FFFFFF';
const CARD_SHADOW = Platform.select({
  ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 },
  android: { elevation: 2 },
  default: {},
});

type RoleFilter = 'all' | 'driver' | 'passenger';

export type FeedListing = {
  id: string;
  from_text?: string | null;
  to_text?: string | null;
  departure_time?: string | null;
  price_amount?: number | null;
  note?: string | null;
  status?: string | null;
  listing_type?: string | null;
  role_type?: string | null;
  creator_name?: string | null;
  created_by_user_id?: string;
  match_request_status?: string;
  conversation_id?: string | null;
  incoming_request_count?: number;
};

type MatchRequestRow = {
  id: string;
  status?: string | null;
  conversation_id?: string | null;
  sender_user_id?: string | null;
  receiver_user_id?: string | null;
  sender_name?: string | null;
  receiver_name?: string | null;
  listing?: { from_text?: string | null; to_text?: string | null } | null;
};

export type ListingsTabProps = {
  apiUrl: string;
  accessToken: string;
  selectedCity: string;
  currentUserId: string;
  /** Ana uygulama rolü — eşleşme CTA metni için */
  viewerAppRole: string;
  syncVersion: number;
  openCreateSignal: number;
  initialCreateRole?: 'driver' | 'passenger';
  requireToken: () => boolean;
};

/** @deprecated ListingsTab kullanın */
export type LeylekMuhabbetiListingsHubProps = ListingsTabProps;

function authHeader(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

function routeLine(from?: string | null, to?: string | null): string {
  return `${(from && String(from).trim()) || '—'} → ${(to && String(to).trim()) || '—'}`;
}

function formatDeparture(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(String(iso));
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
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

function statusLabel(st: string | null | undefined): string {
  const x = (st || '').toLowerCase();
  if (x === 'active') return 'Yayında';
  if (x === 'matched') return 'Eşleşti';
  if (x === 'closed') return 'Kapandı';
  if (x === 'cancelled') return 'İptal';
  return st || '—';
}

function roleBadge(role: string | undefined): { label: string; tone: 'drv' | 'pax' } {
  const r = (role || '').toLowerCase();
  if (r === 'driver' || r === 'private_driver') return { label: 'Sürücü', tone: 'drv' };
  return { label: 'Yolcu', tone: 'pax' };
}

function viewerIsDriverRole(appRole: string): boolean {
  const r = (appRole || '').toLowerCase();
  return r === 'driver' || r === 'private_driver';
}

function matchCtaLabel(listingRole: string | null | undefined, appRole: string): string {
  const lr = (listingRole || '').toLowerCase();
  const driverListing = lr === 'driver' || lr === 'private_driver';
  if (driverListing && !viewerIsDriverRole(appRole)) return 'Bu yolculuğa katıl';
  if (!driverListing && viewerIsDriverRole(appRole)) return 'Bu yolcuyu alabilirim';
  return 'Eşleşmek istiyorum';
}

export default function ListingsTab({
  apiUrl,
  accessToken,
  selectedCity,
  currentUserId,
  viewerAppRole,
  syncVersion,
  openCreateSignal,
  initialCreateRole = 'passenger',
  requireToken,
}: ListingsTabProps) {
  const router = useRouter();
  const tok = accessToken.trim();
  const base = apiUrl.replace(/\/$/, '');

  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [loadingFeed, setLoadingFeed] = useState(false);
  const [listings, setListings] = useState<FeedListing[]>([]);
  const [loadingOut, setLoadingOut] = useState(false);
  const [outgoing, setOutgoing] = useState<MatchRequestRow[]>([]);
  const [matchBusyId, setMatchBusyId] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [modalInitialRole, setModalInitialRole] = useState<'driver' | 'passenger'>(initialCreateRole);

  const prevOpenSig = React.useRef(openCreateSignal);
  useEffect(() => {
    if (openCreateSignal !== prevOpenSig.current && openCreateSignal > 0) {
      setModalInitialRole(initialCreateRole);
      setCreateOpen(true);
      prevOpenSig.current = openCreateSignal;
    }
  }, [openCreateSignal, initialCreateRole]);

  const loadFeed = useCallback(async () => {
    if (!tok) {
      setListings([]);
      return;
    }
    setLoadingFeed(true);
    try {
      const u = new URLSearchParams({ city: selectedCity, limit: '40' });
      if (roleFilter === 'driver') u.set('role_type', 'driver');
      if (roleFilter === 'passenger') u.set('role_type', 'passenger');
      const res = await fetch(`${base}/muhabbet/listings/feed?${u.toString()}`, {
        headers: authHeader(tok),
      });
      if (handleUnauthorizedAndMaybeRedirect(res)) {
        setListings([]);
        return;
      }
      const d = (await res.json().catch(() => ({}))) as { success?: boolean; listings?: FeedListing[] };
      if (res.ok && d.success && Array.isArray(d.listings)) setListings(d.listings);
      else setListings([]);
    } catch {
      setListings([]);
    } finally {
      setLoadingFeed(false);
    }
  }, [base, selectedCity, tok, roleFilter]);

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
      if (handleUnauthorizedAndMaybeRedirect(res)) {
        setOutgoing([]);
        return;
      }
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
    await Promise.all([loadFeed(), loadOutgoing()]);
  }, [loadFeed, loadOutgoing]);

  useEffect(() => {
    if (tok) void loadAll();
  }, [tok, loadAll, selectedCity, syncVersion]);

  const sendMatchRequest = async (listingId: string) => {
    if (!requireToken() || !tok) return;
    setMatchBusyId(listingId);
    const snapshot = listings;
    setListings((rows) =>
      rows.map((x) => (x.id === listingId ? { ...x, match_request_status: 'pending' } : x))
    );
    try {
      const res = await fetch(`${base}/muhabbet/listings/${encodeURIComponent(listingId)}/match-request`, {
        method: 'POST',
        headers: { ...authHeader(tok), 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: null }),
      });
      if (handleUnauthorizedAndMaybeRedirect(res)) {
        setListings(snapshot);
        return;
      }
      const d = (await res.json().catch(() => ({}))) as { success?: boolean; detail?: string };
      if (!res.ok || !d.success) {
        setListings(snapshot);
        Alert.alert('Eşleşme', typeof d.detail === 'string' && d.detail ? d.detail : 'İstek gönderilemedi.');
        return;
      }
      void loadFeed();
      void loadOutgoing();
    } catch {
      setListings(snapshot);
      Alert.alert('Eşleşme', 'Bağlantı hatası.');
    } finally {
      setMatchBusyId(null);
    }
  };

  const filterChips = (
    <View style={styles.chipRow}>
      {(['all', 'driver', 'passenger'] as const).map((k) => {
        const active = roleFilter === k;
        const label = k === 'all' ? 'Tümü' : k === 'driver' ? 'Sürücü ilanları' : 'Yolcu ilanları';
        return (
          <TouchableOpacity
            key={k}
            onPress={() => setRoleFilter(k)}
            style={[styles.chip, active && styles.chipOn]}
            activeOpacity={0.88}
          >
            <Text style={[styles.chipText, active && styles.chipTextOn]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return (
    <View style={styles.root}>
      <View style={styles.toolbar}>
        {filterChips}
        <TouchableOpacity
          onPress={() => {
            setModalInitialRole('passenger');
            setCreateOpen(true);
          }}
          activeOpacity={0.9}
          style={styles.newListingBtn}
        >
          <LinearGradient colors={[...PRIMARY_GRAD]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <Ionicons name="add" size={22} color="#fff" style={{ marginRight: 6 }} />
          <Text style={styles.newListingBtnText}>İlan Ver</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.lead}>
          Şehir içi yolcu ve sürücü ilanları — güvenli eşleşme, kabul sonrası sohbet.
        </Text>

        {loadingFeed ? <ActivityIndicator color={PRIMARY_GRAD[0]} style={{ marginVertical: 16 }} /> : null}
        {!loadingFeed && listings.length === 0 ? (
          <Text style={styles.muted}>Bu filtrede ilan yok. İlk ilanı sen verebilirsin.</Text>
        ) : null}

        {listings.map((L) => {
          const own = String(L.created_by_user_id || '').toLowerCase() === String(currentUserId || '').toLowerCase();
          const st = (L.match_request_status || 'none').toLowerCase();
          const rb = roleBadge(L.role_type || undefined);
          const accepted = st === 'accepted' && L.conversation_id;
          const pending = st === 'pending';
          const isDrvCard = rb.tone === 'drv';
          return (
            <View key={L.id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={[styles.rolePill, rb.tone === 'drv' ? styles.rolePillDrv : styles.rolePillPax]}>
                  <Text style={styles.rolePillText}>{rb.label}</Text>
                </View>
                <Text style={styles.statusPill}>{statusLabel(L.status)}</Text>
              </View>
              <Text style={styles.cardName} numberOfLines={1}>
                {L.creator_name || 'Kullanıcı'}
              </Text>
              <Text style={styles.cardRoute} numberOfLines={2}>
                {isDrvCard ? routeLine(L.from_text, L.to_text) : `${(L.from_text || '—').toString().trim()} → ${(L.to_text || '—').toString().trim()}`}
              </Text>
              <Text style={styles.metaLine}>
                🕐 {formatDeparture(L.departure_time)}
                {isDrvCard ? (
                  <>
                    {'  ·  '}👥 {(L as { seats_count?: number }).seats_count != null
                      ? String((L as { seats_count?: number }).seats_count)
                      : '—'}{' '}
                    koltuk
                  </>
                ) : null}
                {'  ·  '}💰{' '}
                {L.price_amount != null && L.price_amount !== undefined
                  ? `${Number(L.price_amount).toLocaleString('tr-TR')} ₺`
                  : '—'}
              </Text>
              {L.note ? (
                <Text style={styles.note} numberOfLines={3}>
                  {L.note}
                </Text>
              ) : null}
              {typeof L.incoming_request_count === 'number' && L.incoming_request_count > 0 && own ? (
                <TouchableOpacity
                  onPress={() => router.push('/muhabbet-match-requests' as Href)}
                  activeOpacity={0.85}
                  style={styles.incomingHintWrap}
                >
                  <Text style={styles.incomingHint}>
                    {L.incoming_request_count} eşleşme isteği — yanıtlamak için dokun
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={ACCENT} />
                </TouchableOpacity>
              ) : null}

              {!own ? (
                accepted && L.conversation_id ? (
                  <GradientButton
                    label="Mesaja Git"
                    variant="secondary"
                    onPress={() =>
                      pushToChat(router, {
                        conversationId: L.conversation_id!,
                        otherUserName: (L.creator_name || 'Kullanıcı').trim(),
                        fromText: String(L.from_text || ''),
                        toText: String(L.to_text || ''),
                        otherUserId: L.created_by_user_id ? String(L.created_by_user_id) : undefined,
                      })
                    }
                    style={{ marginTop: 12 }}
                  />
                ) : pending ? (
                  <View style={styles.sentPill}>
                    <Text style={styles.sentPillText}>İstek gönderildi</Text>
                  </View>
                ) : (
                  <GradientButton
                    label={matchCtaLabel(L.role_type || undefined, viewerAppRole)}
                    loading={matchBusyId === L.id}
                    onPress={() => void sendMatchRequest(L.id)}
                    style={{ marginTop: 12 }}
                  />
                )
              ) : null}
            </View>
          );
        })}

        <Text style={styles.sectionTitle}>Gelen teklifler</Text>
        <Text style={styles.muted}>İlanına gelen eşleşme isteklerini ayrı ekranda yönet.</Text>
        <GradientButton
          label="Gelen teklifleri aç"
          variant="secondary"
          onPress={() => router.push('/muhabbet-match-requests' as Href)}
          style={{ marginTop: 10, marginBottom: 8 }}
        />

        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Giden istekler</Text>
        {loadingOut ? <ActivityIndicator color={PRIMARY_GRAD[0]} style={{ marginVertical: 8 }} /> : null}
        {!loadingOut && outgoing.length === 0 ? <Text style={styles.muted}>Henüz istek yok.</Text> : null}
        {outgoing.map((r) => {
          const st = (r.status || '').toLowerCase();
          const isAcc = st === 'accepted' && r.conversation_id;
          return (
            <View key={r.id} style={styles.card}>
              <Text style={styles.cardName}>{r.receiver_name || 'İlan sahibi'}</Text>
              <Text style={styles.cardRoute}>{routeLine(r.listing?.from_text, r.listing?.to_text)}</Text>
              <Text style={styles.mutedSmall}>{st === 'pending' ? 'Beklemede' : st === 'accepted' ? 'Kabul' : st === 'rejected' ? 'Red' : st}</Text>
              {isAcc ? (
                <GradientButton
                  label="Mesaja Git"
                  variant="secondary"
                  onPress={() => {
                    if (!r.conversation_id) return;
                    pushToChat(router, {
                      conversationId: r.conversation_id,
                      otherUserName: (r.receiver_name || 'Kullanıcı').trim(),
                      fromText: String(r.listing?.from_text || ''),
                      toText: String(r.listing?.to_text || ''),
                      otherUserId: r.receiver_user_id ? String(r.receiver_user_id) : undefined,
                    });
                  }}
                  style={{ marginTop: 10 }}
                />
              ) : null}
            </View>
          );
        })}
        <View style={{ height: 24 }} />
      </ScrollView>

      <CreateListingModal
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        apiUrl={apiUrl}
        accessToken={tok}
        city={selectedCity}
        initialRole={modalInitialRole}
        requireToken={requireToken}
        onCreated={() => void loadAll()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  toolbar: { paddingHorizontal: 16, paddingBottom: 8, gap: 10 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(60,60,67,0.08)',
  },
  chipOn: { backgroundColor: 'rgba(59,130,246,0.2)' },
  chipText: { fontSize: 14, fontWeight: '600', color: TEXT_SECONDARY },
  chipTextOn: { color: '#1D4ED8' },
  newListingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    paddingVertical: 12,
    overflow: 'hidden',
  },
  newListingBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  scroll: { paddingHorizontal: 16, paddingBottom: 24 },
  lead: { color: TEXT_SECONDARY, fontSize: 14, lineHeight: 20, marginBottom: 12 },
  muted: { color: TEXT_SECONDARY, fontSize: 15, marginVertical: 8 },
  mutedSmall: { color: TEXT_SECONDARY, fontSize: 13, marginTop: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: TEXT_PRIMARY, marginTop: 8, marginBottom: 8 },
  card: { backgroundColor: CARD_BG, borderRadius: 18, padding: 14, marginBottom: 12, ...CARD_SHADOW },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  rolePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  rolePillDrv: { backgroundColor: 'rgba(245,158,11,0.2)' },
  rolePillPax: { backgroundColor: 'rgba(59,130,246,0.15)' },
  rolePillText: { fontSize: 12, fontWeight: '800', color: TEXT_PRIMARY },
  statusPill: { fontSize: 12, fontWeight: '600', color: TEXT_SECONDARY },
  cardName: { fontSize: 16, fontWeight: '700', color: TEXT_PRIMARY },
  cardRoute: { marginTop: 4, fontSize: 15, color: TEXT_PRIMARY, lineHeight: 22 },
  metaLine: { marginTop: 6, fontSize: 13, color: TEXT_SECONDARY },
  note: { marginTop: 8, fontSize: 14, color: TEXT_PRIMARY, lineHeight: 20 },
  incomingHintWrap: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 6,
  },
  incomingHint: { flex: 1, fontSize: 13, color: ACCENT, fontWeight: '600' },
  sentPill: {
    marginTop: 12,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(60,60,67,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  sentPillText: { fontWeight: '600', color: TEXT_SECONDARY },
});
