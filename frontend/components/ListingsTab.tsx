/**
 * Leylek Teklif Sende — Teklifler sekmesi: filtre, feed, talep, teklif oluşturma (UI dili).
 *
 * GEÇİCİ (test / Faz 1): seats_count, repeat_type, selected_days, time_window
 * bilgileri ayrı API kolonları yokken `note` metnine gömülür — kalıcı çözüm DEĞİLDİR.
 * Sonraki faz: ride_listings + API + migration ile gerçek kolonlara taşınacak.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
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
import { formatMuhabbetRouteLabel } from '../lib/formatMuhabbetRouteLabel';

const PRIMARY_GRAD = ['#3B82F6', '#60A5FA'] as const;
const TEXT_PRIMARY = '#111111';
const TEXT_SECONDARY = '#6E6E73';
const CARD_BG = '#FFFFFF';
const CARD_SHADOW = Platform.select({
  ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 },
  android: { elevation: 2 },
  default: {},
});

/** Teklifler üst sekmeler */
type PrimarySegment = 'incoming' | 'open';
/** Açık teklifler alt filtresi */
type FeedFilter = 'all' | 'driver' | 'passenger' | 'mine';
type ListingScope = 'local' | 'intercity';

/** Gelen talep satırı — muhabbet match-requests/incoming */
type IncomingOfferRequest = {
  id: string;
  sender_user_id?: string | null;
  sender_name?: string | null;
  sender_user_name?: string | null;
  listing?: {
    from_text?: string | null;
    to_text?: string | null;
    listing_scope?: string | null;
    origin_city?: string | null;
    destination_city?: string | null;
    city?: string | null;
  } | null;
  created_at?: string | null;
};

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
  listing?: {
    from_text?: string | null;
    to_text?: string | null;
    listing_scope?: string | null;
    origin_city?: string | null;
    destination_city?: string | null;
    city?: string | null;
  } | null;
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

function matchRequestUiStatus(st: string | null | undefined): { label: string; tone: 'ok' | 'wait' | 'bad' } {
  const x = (st || '').toLowerCase();
  if (x === 'accepted') return { label: 'Kabul', tone: 'ok' };
  if (x === 'pending') return { label: 'Bekliyor', tone: 'wait' };
  if (x === 'rejected') return { label: 'Reddedildi', tone: 'bad' };
  return { label: st ? String(st) : '—', tone: 'wait' };
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

/** İlanın feed süresi (expires_at) şu an gelecekte mi — ISO string parse. */
function listingExpiresAtAfterNow(L: { expires_at?: string | null }): boolean {
  const raw = L.expires_at;
  if (!raw || String(raw).trim() === '') return false;
  try {
    const t = new Date(String(raw)).getTime();
    if (Number.isNaN(t)) return false;
    return t > Date.now();
  } catch {
    return false;
  }
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

export default function ListingsTab({
  apiUrl,
  accessToken,
  selectedCity,
  currentUserId,
  viewerAppRole: _viewerAppRole,
  syncVersion,
  openCreateSignal,
  initialCreateRole = 'passenger',
  initialCreateScope = 'intercity',
  requireToken,
  focusListingId = null,
  focusListingNonce = 0,
}: ListingsTabProps) {
  const router = useRouter();
  const tok = accessToken.trim();
  const base = apiUrl.replace(/\/$/, '');

  const [primarySegment, setPrimarySegment] = useState<PrimarySegment>('incoming');
  const [feedFilter, setFeedFilter] = useState<FeedFilter>('all');
  const [loadingFeed, setLoadingFeed] = useState(false);
  const [loadingMine, setLoadingMine] = useState(false);
  const [loadingIncoming, setLoadingIncoming] = useState(false);
  const [listings, setListings] = useState<FeedListing[]>([]);
  const [myListings, setMyListings] = useState<FeedListing[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<IncomingOfferRequest[]>([]);
  const [loadingOut, setLoadingOut] = useState(false);
  const [outgoing, setOutgoing] = useState<MatchRequestRow[]>([]);
  const [incomingBusyId, setIncomingBusyId] = useState<string | null>(null);
  const [incomingBusyAction, setIncomingBusyAction] = useState<'accept' | 'reject' | null>(null);
  const [matchBusyId, setMatchBusyId] = useState<string | null>(null);
  /** Sunucu KYC tabanlı; uygulama rolünden bağımsız (feed / ilanlarım yanıtı). */
  const [viewerCanActAsDriver, setViewerCanActAsDriver] = useState(false);
  /** Yolcu ilanı talip CTA: ilan vehicle_kind ile eşleşen efektif sürücü türü (feed/me kök alanı). */
  const [viewerDriverVk, setViewerDriverVk] = useState<'car' | 'motorcycle' | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [filterPickerVisible, setFilterPickerVisible] = useState(false);
  /** Sadece UI — hangi talep listelerinin gösterileceği (API yok). */
  const [incomingListFilter, setIncomingListFilter] = useState<'all' | 'incoming_only' | 'outgoing_only'>('all');
  const [modalInitialRole, setModalInitialRole] = useState<'driver' | 'passenger'>(initialCreateRole);
  const [modalInitialScope, setModalInitialScope] = useState<ListingScope>(initialCreateScope);

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
    const cityQ = (selectedCity || '').trim();
    if (!cityQ) {
      setListings([]);
      return;
    }
    setLoadingFeed(true);
    try {
      const intercityQ = new URLSearchParams({ city: cityQ, limit: '40', listing_scope: 'intercity' });
      if (feedFilter === 'driver') {
        intercityQ.set('role_type', 'driver');
      } else if (feedFilter === 'passenger') {
        intercityQ.set('role_type', 'passenger');
      }
      const intercityRes = await fetch(`${base}/muhabbet/listings/feed?${intercityQ.toString()}`, {
        headers: authHeader(tok),
      });
      if (intercityRes.status === 401) {
        console.log('[muhabbet] preserving rows during reconnect');
        return;
      }
      type FeedResponse = {
        success?: boolean;
        listings?: FeedListing[];
        viewer_can_act_as_driver?: boolean;
        viewer_driver_vehicle_kind?: string | null;
      };
      const di = (await intercityRes.json().catch(() => ({}))) as FeedResponse;
      if (typeof di.viewer_can_act_as_driver === 'boolean') setViewerCanActAsDriver(di.viewer_can_act_as_driver);
      const vkFeed = (di.viewer_driver_vehicle_kind || '').toString().toLowerCase();
      setViewerDriverVk(vkFeed === 'motorcycle' ? 'motorcycle' : vkFeed === 'car' ? 'car' : null);
      if (intercityRes.ok && di.success && Array.isArray(di.listings)) {
        const openOnly = di.listings.filter((row) => {
          const st = (row.status || '').toLowerCase();
          if (st === 'matched' || st === 'closed' || st === 'cancelled' || st === 'pending_chat') return false;
          const m = (row.match_request_status || '').toLowerCase();
          if (m === 'accepted' && row.conversation_id) return false;
          return true;
        });
        openOnly.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
        setListings(openOnly);
      } else {
        console.log('[muhabbet] preserving rows during reconnect');
      }
    } catch {
      console.log('[muhabbet] preserving rows during reconnect');
    } finally {
      setLoadingFeed(false);
    }
  }, [base, selectedCity, tok, feedFilter]);

  const loadIncoming = useCallback(async () => {
    if (!tok) {
      console.log('[muhabbet] preserving rows during reconnect');
      return;
    }
    setLoadingIncoming(true);
    try {
      const res = await fetch(`${base}/muhabbet/match-requests/incoming?status=pending&limit=50`, {
        headers: authHeader(tok),
      });
      if (res.status === 401) {
        console.log('[muhabbet] preserving rows during reconnect');
        return;
      }
      const d = (await res.json().catch(() => ({}))) as { success?: boolean; requests?: IncomingOfferRequest[] };
      if (res.ok && d.success && Array.isArray(d.requests)) {
        setIncomingRequests(d.requests);
      } else {
        console.log('[muhabbet] preserving rows during reconnect');
      }
    } catch {
      console.log('[muhabbet] preserving rows during reconnect');
    } finally {
      setLoadingIncoming(false);
    }
  }, [base, tok]);

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
              const scope = String(r.listing_scope || '').trim().toLowerCase();
              if (scope !== 'intercity') return false;
              const ck = cityKey;
              return (
                String(r.origin_city || '').trim().toLowerCase() === ck ||
                String(r.destination_city || '').trim().toLowerCase() === ck ||
                String(r.city || '').trim().toLowerCase() === ck
              );
            })
          : d.listings.filter((r) => String(r.listing_scope || '').trim().toLowerCase() === 'intercity');
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
    await loadOutgoing();
    if (primarySegment === 'incoming') {
      await loadIncoming();
      return;
    }
    if (feedFilter === 'mine') {
      await loadMyListings();
    } else {
      await loadFeed();
    }
  }, [loadOutgoing, primarySegment, feedFilter, loadIncoming, loadMyListings, loadFeed]);

  useEffect(() => {
    if (tok) void loadAll();
  }, [tok, loadAll, selectedCity, syncVersion]);

  const primaryListings = primarySegment === 'open' && feedFilter === 'mine' ? myListings : listings;

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
      void loadAll();
    } catch {
      setListings(snapshot);
      Alert.alert('Talep', 'Bağlantı hatası.');
    } finally {
      setMatchBusyId(null);
    }
  };

  const openChatForAcceptedIncoming = useCallback(
    (conversationId: string, row: IncomingOfferRequest) => {
      const q = new URLSearchParams();
      const name = (row.sender_user_name || row.sender_name || 'Leylek kullanıcısı').trim();
      const from = String(row.listing?.from_text || '').trim();
      const to = String(row.listing?.to_text || '').trim();
      const otherUserId = String(row.sender_user_id || '').trim();
      if (name) q.set('n', name);
      if (from) q.set('f', from);
      if (to) q.set('t', to);
      if (otherUserId) q.set('ou', otherUserId);
      const s = q.toString();
      router.push(
        (s
          ? `/muhabbet-chat/${encodeURIComponent(conversationId)}?${s}`
          : `/muhabbet-chat/${encodeURIComponent(conversationId)}`) as Href
      );
    },
    [router]
  );

  const respondIncomingRequest = useCallback(
    async (row: IncomingOfferRequest, action: 'accept' | 'reject') => {
      if (!requireToken() || !tok || incomingBusyId) return;
      setIncomingBusyId(row.id);
      setIncomingBusyAction(action);
      try {
        const res = await fetch(`${base}/muhabbet/match-requests/${encodeURIComponent(row.id)}/${action}`, {
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
        if (!res.ok || !d.success) {
          Alert.alert(
            'Talep',
            typeof d.detail === 'string' && d.detail
              ? d.detail
              : action === 'accept'
                ? 'Kabul edilemedi.'
                : 'Reddedilemedi.'
          );
          return;
        }
        setIncomingRequests((rows) => rows.filter((x) => x.id !== row.id));
        void loadIncoming();
        void loadOutgoing();
        if (action === 'accept' && d.conversation_id) {
          openChatForAcceptedIncoming(d.conversation_id, row);
        }
      } catch {
        Alert.alert('Talep', 'Bağlantı hatası.');
      } finally {
        setIncomingBusyId(null);
        setIncomingBusyAction(null);
      }
    },
    [base, incomingBusyId, loadIncoming, loadOutgoing, openChatForAcceptedIncoming, requireToken, tok]
  );

  const incomingNavGuardRef = useRef<Record<string, boolean>>({});

  const incomingPressScaleRef = useRef<Record<string, Animated.Value>>({});
  const getIncomingPressScale = useCallback((id: string) => {
    const m = incomingPressScaleRef.current;
    if (!m[id]) m[id] = new Animated.Value(1);
    return m[id]!;
  }, []);

  /** Long-press navigasyon kilidi: yalnızca long press’te set; Alert kapanınca + gecikmeli güvenlik sıfırlaması. */
  const clearIncomingNavGuard = useCallback((id: string) => {
    delete incomingNavGuardRef.current[id];
    setTimeout(() => {
      delete incomingNavGuardRef.current[id];
    }, 300);
  }, []);

  useEffect(() => {
    return () => {
      incomingNavGuardRef.current = {};
      incomingPressScaleRef.current = {};
    };
  }, []);

  const filterCardScalesRef = useRef({
    all: new Animated.Value(1),
    driver: new Animated.Value(1),
    passenger: new Animated.Value(1),
  });

  const animateFilterPickAndApply = useCallback((key: FeedFilter) => {
    const scales = filterCardScalesRef.current;
    const anim =
      key === 'all' ? scales.all : key === 'driver' ? scales.driver : scales.passenger;
    anim.setValue(0.96);
    Animated.spring(anim, {
      toValue: 1,
      friction: 7,
      tension: 140,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setFeedFilter(key);
        setFilterPickerVisible(false);
      }
    });
  }, []);

  useEffect(() => {
    if (!filterPickerVisible) return;
    const s = filterCardScalesRef.current;
    s.all.setValue(1);
    s.driver.setValue(1);
    s.passenger.setValue(1);
  }, [filterPickerVisible]);

  const filteredListings = useMemo(() => {
    if (primarySegment === 'incoming') return [];
    if (feedFilter === 'mine') return orderedListings;
    return orderedListings.filter((L) => {
      if (feedFilter === 'driver') return offerKindFromListing(L) === 'driver_offer';
      if (feedFilter === 'passenger') return offerKindFromListing(L) === 'passenger_offer';
      return true;
    });
  }, [orderedListings, feedFilter, primarySegment]);

  const listingLifecycleAction = useCallback(
    async (
      listingId: string,
      action: 'continue' | 'close',
      opts?: { afterContinueMessage?: boolean }
    ) => {
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
        if (feedFilter !== 'mine') void loadFeed();
        if (action === 'continue' && opts?.afterContinueMessage) {
          Alert.alert('Teklifin', 'Teklifin 60 dakika daha yayında.');
        }
      } catch {
        Alert.alert('İlan', 'Bağlantı hatası.');
      }
    },
    [base, tok, requireToken, loadMyListings, loadFeed, feedFilter]
  );

  const promptListingKapat = useCallback(
    (L: FeedListing) => {
      const stillValid = listingExpiresAtAfterNow(L);
      if (stillValid) {
        Alert.alert(
          'Bu teklif henüz kapatılamaz',
          'Teklif süresi dolmadan kapatılamaz. İstersen yayında kalmaya devam edebilirsin.\n\nİlanlar 60 dakika yayında kalır. Süresi dolunca kapatabilirsin.\n\nİstersen teklifini yayında tutmaya devam edebilirsin.',
          [
            { text: 'Tamam', style: 'cancel' },
            {
              text: '60 dk uzat',
              style: 'default',
              onPress: () => void listingLifecycleAction(L.id, 'continue', { afterContinueMessage: true }),
            },
          ]
        );
        return;
      }
      Alert.alert('Teklifi kapat', 'Bu teklifi kapatmak istiyor musun?', [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Kapat',
          style: 'destructive',
          onPress: () => void listingLifecycleAction(L.id, 'close'),
        },
      ]);
    },
    [listingLifecycleAction]
  );

  const FEED_FILTER_CHIPS: { key: FeedFilter; label: string }[] = [
    { key: 'all', label: 'Tümü' },
    { key: 'driver', label: 'Sürücü' },
    { key: 'passenger', label: 'Yolcu' },
    { key: 'mine', label: 'Açtığım' },
  ];

  const formatIncomingTimeShort = (iso: string | null | undefined): string => {
    if (!iso) return '';
    try {
      const d = new Date(String(iso));
      if (Number.isNaN(d.getTime())) return '';
      const now = new Date();
      const sameDay =
        d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
      const hm = d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
      if (sameDay) return `Bugün ${hm}`;
      const y = new Date(now);
      y.setDate(y.getDate() + 1);
      const tomorrow =
        d.getFullYear() === y.getFullYear() && d.getMonth() === y.getMonth() && d.getDate() === y.getDate();
      if (tomorrow) return `Yarın ${hm}`;
      return d.toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const showIncomingSection = incomingListFilter !== 'outgoing_only';
  const showOutgoingSection = incomingListFilter !== 'incoming_only';

  const incomingBody = (
    <>
      <View style={styles.reqScreenHeader}>
        <View style={styles.reqScreenHeaderLeft}>
          <Text style={styles.reqScreenTitle}>Teklif talepleri</Text>
          <View style={styles.reqScreenBadge}>
            <Text style={styles.reqScreenBadgeTxt}>
              {incomingRequests.length > 0
                ? `${incomingRequests.length} yeni`
                : `${incomingRequests.length + outgoing.length} talep`}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.reqFilterTxtBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          onPress={() =>
            Alert.alert('Filtrele', undefined, [
              { text: 'Tümü', onPress: () => setIncomingListFilter('all') },
              { text: 'Sadece gelen', onPress: () => setIncomingListFilter('incoming_only') },
              { text: 'Sadece giden', onPress: () => setIncomingListFilter('outgoing_only') },
              { text: 'İptal', style: 'cancel' },
            ])
          }
          accessibilityRole="button"
          accessibilityLabel="Filtrele"
        >
          <Text style={styles.reqFilterTxt}>Filtrele</Text>
          <Ionicons name="filter-outline" size={16} color="#64748B" />
        </TouchableOpacity>
      </View>

      {showIncomingSection ? (
        <>
          <View style={styles.reqSubheadingRow}>
            <Text style={styles.reqSubheading}>Gelen talepler</Text>
            {loadingIncoming ? <ActivityIndicator size="small" color={PRIMARY_GRAD[0]} /> : null}
          </View>
          {!loadingIncoming && incomingRequests.length === 0 ? (
            <View style={styles.reqSectionEmpty}>
              <View style={styles.reqSectionEmptyIcon}>
                <Ionicons name="mail-open-outline" size={22} color="#94A3B8" />
              </View>
              <Text style={styles.reqSectionEmptyTitle}>Henüz gelen talep yok</Text>
              <Text style={styles.reqSectionEmptySub}>Teklifine talip geldiğinde burada listelenir.</Text>
              <TouchableOpacity style={styles.reqSectionEmptyCta} onPress={() => setScopePickerVisible(true)} activeOpacity={0.88}>
                <Text style={styles.reqSectionEmptyCtaTxt}>Teklif aç</Text>
                <Ionicons name="add-circle-outline" size={18} color="#2563EB" />
              </TouchableOpacity>
            </View>
          ) : null}

          {incomingRequests.map((r) => {
            const name = (r.sender_user_name || r.sender_name || 'Leylek kullanıcısı').trim();
            const initial = name.charAt(0).toLocaleUpperCase('tr-TR') || '?';
            const acceptBusy = incomingBusyId === r.id && incomingBusyAction === 'accept';
            const rejectBusy = incomingBusyId === r.id && incomingBusyAction === 'reject';
            const routeCompact = formatMuhabbetRouteLabel({
              listing_scope: r.listing?.listing_scope,
              origin_city: r.listing?.origin_city,
              destination_city: r.listing?.destination_city,
              city: r.listing?.city,
              from_text: r.listing?.from_text,
              to_text: r.listing?.to_text,
            });
            const timeTop = formatIncomingTimeShort(r.created_at);
            const metaWhen = formatDeparture(r.created_at || null);
            return (
              <Pressable
                key={r.id}
                style={({ pressed }) => [styles.reqCard, pressed && styles.reqCardPressed]}
                onLongPress={() => {
                  if (incomingBusyId) return;
                  incomingNavGuardRef.current[r.id] = true;
                  Alert.alert(
                    'Talebi sil',
                    'Bu talebi silmek istiyor musun?',
                    [
                      {
                        text: 'Vazgeç',
                        style: 'cancel',
                        onPress: () => clearIncomingNavGuard(r.id),
                      },
                      {
                        text: 'Sil',
                        style: 'destructive',
                        onPress: () => {
                          clearIncomingNavGuard(r.id);
                          void respondIncomingRequest(r, 'reject');
                        },
                      },
                    ],
                    Platform.OS === 'android'
                      ? {
                          cancelable: true,
                          onDismiss: () => clearIncomingNavGuard(r.id),
                        }
                      : undefined
                  );
                }}
                delayLongPress={300}
                android_disableSound
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Pressable
                  style={{ alignSelf: 'stretch' }}
                  onPressIn={() =>
                    void Animated.timing(getIncomingPressScale(r.id), {
                      toValue: 0.98,
                      duration: 55,
                      useNativeDriver: true,
                    }).start()
                  }
                  onPressOut={() =>
                    void Animated.timing(getIncomingPressScale(r.id), {
                      toValue: 1,
                      duration: 120,
                      useNativeDriver: true,
                    }).start()
                  }
                  onPress={() => {
                    if (incomingNavGuardRef.current[r.id]) {
                      clearIncomingNavGuard(r.id);
                      return;
                    }
                    router.push('/muhabbet-match-requests' as Href);
                  }}
                  android_disableSound
                  android_ripple={{ color: 'rgba(59,130,246,0.12)' }}
                >
                  <Animated.View
                    style={[
                      styles.reqCardMainTouch,
                      { transform: [{ scale: getIncomingPressScale(r.id) }] },
                    ]}
                  >
                  <View style={styles.reqAvatarIn}>
                    <Text style={styles.reqAvatarInTxt}>{initial}</Text>
                  </View>
                  <View style={styles.reqCardMid}>
                    <View style={styles.reqNameRow}>
                      <Text style={styles.reqName} numberOfLines={1} ellipsizeMode="tail">
                        {name}
                      </Text>
                      <View style={styles.reqNameRowRight}>
                        {timeTop ? (
                          <Text style={styles.reqTimeCorner} numberOfLines={1}>
                            {timeTop}
                          </Text>
                        ) : null}
                        <View style={styles.reqBadgeYeni}>
                          <Text style={styles.reqBadgeYeniTxt}>Yeni</Text>
                        </View>
                      </View>
                    </View>
                    <Text style={styles.reqRouteMain} numberOfLines={1} ellipsizeMode="tail">
                      {routeCompact}
                    </Text>
                    <View style={styles.reqMetaInline}>
                      <Ionicons name="time-outline" size={12} color="#94A3B8" />
                      <Text style={styles.reqMetaSmall} numberOfLines={1}>
                        {metaWhen}
                      </Text>
                      <Text style={styles.reqMetaDot}>·</Text>
                      <Ionicons name="cube-outline" size={12} color="#94A3B8" />
                      <Text style={styles.reqMetaSmall} numberOfLines={1}>
                        Teklif talebi
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
                  </Animated.View>
                </Pressable>
                <View style={styles.reqIncomingFooter}>
                  <Pressable
                    style={({ pressed }) => [styles.reqPillReject, pressed && { opacity: 0.85 }]}
                    disabled={!!incomingBusyId}
                    onPress={() => void respondIncomingRequest(r, 'reject')}
                  >
                    <Text style={styles.reqPillRejectTxt}>{rejectBusy ? '…' : 'Reddet'}</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.reqPillAccept, pressed && { opacity: 0.88 }]}
                    disabled={!!incomingBusyId}
                    onPress={() => void respondIncomingRequest(r, 'accept')}
                  >
                    {acceptBusy ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.reqPillAcceptTxt}>Kabul</Text>
                    )}
                  </Pressable>
                </View>
              </Pressable>
            );
          })}
        </>
      ) : null}

      {showOutgoingSection ? (
        <>
          <View
            style={[
              styles.reqSubheadingRow,
              showIncomingSection ? styles.reqSubheadingRowSpaced : styles.reqSubheadingRowFirst,
            ]}
          >
            <Text style={styles.reqSubheading}>Giden talepler</Text>
            {loadingOut ? <ActivityIndicator size="small" color={PRIMARY_GRAD[0]} /> : null}
          </View>
          {!loadingOut && outgoing.length === 0 ? (
            <View style={styles.reqSectionEmpty}>
              <View style={styles.reqSectionEmptyIcon}>
                <Ionicons name="paper-plane-outline" size={22} color="#94A3B8" />
              </View>
              <Text style={styles.reqSectionEmptyTitle}>Henüz giden talep yok</Text>
              <Text style={styles.reqSectionEmptySub}>Açık tekliflere talip gönderdiğinde burada görünür.</Text>
              <TouchableOpacity style={styles.reqSectionEmptyCta} onPress={() => setPrimarySegment('open')} activeOpacity={0.88}>
                <Text style={styles.reqSectionEmptyCtaTxt}>Açık tekliflere bak</Text>
                <Ionicons name="arrow-forward-circle-outline" size={18} color="#2563EB" />
              </TouchableOpacity>
            </View>
          ) : null}

          {outgoing.map((r) => {
            const st = (r.status || '').toLowerCase();
            const isAcc = st === 'accepted' && r.conversation_id;
            const ui = matchRequestUiStatus(r.status);
            const dispName = (r.receiver_public_name || r.receiver_name || 'Teklif sahibi').trim();
            const initial = dispName.charAt(0).toLocaleUpperCase('tr-TR') || '?';
            const routeCompact = formatMuhabbetRouteLabel({
              listing_scope: r.listing?.listing_scope,
              origin_city: r.listing?.origin_city,
              destination_city: r.listing?.destination_city,
              city: r.listing?.city,
              from_text: r.listing?.from_text,
              to_text: r.listing?.to_text,
            });
            const statusStyle =
              ui.tone === 'ok' ? styles.reqStatusPillOk : ui.tone === 'bad' ? styles.reqStatusPillBad : styles.reqStatusPillWait;
            const metaSub =
              ui.label === 'Bekliyor'
                ? 'yanıt bekleniyor'
                : ui.label === 'Kabul'
                  ? 'eşleşme tamam'
                  : ui.label === 'Reddedildi'
                    ? 'talep sonuçlandı'
                    : 'güncellendi';

            const openOutgoingChat = () => {
              if (!r.conversation_id) return;
              pushToChat(router, {
                conversationId: r.conversation_id,
                otherUserName: dispName,
                fromText: String(r.listing?.from_text || ''),
                toText: String(r.listing?.to_text || ''),
                otherUserId: r.receiver_user_id ? String(r.receiver_user_id) : undefined,
              });
            };

            return (
              <View key={r.id} style={styles.reqCard}>
                <TouchableOpacity
                  style={styles.reqCardMainTouch}
                  activeOpacity={0.92}
                  onPress={() => router.push('/muhabbet-match-requests' as Href)}
                >
                  <View style={styles.reqAvatarOut}>
                    <Text style={styles.reqAvatarOutTxt}>{initial}</Text>
                  </View>
                  <View style={styles.reqCardMid}>
                    <View style={styles.reqNameRow}>
                      <Text style={styles.reqName} numberOfLines={1} ellipsizeMode="tail">
                        {dispName}
                      </Text>
                      <View style={[styles.reqStatusPill, statusStyle]}>
                        <Text
                          style={[
                            styles.reqStatusPillTxtBase,
                            ui.tone === 'ok' && { color: '#15803D' },
                            ui.tone === 'wait' && { color: '#B45309' },
                            ui.tone === 'bad' && { color: '#B91C1C' },
                          ]}
                        >
                          {ui.label}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.reqRouteMain} numberOfLines={1} ellipsizeMode="tail">
                      {routeCompact}
                    </Text>
                    <Text style={styles.reqMetaSmallMono} numberOfLines={1}>
                      Talep · {metaSub}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
                </TouchableOpacity>
                {isAcc ? (
                  <TouchableOpacity style={styles.reqMsgLinkRow} onPress={openOutgoingChat} activeOpacity={0.88}>
                    <Text style={styles.reqMsgLink}>Mesaja git</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            );
          })}
        </>
      ) : null}
    </>
  );

  const listLoading = primarySegment === 'open' && feedFilter === 'mine' ? loadingMine : loadingFeed;

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
        const routeSummary = formatMuhabbetRouteLabel(L);
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
                  <Text style={styles.scopeBadgeText}>Şehir dışı</Text>
                </View>
              ) : null}
              <Text style={styles.statusPill}>{statusLabel(L.status)}</Text>
            </View>
            {feedFilter === 'mine' ? (
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
            <View style={styles.cityRouteBanner}>
              <Ionicons name="map-outline" size={14} color="#0369A1" />
              <Text style={styles.cityRouteText} numberOfLines={2} ellipsizeMode="tail">
                {routeSummary}
              </Text>
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
            feedFilter === 'mine' &&
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
            {feedFilter === 'mine' &&
            String(L.status || '').toLowerCase() === 'active' &&
            L.muhabbet_offer_expired ? (
              <View style={styles.lifecyclePrompt}>
                <Text style={styles.lifecyclePromptTitle}>Teklifiniz hâlâ geçerli mi?</Text>
                <Text style={styles.lifecyclePromptSub}>Teklifin 60 dakika daha yayında kalabilir.</Text>
                <View style={styles.lifecycleRow}>
                  <TouchableOpacity
                    style={styles.lifecycleBtnPri}
                    onPress={() => void listingLifecycleAction(L.id, 'continue', { afterContinueMessage: true })}
                    activeOpacity={0.88}
                  >
                    <Text style={styles.lifecycleBtnPriTxt}>Devam et</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.lifecycleBtnSec}
                    onPress={() => promptListingKapat(L)}
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
            setModalInitialRole('passenger');
            setModalInitialScope('intercity');
            setCreateOpen(true);
          }}
          activeOpacity={0.9}
          style={styles.newListingBtnHero}
        >
          <LinearGradient colors={['#FFF7ED', '#FED7AA']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <View style={styles.newListingIconBubble}>
            <Ionicons name="add" size={18} color="#FFFFFF" />
          </View>
          <Text style={styles.newListingBtnHeroText}>+ Teklif aç</Text>
        </TouchableOpacity>

        <View style={styles.primaryTabsRow}>
          <Pressable
            onPress={() => setPrimarySegment('incoming')}
            style={({ pressed }) => [
              styles.primaryTabPill,
              primarySegment === 'incoming' && styles.primaryTabPillOn,
              pressed && { opacity: 0.92 },
            ]}
          >
            <Text style={[styles.primaryTabPillTxt, primarySegment === 'incoming' && styles.primaryTabPillTxtOn]} numberOfLines={1}>
              Teklif talepleri
            </Text>
            {incomingRequests.length > 0 ? (
              <View style={styles.primaryTabBadge}>
                <Text style={styles.primaryTabBadgeTxt}>{incomingRequests.length} yeni</Text>
              </View>
            ) : null}
          </Pressable>
          <Pressable
            onPress={() => setPrimarySegment('open')}
            style={({ pressed }) => [
              styles.primaryTabPill,
              styles.primaryTabPillOpen,
              primarySegment === 'open' && styles.primaryTabPillOnOpen,
              pressed && { opacity: 0.92 },
            ]}
          >
            <Text style={[styles.primaryTabPillTxt, primarySegment === 'open' && styles.primaryTabPillTxtOnOpen]} numberOfLines={1}>
              Açık teklifler
            </Text>
          </Pressable>
        </View>

        {primarySegment === 'open' ? (
          <View style={styles.feedToolbarRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.feedChipScroll}>
              {FEED_FILTER_CHIPS.map(({ key, label }) => {
                const active = feedFilter === key;
                return (
                  <Pressable
                    key={key}
                    onPress={() => setFeedFilter(key)}
                    style={({ pressed }) => [
                      styles.feedChip,
                      active && styles.feedChipOn,
                      !active && pressed && { opacity: 0.88 },
                    ]}
                  >
                    <Text style={[styles.feedChipTxt, active && styles.feedChipTxtOn]} numberOfLines={1}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <TouchableOpacity
              style={styles.filterIconBtn}
              activeOpacity={0.85}
              onPress={() => setFilterPickerVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Filtrele"
            >
              <Ionicons name="options-outline" size={22} color="#475569" />
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {primarySegment === 'incoming' ? incomingBody : feedBody}
        <View style={{ height: 24 }} />
      </ScrollView>

      <Modal visible={filterPickerVisible} transparent animationType="fade" onRequestClose={() => setFilterPickerVisible(false)}>
        <Pressable style={styles.filterBackdrop} onPress={() => setFilterPickerVisible(false)} accessibilityRole="button">
          <View style={styles.filterSheet} onStartShouldSetResponder={() => true}>
            <Text style={styles.filterSheetTitle}>Filtrele</Text>
            <Text style={styles.filterSheetHint}>Görüntülemek istediğin teklif türünü seç.</Text>
            {(
              [
                { key: 'all' as const, label: 'Tümü', icon: 'layers-outline' as const, bg: 'rgba(71,85,105,0.14)', tone: '#475569' },
                {
                  key: 'driver' as const,
                  label: 'Sürücü teklifleri',
                  icon: 'car-outline' as const,
                  bg: 'rgba(37,99,235,0.14)',
                  tone: '#2563EB',
                },
                {
                  key: 'passenger' as const,
                  label: 'Yolcu teklifleri',
                  icon: 'people-outline' as const,
                  bg: 'rgba(234,88,12,0.14)',
                  tone: '#EA580C',
                },
              ] as const
            ).map((opt) => {
              const sel = feedFilter === opt.key;
              const scaleAnim =
                opt.key === 'all'
                  ? filterCardScalesRef.current.all
                  : opt.key === 'driver'
                    ? filterCardScalesRef.current.driver
                    : filterCardScalesRef.current.passenger;
              return (
                <Animated.View key={opt.key} style={{ transform: [{ scale: scaleAnim }] }}>
                  <Pressable
                    style={[styles.filterOptionCard, sel && styles.filterOptionCardOn]}
                    onPress={() => animateFilterPickAndApply(opt.key)}
                  >
                    <View style={[styles.filterOptionIconBubble, { backgroundColor: opt.bg }]}>
                      <Ionicons name={opt.icon} size={22} color={opt.tone} />
                    </View>
                    <Text style={styles.filterOptionLabel}>{opt.label}</Text>
                    {sel ? (
                      <Ionicons name="checkmark-circle" size={24} color="#2563EB" />
                    ) : (
                      <View style={styles.filterOptionCheckSpacer} />
                    )}
                  </Pressable>
                </Animated.View>
              );
            })}
            <TouchableOpacity style={styles.filterCancelBtn} onPress={() => setFilterPickerVisible(false)} activeOpacity={0.88}>
              <Text style={styles.filterCancelTxt}>Vazgeç</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

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
  primaryTabsRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'stretch',
  },
  primaryTabPill: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(60,60,67,0.07)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  primaryTabPillOn: {
    backgroundColor: 'rgba(59,130,246,0.14)',
    borderColor: 'rgba(59,130,246,0.35)',
  },
  primaryTabPillOpen: {},
  primaryTabPillOnOpen: {
    backgroundColor: 'rgba(249,115,22,0.14)',
    borderColor: 'rgba(249,115,22,0.35)',
  },
  primaryTabPillTxt: { fontSize: 14, fontWeight: '800', color: TEXT_SECONDARY },
  primaryTabPillTxtOn: { color: '#1D4ED8' },
  primaryTabPillTxtOnOpen: { color: '#C2410C' },
  primaryTabBadge: {
    marginLeft: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(220,38,38,0.15)',
  },
  primaryTabBadgeTxt: { fontSize: 11, fontWeight: '800', color: '#B91C1C' },
  feedToolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  feedChipScroll: {
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 4,
  },
  feedChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(60,60,67,0.07)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  feedChipOn: {
    backgroundColor: 'rgba(59,130,246,0.16)',
    borderColor: 'rgba(59,130,246,0.35)',
  },
  feedChipTxt: { fontSize: 13, fontWeight: '700', color: TEXT_SECONDARY },
  feedChipTxtOn: { color: '#1D4ED8' },
  filterIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(60,60,67,0.06)',
  },
  filterBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 28,
  },
  filterSheet: {
    backgroundColor: CARD_BG,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 20,
    ...CARD_SHADOW,
  },
  filterSheetTitle: { fontSize: 18, fontWeight: '900', color: TEXT_PRIMARY },
  filterSheetHint: { fontSize: 13, color: TEXT_SECONDARY, marginTop: 6, marginBottom: 14, lineHeight: 18 },
  filterOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 16,
    marginBottom: 10,
    backgroundColor: 'rgba(248,250,252,0.96)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(226,232,240,0.95)',
  },
  filterOptionCardOn: {
    borderWidth: 2,
    borderColor: '#3B82F6',
    backgroundColor: '#EFF6FF',
  },
  filterOptionIconBubble: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterOptionLabel: { flex: 1, fontSize: 16, fontWeight: '800', color: TEXT_PRIMARY },
  filterOptionCheckSpacer: { width: 24, height: 24 },
  filterCancelBtn: { marginTop: 6, alignItems: 'center', paddingVertical: 12 },
  filterCancelTxt: { fontSize: 16, fontWeight: '700', color: '#64748B' },
  scopeBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 28,
  },
  scopeSheet: {
    backgroundColor: CARD_BG,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 14,
    ...CARD_SHADOW,
  },
  scopeSheetTitle: { fontSize: 18, fontWeight: '900', color: TEXT_PRIMARY },
  scopeSheetHint: { fontSize: 13, color: TEXT_SECONDARY, marginTop: 6, marginBottom: 14, lineHeight: 18 },
  scopeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(60,60,67,0.12)',
  },
  scopeOptionTxt: { flex: 1, minWidth: 0 },
  scopeOptionTitle: { fontSize: 16, fontWeight: '800', color: TEXT_PRIMARY },
  scopeOptionSub: { fontSize: 12, color: TEXT_SECONDARY, marginTop: 3, lineHeight: 17 },
  scopeCancelBtn: { marginTop: 10, alignItems: 'center', paddingVertical: 12 },
  scopeCancelTxt: { fontSize: 16, fontWeight: '700', color: '#64748B' },
  reqScreenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 12,
  },
  reqScreenHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  reqScreenTitle: { fontSize: 19, fontWeight: '900', color: TEXT_PRIMARY, letterSpacing: -0.2 },
  reqScreenBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(59,130,246,0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(59,130,246,0.22)',
  },
  reqScreenBadgeTxt: { fontSize: 11, fontWeight: '800', color: '#1D4ED8' },
  reqFilterTxtBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  reqFilterTxt: { fontSize: 13, fontWeight: '700', color: '#64748B' },
  reqSubheadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  reqSubheadingRowSpaced: { marginTop: 18 },
  reqSubheadingRowFirst: { marginTop: 4 },
  reqSubheading: { fontSize: 14, fontWeight: '800', color: '#64748B', letterSpacing: 0.2 },
  reqSectionEmpty: {
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 14,
    marginBottom: 10,
    borderRadius: 18,
    backgroundColor: CARD_BG,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(226,232,240,0.95)',
    ...CARD_SHADOW,
    gap: 6,
  },
  reqSectionEmptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(241,245,249,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  reqSectionEmptyTitle: { fontSize: 15, fontWeight: '800', color: TEXT_PRIMARY, textAlign: 'center' },
  reqSectionEmptySub: { fontSize: 13, color: TEXT_SECONDARY, textAlign: 'center', lineHeight: 18, paddingHorizontal: 8 },
  reqSectionEmptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(59,130,246,0.1)',
  },
  reqSectionEmptyCtaTxt: { fontSize: 14, fontWeight: '800', color: '#2563EB' },
  reqCard: {
    marginBottom: 11,
    borderRadius: 19,
    backgroundColor: CARD_BG,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(226,232,240,0.95)',
    paddingHorizontal: 13,
    paddingTop: 12,
    paddingBottom: 12,
    ...CARD_SHADOW,
  },
  reqCardPressed: { opacity: 0.97 },
  reqCardMainTouch: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
  reqAvatarIn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(59,130,246,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reqAvatarInTxt: { fontSize: 16, fontWeight: '900', color: '#1D4ED8' },
  reqAvatarOut: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(245,158,11,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reqAvatarOutTxt: { fontSize: 16, fontWeight: '900', color: '#C2410C' },
  reqCardMid: { flex: 1, minWidth: 0 },
  reqNameRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  reqName: { flex: 1, minWidth: 0, fontSize: 15, fontWeight: '800', color: TEXT_PRIMARY },
  reqNameRowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reqTimeCorner: { fontSize: 11, fontWeight: '700', color: '#94A3B8', maxWidth: 96 },
  reqBadgeYeni: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(220,38,38,0.1)',
  },
  reqBadgeYeniTxt: { fontSize: 10, fontWeight: '900', color: '#DC2626' },
  reqRouteMain: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
    lineHeight: 20,
    marginBottom: 5,
  },
  reqMetaInline: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5 },
  reqMetaSmall: { fontSize: 12, color: '#94A3B8', fontWeight: '600', flexShrink: 1 },
  reqMetaDot: { fontSize: 12, color: '#CBD5E1' },
  reqMetaSmallMono: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
    lineHeight: 18,
  },
  reqStatusPill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
  reqStatusPillTxtBase: { fontSize: 11, fontWeight: '800' },
  reqStatusPillOk: { backgroundColor: 'rgba(22,163,74,0.12)' },
  reqStatusPillWait: { backgroundColor: 'rgba(245,158,11,0.15)' },
  reqStatusPillBad: { backgroundColor: 'rgba(220,38,38,0.1)' },
  reqIncomingFooter: {
    flexDirection: 'row',
    gap: 9,
    marginTop: 11,
    paddingTop: 11,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(226,232,240,0.95)',
  },
  reqPillReject: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(248,250,252,0.96)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(252,165,165,0.65)',
  },
  reqPillRejectTxt: { fontSize: 13, fontWeight: '800', color: '#B91C1C' },
  reqPillAccept: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#059669',
  },
  reqPillAcceptTxt: { fontSize: 13, fontWeight: '900', color: '#FFFFFF' },
  reqMsgLinkRow: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(226,232,240,0.95)',
    alignSelf: 'flex-start',
    marginLeft: 53,
  },
  reqMsgLink: { fontSize: 14, fontWeight: '600', color: '#2563EB' },
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
