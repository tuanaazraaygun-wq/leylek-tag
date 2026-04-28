/**
 * Leylek Teklif Sende — Teklifler sekmesi: filtre, feed, talep, teklif oluşturma (UI dili).
 *
 * GEÇİCİ (test / Faz 1): seats_count, repeat_type, selected_days, time_window
 * bilgileri ayrı API kolonları yokken `note` metnine gömülür — kalıcı çözüm DEĞİLDİR.
 * Sonraki faz: ride_listings + API + migration ile gerçek kolonlara taşınacak.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
} from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { GradientButton } from './GradientButton';
import { handleUnauthorizedAndMaybeRedirect } from '../lib/muhabbetAuthRedirect';
import CreateListingModal from './CreateListingModal';
import MuhabbetWatermark from './MuhabbetWatermark';

const PRIMARY_GRAD = ['#3B82F6', '#60A5FA'] as const;
const TEXT_PRIMARY = '#111111';
const TEXT_SECONDARY = '#6E6E73';
const CARD_BG = '#FFFFFF';
const CARD_SHADOW = Platform.select({
  ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 },
  android: { elevation: 2 },
  default: {},
});

type ListingsSegment = 'all' | 'driver' | 'passenger' | 'mine' | 'requests';
type ListingScope = 'local' | 'intercity';

export type FeedListing = {
  id: string;
  from_text?: string | null;
  to_text?: string | null;
  created_at?: string | null;
  departure_time?: string | null;
  price_amount?: number | null;
  note?: string | null;
  status?: string | null;
  listing_type?: string | null;
  /** Backend: driver_offer | passenger_offer */
  muhabbet_offer_kind?: string | null;
  role_type?: string | null;
  creator_name?: string | null;
  creator_public_name?: string | null;
  created_by_user_id?: string;
  match_request_status?: string;
  conversation_id?: string | null;
  incoming_request_count?: number;
  transport_label?: string | null;
  vehicle_kind?: string | null;
  expires_at?: string | null;
  muhabbet_offer_expired?: boolean;
  city?: string | null;
  listing_scope?: string | null;
  origin_city?: string | null;
  destination_city?: string | null;
  matched_conversation_id?: string | null;
  accepted_user_id?: string | null;
};

type MatchRequestRow = {
  id: string;
  status?: string | null;
  conversation_id?: string | null;
  sender_user_id?: string | null;
  receiver_user_id?: string | null;
  sender_name?: string | null;
  sender_public_name?: string | null;
  receiver_name?: string | null;
  receiver_public_name?: string | null;
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
  initialCreateScope?: ListingScope;
  requireToken: () => boolean;
  /** Ana sayfadan teklif kartına basılınca bu ilan üste taşınır (nonce her odakta artırılmalı). */
  focusListingId?: string | null;
  focusListingNonce?: number;
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
  if (x === 'active') return 'Açık teklif';
  if (x === 'pending_chat') return 'Sohbet açık';
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

function isDriverListing(role: string | undefined): boolean {
  const r = (role || '').toLowerCase();
  return r === 'driver' || r === 'private_driver';
}

function offerKindFromListing(L: FeedListing): 'driver_offer' | 'passenger_offer' {
  const k = (L.muhabbet_offer_kind || '').toLowerCase();
  if (k === 'driver_offer' || k === 'passenger_offer') return k;
  const lt = (L.listing_type || '').toLowerCase();
  if (lt === 'gidiyorum' || lt === 'ozel_sofor') return 'driver_offer';
  if (lt === 'gidecegim' || lt === 'beni_alsin') return 'passenger_offer';
  return isDriverListing(L.role_type || undefined) ? 'driver_offer' : 'passenger_offer';
}

/** Kullanıcıya “Araba” göster; API alan adları değişmez. */
function listingVehicleKindNorm(L: { vehicle_kind?: string | null }): 'car' | 'motorcycle' {
  const v = (L.vehicle_kind || 'car').toString().toLowerCase();
  return v === 'motorcycle' || v === 'motor' ? 'motorcycle' : 'car';
}

function transportLine(L: FeedListing): string {
  const tl = (L.transport_label || '').trim();
  const vk = (L.vehicle_kind || '').toLowerCase();
  if (vk === 'motor' || vk === 'motorcycle') return 'Motor';
  if (tl) {
    const low = tl.toLowerCase();
    if (low === 'araç' || low === 'arac') return 'Araba';
    return tl.replace(/\bAraç\b/g, 'Araba').replace(/\baraç\b/g, 'Araba');
  }
  return 'Araba';
}

function isIntercityListing(L: FeedListing): boolean {
  return (L.listing_scope || '').toString().toLowerCase() === 'intercity';
}

function intercityCityRoute(L: FeedListing): string {
  const origin = (L.origin_city || L.city || '').toString().trim();
  const destination = (L.destination_city || '').toString().trim();
  return origin && destination ? `${origin} → ${destination}` : '';
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
  initialCreateScope = 'local',
  requireToken,
  focusListingId = null,
  focusListingNonce = 0,
}: ListingsTabProps) {
  const router = useRouter();
  const tok = accessToken.trim();
  const base = apiUrl.replace(/\/$/, '');

  const [segment, setSegment] = useState<ListingsSegment>('all');
  const [loadingFeed, setLoadingFeed] = useState(false);
  const [loadingMine, setLoadingMine] = useState(false);
  const [listings, setListings] = useState<FeedListing[]>([]);
  const [myListings, setMyListings] = useState<FeedListing[]>([]);
  const [loadingOut, setLoadingOut] = useState(false);
  const [outgoing, setOutgoing] = useState<MatchRequestRow[]>([]);
  const [matchBusyId, setMatchBusyId] = useState<string | null>(null);
  /** Sunucu KYC tabanlı; uygulama rolünden bağımsız (feed / ilanlarım yanıtı). */
  const [viewerCanActAsDriver, setViewerCanActAsDriver] = useState(false);
  /** Yolcu ilanı talip CTA: ilan vehicle_kind ile eşleşen efektif sürücü türü (feed/me kök alanı). */
  const [viewerDriverVk, setViewerDriverVk] = useState<'car' | 'motorcycle' | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [modalInitialRole, setModalInitialRole] = useState<'driver' | 'passenger'>(initialCreateRole);
  const [modalInitialScope, setModalInitialScope] = useState<ListingScope>(initialCreateScope);

  const openCreate = useCallback((role: 'driver' | 'passenger', scope: ListingScope) => {
    setModalInitialRole(role);
    setModalInitialScope(scope);
    setCreateOpen(true);
  }, []);

  const prevOpenSig = React.useRef(openCreateSignal);
  useEffect(() => {
    if (openCreateSignal !== prevOpenSig.current && openCreateSignal > 0) {
      setModalInitialRole(initialCreateRole);
      setModalInitialScope(initialCreateScope);
      setCreateOpen(true);
      prevOpenSig.current = openCreateSignal;
    }
  }, [openCreateSignal, initialCreateRole, initialCreateScope]);

  const loadFeed = useCallback(async () => {
    if (!tok) {
      console.log('[muhabbet] preserving rows during reconnect');
      return;
    }
    if (segment === 'mine') {
      setListings([]);
      setLoadingFeed(false);
      return;
    }
    const cityQ = (selectedCity || '').trim();
    if (!cityQ) {
      setListings([]);
      return;
    }
    setLoadingFeed(true);
    try {
      const localQ = new URLSearchParams({ city: cityQ, limit: '40', listing_scope: 'local' });
      const intercityQ = new URLSearchParams({ city: cityQ, limit: '40', listing_scope: 'intercity' });
      if (segment === 'driver') {
        localQ.set('role_type', 'driver');
        intercityQ.set('role_type', 'driver');
      } else if (segment === 'passenger') {
        localQ.set('role_type', 'passenger');
        intercityQ.set('role_type', 'passenger');
      }
      const [res, intercityRes] = await Promise.all([
        fetch(`${base}/muhabbet/listings/feed?${localQ.toString()}`, {
          headers: authHeader(tok),
        }),
        fetch(`${base}/muhabbet/listings/feed?${intercityQ.toString()}`, {
          headers: authHeader(tok),
        }),
      ]);
      if (res.status === 401) {
        console.log('[muhabbet] preserving rows during reconnect');
        return;
      }
      type FeedResponse = {
        success?: boolean;
        listings?: FeedListing[];
        viewer_can_act_as_driver?: boolean;
        viewer_driver_vehicle_kind?: string | null;
      };
      const d = (await res.json().catch(() => ({}))) as FeedResponse;
      const di = intercityRes.ok ? ((await intercityRes.json().catch(() => ({}))) as FeedResponse) : {};
      if (typeof d.viewer_can_act_as_driver === 'boolean') setViewerCanActAsDriver(d.viewer_can_act_as_driver);
      else if (typeof di.viewer_can_act_as_driver === 'boolean') setViewerCanActAsDriver(di.viewer_can_act_as_driver);
      const vkFeed = (d.viewer_driver_vehicle_kind || di.viewer_driver_vehicle_kind || '').toString().toLowerCase();
      setViewerDriverVk(vkFeed === 'motorcycle' ? 'motorcycle' : vkFeed === 'car' ? 'car' : null);
      if (res.ok && d.success && Array.isArray(d.listings)) {
        const seen = new Set<string>();
        const merged = [...d.listings, ...(di.success && Array.isArray(di.listings) ? di.listings : [])]
          .filter((row) => {
            if (!row?.id || seen.has(row.id)) return false;
            seen.add(row.id);
            return true;
          })
          .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
        const openOnly = merged.filter((row) => {
          const st = (row.status || '').toLowerCase();
          if (st === 'matched' || st === 'closed' || st === 'cancelled' || st === 'pending_chat') return false;
          const m = (row.match_request_status || '').toLowerCase();
          if (m === 'accepted' && row.conversation_id) return false;
          return true;
        });
        setListings(openOnly);
      } else {
        console.log('[muhabbet] preserving rows during reconnect');
      }
    } catch {
      console.log('[muhabbet] preserving rows during reconnect');
    } finally {
      setLoadingFeed(false);
    }
  }, [base, selectedCity, tok, segment]);

  const loadMyListings = useCallback(async () => {
    if (!tok) {
      console.log('[muhabbet] preserving rows during reconnect');
      return;
    }
    setLoadingMine(true);
    try {
      const u = new URLSearchParams({ limit: '100' });
      const res = await fetch(`${base}/muhabbet/listings/me?${u.toString()}`, {
        headers: authHeader(tok),
      });
      if (res.status === 401) {
        console.log('[muhabbet] preserving rows during reconnect');
        return;
      }
      const d = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        listings?: FeedListing[];
        viewer_can_act_as_driver?: boolean;
        viewer_driver_vehicle_kind?: string | null;
      };
      if (typeof d.viewer_can_act_as_driver === 'boolean') setViewerCanActAsDriver(d.viewer_can_act_as_driver);
      const vk2 = (d.viewer_driver_vehicle_kind || '').toString().toLowerCase();
      setViewerDriverVk(vk2 === 'motorcycle' ? 'motorcycle' : vk2 === 'car' ? 'car' : null);
      if (res.ok && d.success && Array.isArray(d.listings)) {
        const cityKey = (selectedCity || '').trim().toLowerCase();
        const rows = cityKey
          ? d.listings.filter((r) => {
              const scope = String(r.listing_scope || 'local').trim().toLowerCase();
              if (scope === 'intercity') {
                return (
                  String(r.origin_city || '').trim().toLowerCase() === cityKey ||
                  String(r.destination_city || '').trim().toLowerCase() === cityKey ||
                  String(r.city || '').trim().toLowerCase() === cityKey
                );
              }
              return String(r.city || '').trim().toLowerCase() === cityKey;
            })
          : d.listings;
        setMyListings(rows);
      } else {
        console.log('[muhabbet] preserving rows during reconnect');
      }
    } catch {
      console.log('[muhabbet] preserving rows during reconnect');
    } finally {
      setLoadingMine(false);
    }
  }, [base, tok, selectedCity]);

  const loadOutgoing = useCallback(async () => {
    if (!tok) {
      console.log('[muhabbet] preserving rows during reconnect');
      return;
    }
    setLoadingOut(true);
    try {
      const u = new URLSearchParams({ status: 'all', limit: '50' });
      const res = await fetch(`${base}/muhabbet/match-requests/outgoing?${u.toString()}`, {
        headers: authHeader(tok),
      });
      if (res.status === 401) {
        console.log('[muhabbet] preserving rows during reconnect');
        return;
      }
      const d = (await res.json().catch(() => ({}))) as { success?: boolean; requests?: MatchRequestRow[] };
      if (res.ok && d.success && Array.isArray(d.requests)) setOutgoing(d.requests);
      else console.log('[muhabbet] preserving rows during reconnect');
    } catch {
      console.log('[muhabbet] preserving rows during reconnect');
    } finally {
      setLoadingOut(false);
    }
  }, [base, tok]);

  const loadAll = useCallback(async () => {
    if (segment === 'mine') {
      await Promise.all([loadMyListings(), loadOutgoing()]);
    } else {
      await Promise.all([loadFeed(), loadOutgoing()]);
    }
  }, [loadFeed, loadMyListings, loadOutgoing, segment]);

  useEffect(() => {
    if (tok) void loadAll();
  }, [tok, loadAll, selectedCity, syncVersion]);

  const primaryListings = segment === 'mine' ? myListings : listings;

  const orderedListings = useMemo(() => {
    const fid = (focusListingId || '').trim();
    if (!fid) return primaryListings;
    const i = primaryListings.findIndex((x) => x.id === fid);
    if (i <= 0) return primaryListings;
    const copy = [...primaryListings];
    const [head] = copy.splice(i, 1);
    return [head, ...copy];
  }, [primaryListings, focusListingId]);

  const [focusHighlightId, setFocusHighlightId] = useState<string | null>(null);
  useEffect(() => {
    const fid = (focusListingId || '').trim();
    if (!fid || !focusListingNonce) return;
    setFocusHighlightId(fid);
    const t = setTimeout(() => setFocusHighlightId(null), 4500);
    return () => clearTimeout(t);
  }, [focusListingId, focusListingNonce]);

  const sendMatchRequest = async (listingId: string, actorIntent: 'driver' | 'passenger') => {
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
        body: JSON.stringify({ message: null, actor_intent: actorIntent }),
      });
      if (handleUnauthorizedAndMaybeRedirect(res)) {
        setListings(snapshot);
        return;
      }
      const d = (await res.json().catch(() => ({}))) as { success?: boolean; detail?: string };
      if (!res.ok || !d.success) {
        setListings(snapshot);
        Alert.alert('Talep', typeof d.detail === 'string' && d.detail ? d.detail : 'Talep gönderilemedi.');
        return;
      }
      void loadFeed();
      void loadMyListings();
      void loadOutgoing();
    } catch {
      setListings(snapshot);
      Alert.alert('Talep', 'Bağlantı hatası.');
    } finally {
      setMatchBusyId(null);
    }
  };

  const SEGMENTS: { key: ListingsSegment; label: string }[] = [
    { key: 'all', label: 'Tümü' },
    { key: 'driver', label: 'Sürücü teklifleri' },
    { key: 'passenger', label: 'Yolcu teklifleri' },
    { key: 'mine', label: 'Açtığım teklifler' },
    { key: 'requests', label: 'Teklif talepleri' },
  ];

  const filteredListings = useMemo(() => {
    if (segment === 'requests') return [];
    if (segment === 'mine') return orderedListings;
    return orderedListings.filter((L) => {
      if (segment === 'driver') return offerKindFromListing(L) === 'driver_offer';
      if (segment === 'passenger') return offerKindFromListing(L) === 'passenger_offer';
      return true;
    });
  }, [orderedListings, segment]);

  const listingLifecycleAction = useCallback(
    async (listingId: string, action: 'continue' | 'close') => {
      if (!requireToken() || !tok) return;
      try {
        const res = await fetch(`${base}/muhabbet/listings/${encodeURIComponent(listingId)}/lifecycle`, {
          method: 'POST',
          headers: { ...authHeader(tok), 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
        });
        const d = (await res.json().catch(() => ({}))) as { success?: boolean; detail?: string };
        if (handleUnauthorizedAndMaybeRedirect(res) || !res.ok || !d.success) {
          Alert.alert('İlan', typeof d.detail === 'string' && d.detail ? d.detail : 'İşlem yapılamadı.');
          return;
        }
        void loadMyListings();
        if (segment !== 'mine') void loadFeed();
      } catch {
        Alert.alert('İlan', 'Bağlantı hatası.');
      }
    },
    [base, tok, requireToken, loadMyListings, loadFeed, segment]
  );

  const segmentScroll = (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.segmentScroll}>
      {SEGMENTS.map(({ key, label }) => {
        const active = segment === key;
        return (
          <Pressable
            key={key}
            onPress={() => setSegment(key)}
            style={({ pressed }) => [
              styles.segmentChip,
              active && key === 'driver' && styles.segmentChipDrvOn,
              active && key === 'passenger' && styles.segmentChipPaxOn,
              active && key === 'all' && styles.segmentChipAllOn,
              active && key === 'mine' && styles.segmentChipMineOn,
              active && key === 'requests' && styles.segmentChipReqOn,
              !active && pressed && { opacity: 0.88 },
            ]}
          >
            <Text
              style={[
                styles.segmentChipText,
                active &&
                  (key === 'passenger' || key === 'requests'
                    ? styles.segmentChipTextPaxOn
                    : styles.segmentChipTextOn),
              ]}
              numberOfLines={1}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );

  const requestsBody = (
    <>
      <Text style={styles.requestsLead}>Gönderdiğin talepler ve gelen yanıtlar. Gelen talepleri yönetmek için aşağıdaki düğmeye dokun.</Text>
      <TouchableOpacity style={styles.incomingHero} onPress={() => router.push('/muhabbet-match-requests' as Href)} activeOpacity={0.9}>
        <LinearGradient colors={[...PRIMARY_GRAD]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <Ionicons name="mail-unread-outline" size={26} color="#fff" style={{ marginRight: 10 }} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.incomingHeroTitle}>Gelen talepler</Text>
          <Text style={styles.incomingHeroSub}>Tekliflerine gelen talipleri gör ve yanıtla</Text>
        </View>
        <Ionicons name="chevron-forward" size={22} color="rgba(255,255,255,0.9)" />
      </TouchableOpacity>

      <Text style={[styles.sectionTitle, { marginTop: 22 }]}>Giden talepler</Text>
      {loadingOut ? <ActivityIndicator color={PRIMARY_GRAD[0]} style={{ marginVertical: 12 }} /> : null}
      {!loadingOut && outgoing.length === 0 ? <Text style={styles.muted}>Henüz talep yok.</Text> : null}
      {outgoing.map((r) => {
        const st = (r.status || '').toLowerCase();
        const isAcc = st === 'accepted' && r.conversation_id;
        return (
          <View key={r.id} style={[styles.card, styles.cardNeutral]}>
            <Text style={styles.cardNameLg}>{r.receiver_name || 'Teklif sahibi'}</Text>
            <View style={styles.routeBlock}>
              <Text style={styles.routeMiniLabel}>Güzergâh</Text>
              <Text style={styles.cardRouteLg}>{routeLine(r.listing?.from_text, r.listing?.to_text)}</Text>
            </View>
            <Text style={styles.mutedSmall}>{st === 'pending' ? 'Beklemede' : st === 'accepted' ? 'Kabul' : st === 'rejected' ? 'Red' : st}</Text>
            {isAcc ? (
              <GradientButton
                label="Mesaja Git"
                variant="secondary"
                onPress={() => {
                  if (!r.conversation_id) return;
                  pushToChat(router, {
                    conversationId: r.conversation_id,
                    otherUserName: (r.receiver_public_name || r.receiver_name || 'Leylek kullanıcısı').trim(),
                    fromText: String(r.listing?.from_text || ''),
                    toText: String(r.listing?.to_text || ''),
                    otherUserId: r.receiver_user_id ? String(r.receiver_user_id) : undefined,
                  });
                }}
                style={{ marginTop: 12 }}
              />
            ) : null}
          </View>
        );
      })}
    </>
  );

  const listLoading = segment === 'mine' ? loadingMine : loadingFeed;

  const feedBody = (
    <>
      {listLoading ? <ActivityIndicator color={PRIMARY_GRAD[0]} style={{ marginVertical: 16 }} /> : null}
      {!listLoading && filteredListings.length === 0 ? (
        <Text style={styles.muted}>Bu görünümde teklif yok.</Text>
      ) : null}

      {filteredListings.map((L) => {
        const own = String(L.created_by_user_id || '').toLowerCase() === String(currentUserId || '').toLowerCase();
        const st = (L.match_request_status || 'none').toLowerCase();
        const isDrvCard = offerKindFromListing(L) === 'driver_offer';
        const rb = isDrvCard ? roleBadge('driver') : roleBadge('passenger');
        const accepted = st === 'accepted' && L.conversation_id;
        const pending = st === 'pending';
        const focused = focusHighlightId === L.id;
        const priceStr =
          L.price_amount != null && L.price_amount !== undefined
            ? `${Number(L.price_amount).toLocaleString('tr-TR')} ₺`
            : '—';
        const passengerOffer = offerKindFromListing(L) === 'passenger_offer';
        const listVk = listingVehicleKindNorm(L);
        const effViewerVk = viewerDriverVk ?? (viewerCanActAsDriver ? 'car' : null);
        const vehicleOk =
          !passengerOffer || !viewerCanActAsDriver || effViewerVk === null || listVk === effViewerVk;
        const intercity = isIntercityListing(L);
        const cityRoute = intercityCityRoute(L);
        const canRequest =
          !own && (passengerOffer ? viewerCanActAsDriver && vehicleOk : true) && !accepted && !pending;
        return (
          <View
            key={L.id}
            style={[
              styles.card,
              isDrvCard ? styles.cardThemeDriver : styles.cardThemePassenger,
              focused && styles.cardFocused,
            ]}
          >
            <View style={styles.cardTop}>
              <View style={[styles.rolePill, rb.tone === 'drv' ? styles.rolePillDrv : styles.rolePillPax]}>
                <Text style={styles.rolePillText}>{rb.label}</Text>
              </View>
              <View style={styles.transportPill}>
                <Text style={styles.transportPillText}>{transportLine(L)}</Text>
              </View>
              {intercity ? (
                <View style={styles.scopeBadge}>
                  <Text style={styles.scopeBadgeText}>Şehirler arası</Text>
                </View>
              ) : null}
              <Text style={styles.statusPill}>{statusLabel(L.status)}</Text>
            </View>
            {segment === 'mine' ? (
              <View style={styles.mineBadgeRow}>
                {String(L.status || '').toLowerCase() === 'active' && L.muhabbet_offer_expired ? (
                  <Text style={styles.badgeExpired}>Süresi doldu</Text>
                ) : null}
                {String(L.status || '').toLowerCase() === 'pending_chat' ? (
                  <Text style={styles.badgeInfo}>Talip kabul edildi — sohbet</Text>
                ) : null}
                {String(L.status || '').toLowerCase() === 'matched' ? (
                  <Text style={styles.badgeMatched}>Leylek eşleşmesi tamam</Text>
                ) : null}
              </View>
            ) : null}
            <Text style={styles.cardNameLg} numberOfLines={1}>
              {L.creator_public_name || L.creator_name || 'Leylek kullanıcısı'}
            </Text>
            {cityRoute ? (
              <View style={styles.cityRouteBanner}>
                <Ionicons name="map-outline" size={14} color="#0369A1" />
                <Text style={styles.cityRouteText} numberOfLines={1}>{cityRoute}</Text>
              </View>
            ) : null}
            <View style={styles.routeBlock}>
              <View style={styles.routeEnd}>
                <Text style={styles.routeMiniLabel}>Nereden</Text>
                <Text style={styles.routeValue} numberOfLines={2}>
                  {(L.from_text || '—').toString().trim()}
                </Text>
              </View>
              <Ionicons name="arrow-forward" size={18} color="#9CA3AF" style={{ marginTop: 18 }} />
              <View style={styles.routeEnd}>
                <Text style={styles.routeMiniLabel}>Nereye</Text>
                <Text style={styles.routeValue} numberOfLines={2}>
                  {(L.to_text || '—').toString().trim()}
                </Text>
              </View>
            </View>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Ücret</Text>
              <Text style={styles.priceValue}>{priceStr}</Text>
            </View>
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
            </Text>
            {isDrvCard ? (
              <Text style={styles.vehicleKindLine}>
                Araç: {listingVehicleKindNorm(L) === 'motorcycle' ? 'Motor' : 'Araba'}
              </Text>
            ) : null}
            {L.note ? (
              <Text style={styles.note} numberOfLines={2}>
                {L.note}
              </Text>
            ) : null}
            {typeof L.incoming_request_count === 'number' && L.incoming_request_count > 0 && own ? (
              <TouchableOpacity
                onPress={() => router.push('/muhabbet-match-requests' as Href)}
                activeOpacity={0.88}
                style={styles.incomingHintWrap}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.incomingCountBadge}>
                    {L.incoming_request_count} talep
                  </Text>
                  <Text style={styles.incomingHint}>Yanıtlamak için dokun — gelen talepler ekranına git</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#C2410C" />
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
                      otherUserName: (L.creator_public_name || L.creator_name || 'Leylek kullanıcısı').trim(),
                      fromText: String(L.from_text || ''),
                      toText: String(L.to_text || ''),
                      otherUserId: L.created_by_user_id ? String(L.created_by_user_id) : undefined,
                    })
                  }
                  style={{ marginTop: 12 }}
                />
              ) : pending ? (
                <View style={styles.sentPill}>
                  <Text style={styles.sentPillText}>Talep gönderildi</Text>
                </View>
              ) : (
                <GradientButton
                  label={
                    isDrvCard
                      ? viewerCanActAsDriver
                        ? 'Yolcu olarak beni de al'
                        : 'Beni de al'
                      : 'Bu yolcuya talibim'
                  }
                  loading={matchBusyId === L.id}
                  onPress={() => void sendMatchRequest(L.id, isDrvCard ? 'passenger' : 'driver')}
                  disabled={!canRequest}
                  style={{ marginTop: 12, opacity: canRequest ? 1 : 0.5 }}
                />
              )
            ) : null}
            {!own && !accepted && !pending && !canRequest ? (
              <Text style={styles.roleHint}>
                {passengerOffer && viewerCanActAsDriver && !vehicleOk
                  ? 'Bu yolcu ilanı farklı araç türü (araba/motor) talep ediyor; profilinizdeki araç türüyle eşleşmiyor.'
                  : passengerOffer
                    ? 'Bu ilana talip olmak için sürücü hesabı (onaylı sürücü doğrulaması) gerekir.'
                    : null}
              </Text>
            ) : null}
            {own &&
            segment === 'mine' &&
            String(L.status || '').toLowerCase() === 'pending_chat' &&
            L.matched_conversation_id ? (
              <GradientButton
                label="Mesaja Git"
                variant="secondary"
                onPress={() =>
                  pushToChat(router, {
                    conversationId: String(L.matched_conversation_id),
                    otherUserName: 'Leylek kullanıcısı',
                    fromText: String(L.from_text || ''),
                    toText: String(L.to_text || ''),
                    otherUserId: L.accepted_user_id ? String(L.accepted_user_id) : undefined,
                  })
                }
                style={{ marginTop: 12 }}
              />
            ) : null}
            {segment === 'mine' &&
            String(L.status || '').toLowerCase() === 'active' &&
            L.muhabbet_offer_expired ? (
              <View style={styles.lifecyclePrompt}>
                <Text style={styles.lifecyclePromptTitle}>Teklifiniz hâlâ geçerli mi?</Text>
                <Text style={styles.lifecyclePromptSub}>Devam ederseniz ilan 60 dakika daha listede kalır.</Text>
                <View style={styles.lifecycleRow}>
                  <TouchableOpacity
                    style={styles.lifecycleBtnPri}
                    onPress={() => void listingLifecycleAction(L.id, 'continue')}
                    activeOpacity={0.88}
                  >
                    <Text style={styles.lifecycleBtnPriTxt}>Devam et</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.lifecycleBtnSec}
                    onPress={() => void listingLifecycleAction(L.id, 'close')}
                    activeOpacity={0.88}
                  >
                    <Text style={styles.lifecycleBtnSecTxt}>Kapat</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}
          </View>
        );
      })}
    </>
  );

  return (
    <View style={styles.root}>
      <MuhabbetWatermark />
      <View style={styles.toolbar}>
        <TouchableOpacity
          onPress={() => {
            openCreate('passenger', 'local');
          }}
          activeOpacity={0.9}
          style={styles.newListingBtnHero}
        >
          <LinearGradient colors={['#FFF7ED', '#FED7AA']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <View style={styles.newListingIconBubble}>
            <Ionicons name="add" size={18} color="#FFFFFF" />
          </View>
          <Text style={styles.newListingBtnHeroText}>Teklif aç</Text>
        </TouchableOpacity>
        <View style={styles.createChoiceRow}>
          <TouchableOpacity
            style={[styles.createChoiceChip, styles.createChoiceLocal]}
            activeOpacity={0.88}
            onPress={() => openCreate('passenger', 'local')}
          >
            <Ionicons name="navigate-outline" size={15} color="#1D4ED8" />
            <Text style={styles.createChoiceTextLocal}>Şehir içi teklif aç</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.createChoiceChip, styles.createChoiceIntercity]}
            activeOpacity={0.88}
            onPress={() => openCreate('passenger', 'intercity')}
          >
            <Ionicons name="map-outline" size={15} color="#C2410C" />
            <Text style={styles.createChoiceTextIntercity}>Şehirler arası teklif aç</Text>
          </TouchableOpacity>
        </View>
        {segmentScroll}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {segment === 'requests' ? requestsBody : feedBody}
        <View style={{ height: 24 }} />
      </ScrollView>

      <CreateListingModal
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        apiUrl={apiUrl}
        accessToken={tok}
        city={selectedCity}
        initialRole={modalInitialRole}
        initialScope={modalInitialScope}
        requireToken={requireToken}
        onCreated={() => void loadAll()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, position: 'relative' },
  toolbar: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 10, gap: 10, zIndex: 1 },
  segmentScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
    paddingRight: 8,
  },
  segmentChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(60,60,67,0.07)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  segmentChipAllOn: {
    backgroundColor: 'rgba(59,130,246,0.14)',
    borderColor: 'rgba(59,130,246,0.35)',
  },
  segmentChipDrvOn: {
    backgroundColor: 'rgba(59,130,246,0.18)',
    borderColor: 'rgba(37,99,235,0.45)',
  },
  segmentChipPaxOn: {
    backgroundColor: 'rgba(245,158,11,0.2)',
    borderColor: 'rgba(234,88,12,0.45)',
  },
  segmentChipMineOn: {
    backgroundColor: 'rgba(59,130,246,0.12)',
    borderColor: 'rgba(59,130,246,0.3)',
  },
  segmentChipReqOn: {
    backgroundColor: 'rgba(245,158,11,0.14)',
    borderColor: 'rgba(245,158,11,0.4)',
  },
  segmentChipText: { fontSize: 13, fontWeight: '700', color: TEXT_SECONDARY },
  segmentChipTextOn: { color: '#1D4ED8' },
  segmentChipTextPaxOn: { color: '#C2410C' },
  newListingBtnHero: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    paddingVertical: 13,
    minHeight: 50,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.35)',
    ...CARD_SHADOW,
  },
  newListingIconBubble: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F97316',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  newListingBtnHeroText: { color: '#C2410C', fontWeight: '900', fontSize: 18, letterSpacing: 0.2 },
  createChoiceRow: { flexDirection: 'row', gap: 8 },
  createChoiceChip: {
    flex: 1,
    minHeight: 42,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderWidth: StyleSheet.hairlineWidth,
  },
  createChoiceLocal: {
    backgroundColor: 'rgba(59,130,246,0.1)',
    borderColor: 'rgba(59,130,246,0.28)',
  },
  createChoiceIntercity: {
    backgroundColor: 'rgba(249,115,22,0.12)',
    borderColor: 'rgba(249,115,22,0.28)',
  },
  createChoiceTextLocal: { color: '#1D4ED8', fontSize: 12.5, fontWeight: '900' },
  createChoiceTextIntercity: { color: '#C2410C', fontSize: 12.5, fontWeight: '900' },
  scroll: { paddingHorizontal: 16, paddingBottom: 24, zIndex: 1 },
  requestsLead: { fontSize: 15, color: TEXT_SECONDARY, lineHeight: 22, marginBottom: 12 },
  incomingHero: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    overflow: 'hidden',
    minHeight: 72,
    ...CARD_SHADOW,
  },
  incomingHeroTitle: { color: '#fff', fontSize: 17, fontWeight: '800' },
  incomingHeroSub: { color: 'rgba(255,255,255,0.92)', fontSize: 13, marginTop: 4, lineHeight: 18 },
  muted: { color: TEXT_SECONDARY, fontSize: 16, marginVertical: 10, lineHeight: 23 },
  mutedSmall: { color: TEXT_SECONDARY, fontSize: 14, marginTop: 6 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: TEXT_PRIMARY, marginTop: 6, marginBottom: 8 },
  card: { backgroundColor: CARD_BG, borderRadius: 14, padding: 11, marginBottom: 9, ...CARD_SHADOW },
  cardNeutral: { borderLeftWidth: 4, borderLeftColor: '#94A3B8' },
  cardThemeDriver: { borderLeftWidth: 5, borderLeftColor: '#2563EB' },
  cardThemePassenger: { borderLeftWidth: 5, borderLeftColor: '#EA580C' },
  cardTop: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', alignItems: 'center', gap: 6, marginBottom: 6 },
  transportPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(22, 163, 74, 0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(22, 163, 74, 0.35)',
  },
  transportPillText: { fontSize: 11, fontWeight: '800', color: '#15803D' },
  scopeBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(14,165,233,0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(14,165,233,0.34)',
  },
  scopeBadgeText: { fontSize: 11, fontWeight: '900', color: '#0369A1' },
  cardFocused: {
    borderWidth: 2,
    borderColor: '#2563EB',
  },
  rolePill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10 },
  rolePillDrv: { backgroundColor: 'rgba(59,130,246,0.22)' },
  rolePillPax: { backgroundColor: 'rgba(245,158,11,0.24)' },
  rolePillText: { fontSize: 12, fontWeight: '800', color: TEXT_PRIMARY },
  statusPill: { fontSize: 12, fontWeight: '700', color: TEXT_SECONDARY, marginLeft: 'auto' },
  cardNameLg: { fontSize: 15, fontWeight: '800', color: TEXT_PRIMARY, marginBottom: 6 },
  cityRouteBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 7,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: 'rgba(14,165,233,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(14,165,233,0.22)',
  },
  cityRouteText: { flex: 1, minWidth: 0, fontSize: 13, fontWeight: '900', color: '#0F172A' },
  routeBlock: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, marginBottom: 8 },
  routeEnd: { flex: 1, minWidth: 0 },
  routeMiniLabel: { fontSize: 11, fontWeight: '800', color: TEXT_SECONDARY, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.3 },
  routeValue: { fontSize: 14, fontWeight: '700', color: TEXT_PRIMARY, lineHeight: 19 },
  cardRouteLg: { fontSize: 16, fontWeight: '700', color: TEXT_PRIMARY, lineHeight: 22 },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(60,60,67,0.06)',
  },
  priceLabel: { fontSize: 13, fontWeight: '700', color: TEXT_SECONDARY },
  priceValue: { fontSize: 18, fontWeight: '800', color: TEXT_PRIMARY },
  metaLine: { marginTop: 1, fontSize: 13, color: TEXT_SECONDARY, lineHeight: 18 },
  vehicleKindLine: { marginTop: 3, fontSize: 12, fontWeight: '700', color: '#1E40AF' },
  note: { marginTop: 4, fontSize: 12, color: TEXT_SECONDARY, lineHeight: 17 },
  incomingHintWrap: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(245,158,11,0.14)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(234,88,12,0.25)',
  },
  incomingCountBadge: { fontSize: 15, fontWeight: '800', color: '#C2410C' },
  incomingHint: { fontSize: 13, color: TEXT_PRIMARY, fontWeight: '600', marginTop: 3, lineHeight: 18 },
  roleHint: { marginTop: 8, fontSize: 13, color: TEXT_SECONDARY, lineHeight: 19 },
  sentPill: {
    marginTop: 12,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(60,60,67,0.1)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  sentPillText: { fontWeight: '700', fontSize: 15, color: TEXT_SECONDARY },
  mineBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  badgeExpired: {
    fontSize: 12,
    fontWeight: '800',
    color: '#B91C1C',
    backgroundColor: 'rgba(220,38,38,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeInfo: {
    fontSize: 12,
    fontWeight: '800',
    color: '#92400E',
    backgroundColor: 'rgba(245,158,11,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeMatched: {
    fontSize: 12,
    fontWeight: '800',
    color: '#14532D',
    backgroundColor: 'rgba(22,163,74,0.16)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  lifecyclePrompt: {
    marginTop: 9,
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(59,130,246,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(59,130,246,0.25)',
  },
  lifecyclePromptTitle: { fontSize: 14, fontWeight: '800', color: TEXT_PRIMARY },
  lifecyclePromptSub: { fontSize: 12, color: TEXT_SECONDARY, marginTop: 4, lineHeight: 17 },
  lifecycleRow: { flexDirection: 'row', gap: 8, marginTop: 9 },
  lifecycleBtnPri: {
    flex: 1,
    backgroundColor: PRIMARY_GRAD[0],
    paddingVertical: 9,
    borderRadius: 12,
    alignItems: 'center',
  },
  lifecycleBtnPriTxt: { color: '#fff', fontWeight: '800', fontSize: 14 },
  lifecycleBtnSec: {
    flex: 1,
    backgroundColor: 'rgba(60,60,67,0.1)',
    paddingVertical: 9,
    borderRadius: 12,
    alignItems: 'center',
  },
  lifecycleBtnSecTxt: { color: TEXT_PRIMARY, fontWeight: '700', fontSize: 14 },
});
