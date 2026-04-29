/**
 * Leylek Teklif Sende — Ana Sayfa sekmesi: teklif CTA, günün teklifleri (liste + hafif rotasyon).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  Platform,
  Alert,
} from 'react-native';
import { handleUnauthorizedAndMaybeRedirect } from '../lib/muhabbetAuthRedirect';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import MuhabbetWatermark from './MuhabbetWatermark';

const TEXT_PRIMARY = '#111111';
const TEXT_SECONDARY = '#6E6E73';
const CARD_BG = '#FFFFFF';
const VISIBLE_OFFERS = 20;
const CTA_CARD_SHADOW = Platform.select({
  ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.14, shadowRadius: 12 },
  android: { elevation: 5 },
  default: {},
});

type ListingScope = 'local' | 'intercity';

type HomeFeedListing = {
  id: string;
  creator_name?: string | null;
  creator_public_name?: string | null;
  from_text?: string | null;
  to_text?: string | null;
  listing_type?: string | null;
  muhabbet_offer_kind?: string | null;
  role_type?: string | null;
  price_amount?: number | null;
  transport_label?: string | null;
  vehicle_kind?: string | null;
  match_request_status?: string | null;
  created_by_user_id?: string | null;
  status?: string | null;
  created_at?: string | null;
  city?: string | null;
  listing_scope?: string | null;
  origin_city?: string | null;
  destination_city?: string | null;
};

type IncomingOfferRequest = {
  id: string;
  sender_user_id?: string | null;
  sender_name?: string | null;
  sender_user_name?: string | null;
  listing?: { from_text?: string | null; to_text?: string | null } | null;
};

function isDriverRole(r: string | null | undefined): boolean {
  const x = (r || '').toLowerCase();
  return x === 'driver' || x === 'private_driver';
}

function homeListingVehicleKind(L: HomeFeedListing): 'car' | 'motorcycle' {
  const v = (L.vehicle_kind || 'car').toString().toLowerCase();
  return v === 'motorcycle' || v === 'motor' ? 'motorcycle' : 'car';
}

function offerKindFromHomeListing(L: HomeFeedListing): 'driver_offer' | 'passenger_offer' {
  const k = (L.muhabbet_offer_kind || '').toLowerCase();
  if (k === 'driver_offer' || k === 'passenger_offer') return k;
  const lt = (L.listing_type || '').toLowerCase();
  if (lt === 'gidiyorum' || lt === 'ozel_sofor') return 'driver_offer';
  if (lt === 'gidecegim' || lt === 'beni_alsin') return 'passenger_offer';
  return isDriverRole(L.role_type) ? 'driver_offer' : 'passenger_offer';
}

/** Kullanıcıya görünen taşıma etiketi (API’deki “Araç” → Araba). */
function transportLabelForUser(item: HomeFeedListing): string {
  const raw = (item.transport_label || '').trim();
  const vk = (item.vehicle_kind || '').toLowerCase();
  if (vk === 'motor' || vk === 'motorcycle') return 'Motor';
  if (raw) {
    const low = raw.toLowerCase();
    if (low === 'araç' || low === 'arac') return 'Araba';
    return raw.replace(/\bAraç\b/g, 'Araba').replace(/\baraç\b/g, 'Araba');
  }
  return 'Araba';
}

type CompactOfferCardProps = {
  item: HomeFeedListing;
  onPressCard: () => void;
  onPressCta: () => void;
  ctaLabel: string;
  ctaDisabled: boolean;
  ctaBusy: boolean;
};

function CompactOfferCard({ item, onPressCard, onPressCta, ctaLabel, ctaDisabled, ctaBusy }: CompactOfferCardProps) {
  const isDriver = offerKindFromHomeListing(item) === 'driver_offer';
  const glow = isDriver ? 'rgba(59,130,246,0.42)' : 'rgba(245,158,11,0.4)';
  const accent = isDriver ? '#2563EB' : '#EA580C';
  const from = (item.from_text || '—').toString().trim() || '—';
  const to = (item.to_text || '—').toString().trim() || '—';
  const isIntercity = (item.listing_scope || '').toString().toLowerCase() === 'intercity';
  const originCity = (item.origin_city || item.city || '').toString().trim();
  const destinationCity = (item.destination_city || '').toString().trim();
  const priceStr =
    item.price_amount != null && !Number.isNaN(Number(item.price_amount))
      ? `${Number(item.price_amount).toLocaleString('tr-TR')} ₺`
      : '—';
  const transport = transportLabelForUser(item);
  const roleLabel = isDriver ? 'Sürücü' : 'Yolcu';
  const creatorPublic = (item.creator_public_name || item.creator_name || 'Leylek kullanıcısı').trim();
  const initial = creatorPublic.charAt(0).toLocaleUpperCase('tr-TR') || '?';

  return (
    <Pressable
      onPress={onPressCard}
      style={({ pressed }) => [cs.slot, pressed && { opacity: 0.97 }]}
      android_ripple={{ color: 'rgba(0,0,0,0.06)' }}
    >
      <View style={[cs.glow, { shadowColor: glow }]} />
      <View style={cs.cardOuter}>
        <View style={[cs.accentStrip, { backgroundColor: accent }]} />
        <View style={cs.card}>
          <View style={cs.cardTop}>
            <View style={cs.chipsRow}>
              <View style={[cs.pill, { backgroundColor: isDriver ? 'rgba(59,130,246,0.12)' : 'rgba(245,158,11,0.15)' }]}>
                <Text style={[cs.pillTxt, { color: isDriver ? '#1D4ED8' : '#C2410C' }]}>{roleLabel}</Text>
              </View>
              <View style={cs.pillMuted}>
                <Ionicons name="car-outline" size={11} color="#15803D" style={{ marginRight: 3 }} />
                <Text style={cs.pillMutedTxt}>{transport}</Text>
              </View>
              {isIntercity ? (
                <View style={cs.scopePill}>
                  <Ionicons name="airplane-outline" size={10} color="#0369A1" style={{ marginRight: 3 }} />
                  <Text style={cs.scopePillTxt}>Şehirler arası</Text>
                </View>
              ) : (
                <View style={cs.scopePillLocal}>
                  <Ionicons name="business-outline" size={10} color="#0369A1" style={{ marginRight: 3 }} />
                  <Text style={cs.scopePillLocalTxt}>Şehir içi</Text>
                </View>
              )}
            </View>
            <View style={cs.pricePill}>
              <Text style={cs.pricePillTxt}>{priceStr}</Text>
            </View>
          </View>
          {isIntercity && originCity && destinationCity ? (
            <View style={cs.cityPillRow}>
              <Ionicons name="map-outline" size={14} color="#0F172A" />
              <Text style={cs.cityRoute} numberOfLines={1}>
                {originCity} → {destinationCity}
              </Text>
            </View>
          ) : null}
          <View style={cs.routeRow}>
            <View style={cs.miniCol}>
              <Text style={cs.tagG}>NEREDEN</Text>
              <Text style={cs.place} numberOfLines={2}>
                {from}
              </Text>
            </View>
            <View style={cs.routeArrow}>
              <Ionicons name="arrow-forward" size={16} color="#94A3B8" />
            </View>
            <View style={cs.miniCol}>
              <Text style={cs.tagG}>NEREYE</Text>
              <Text style={cs.place} numberOfLines={2}>
                {to}
              </Text>
            </View>
          </View>
          <View style={cs.creatorRow}>
            <View style={cs.avatarCircle}>
              <Text style={cs.avatarTxt}>{initial}</Text>
            </View>
            <Text style={cs.creatorLine} numberOfLines={1}>
              {creatorPublic}
            </Text>
          </View>
          <Pressable
            onPress={(e) => {
              e?.stopPropagation?.();
              onPressCta();
            }}
            disabled={ctaDisabled || ctaBusy}
            style={({ pressed }) => [
              cs.cta,
              isDriver ? cs.ctaDriver : cs.ctaPassenger,
              (ctaDisabled || ctaBusy) && { opacity: 0.45 },
              pressed && !ctaDisabled && !ctaBusy && cs.ctaPressedInner,
            ]}
          >
            {ctaBusy ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name={isDriver ? 'hand-left-outline' : 'flash-outline'} size={16} color="#fff" style={{ marginRight: 6 }} />
                <Text style={cs.ctaTxt}>{ctaLabel}</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

const cs = StyleSheet.create({
  slot: { position: 'relative', marginBottom: 14 },
  glow: {
    position: 'absolute',
    left: -3,
    right: -3,
    top: -3,
    bottom: -3,
    borderRadius: 22,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 14,
    elevation: 5,
  },
  cardOuter: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: CARD_BG,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(148,163,184,0.25)',
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.07,
        shadowRadius: 14,
      },
      android: { elevation: 4 },
      default: {},
    }),
  },
  accentStrip: { height: 4, width: '100%' },
  card: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 12,
    backgroundColor: CARD_BG,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 10,
  },
  chipsRow: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  pill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  pillTxt: { fontSize: 11, fontWeight: '900', letterSpacing: 0.2 },
  pillMuted: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(22, 163, 74, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(22, 163, 74, 0.22)',
  },
  pillMutedTxt: { fontSize: 10, fontWeight: '800', color: '#15803D' },
  scopePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(14, 165, 233, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(14, 165, 233, 0.3)',
  },
  scopePillTxt: { fontSize: 10, fontWeight: '900', color: '#0369A1' },
  scopePillLocal: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(37, 99, 235, 0.2)',
  },
  scopePillLocalTxt: { fontSize: 10, fontWeight: '900', color: '#1D4ED8' },
  pricePill: {
    backgroundColor: 'rgba(15,23,42,0.06)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(15,23,42,0.06)',
  },
  pricePillTxt: { fontSize: 14, fontWeight: '900', color: '#0f172a', letterSpacing: -0.3 },
  cityPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(241,245,249,0.95)',
  },
  cityRoute: { flex: 1, fontSize: 13, fontWeight: '900', color: '#0F172A' },
  routeRow: { flexDirection: 'row', alignItems: 'stretch', marginBottom: 12 },
  routeArrow: { justifyContent: 'center', paddingHorizontal: 4 },
  miniCol: { flex: 1, minWidth: 0 },
  tagG: { fontSize: 9, fontWeight: '900', color: '#64748B', marginBottom: 4, letterSpacing: 0.6 },
  place: { fontSize: 13.5, fontWeight: '700', color: '#0f172a', lineHeight: 19 },
  creatorRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(59,130,246,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(59,130,246,0.25)',
  },
  avatarTxt: { fontSize: 14, fontWeight: '900', color: '#2563EB' },
  creatorLine: { flex: 1, fontSize: 13, color: '#475569', fontWeight: '700' },
  cta: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    paddingVertical: 11,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaDriver: { backgroundColor: '#2563EB' },
  ctaPassenger: { backgroundColor: '#EA580C' },
  ctaPressedInner: { opacity: 0.92, transform: [{ scale: 0.985 }] },
  ctaTxt: { color: '#fff', fontSize: 13.5, fontWeight: '900', letterSpacing: -0.1 },
});

export type LeylekMuhabbetiHomeTabProps = {
  apiUrl: string;
  accessToken: string;
  selectedCity: string;
  refreshNonce: number;
  onOpenListingsCreate: () => void;
  onOpenDriverListing?: (scope: ListingScope) => void;
  onOpenPassengerListing?: (scope: ListingScope) => void;
  onOpenMatchRequests?: () => void;
  /** Teklifler sekmesine geç ve bu ilanı üste taşı (ListingsTab ile eşleşir). */
  onOpenListingsForListing?: (listingId: string) => void;
  currentUserId: string;
  viewerAppRole: string;
  requireToken: () => boolean;
};

export default function LeylekMuhabbetiHomeTab({
  apiUrl,
  accessToken,
  selectedCity,
  refreshNonce,
  onOpenListingsCreate,
  onOpenDriverListing,
  onOpenPassengerListing,
  onOpenMatchRequests,
  onOpenListingsForListing,
  currentUserId,
  viewerAppRole,
  requireToken,
}: LeylekMuhabbetiHomeTabProps) {
  const router = useRouter();
  const openDriver = (scope: ListingScope) => onOpenDriverListing ? onOpenDriverListing(scope) : onOpenListingsCreate();
  const openPassenger = (scope: ListingScope) => onOpenPassengerListing ? onOpenPassengerListing(scope) : onOpenListingsCreate();
  const tok = accessToken.trim();
  const base = apiUrl.replace(/\/$/, '');
  const listAnim = useRef(new Animated.Value(1)).current;
  const listSlide = useRef(new Animated.Value(0)).current;
  const ctaPulse = useRef(new Animated.Value(0)).current;

  const [pendingIncoming, setPendingIncoming] = useState(0);
  const [incomingRequests, setIncomingRequests] = useState<IncomingOfferRequest[]>([]);
  const [feedPreview, setFeedPreview] = useState<HomeFeedListing[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [windowOffset, setWindowOffset] = useState(0);
  const [matchBusyId, setMatchBusyId] = useState<string | null>(null);
  const [incomingBusyId, setIncomingBusyId] = useState<string | null>(null);
  const [incomingBusyAction, setIncomingBusyAction] = useState<'accept' | 'reject' | null>(null);
  const [viewerCanActAsDriver, setViewerCanActAsDriver] = useState(false);
  const [viewerDriverVk, setViewerDriverVk] = useState<'car' | 'motorcycle' | null>(null);

  const loadPreview = useCallback(async () => {
    const cityQ = (selectedCity || '').trim();
    if (!cityQ) {
      setPendingIncoming(0);
      setIncomingRequests([]);
      setFeedPreview([]);
      setFeedLoading(false);
      return;
    }
    if (!tok) {
      console.log('[muhabbet] preserving rows during reconnect');
      return;
    }
    setFeedLoading(true);
    try {
      const h = { Authorization: `Bearer ${tok}` };
      const localQ = new URLSearchParams({ city: cityQ, limit: '36', listing_scope: 'local' });
      const intercityQ = new URLSearchParams({ city: cityQ, limit: '36', listing_scope: 'intercity' });
      const [rInc, rFeed, rFeedIntercity] = await Promise.all([
        fetch(`${base}/muhabbet/match-requests/incoming?status=pending&limit=50`, { headers: h }),
        fetch(`${base}/muhabbet/listings/feed?${localQ.toString()}`, { headers: h }),
        fetch(`${base}/muhabbet/listings/feed?${intercityQ.toString()}`, { headers: h }),
      ]);
      if (rInc.status === 401 || rFeed.status === 401) {
        console.log('[muhabbet] preserving rows during reconnect');
        return;
      }
      {
        const di = (await rInc.json().catch(() => ({}))) as { success?: boolean; requests?: IncomingOfferRequest[] };
        if (rInc.ok && di.success && Array.isArray(di.requests)) {
          setPendingIncoming(di.requests.length);
          setIncomingRequests(di.requests.slice(0, 4));
        } else {
          console.log('[muhabbet] preserving rows during reconnect');
        }
      }
      {
        type FeedResponse = {
          success?: boolean;
          listings?: HomeFeedListing[];
          viewer_can_act_as_driver?: boolean;
          viewer_driver_vehicle_kind?: string | null;
        };
        const df = (await rFeed.json().catch(() => ({}))) as FeedResponse;
        const di = rFeedIntercity.ok ? ((await rFeedIntercity.json().catch(() => ({}))) as FeedResponse) : {};
        if (typeof df.viewer_can_act_as_driver === 'boolean') setViewerCanActAsDriver(df.viewer_can_act_as_driver);
        else if (typeof di.viewer_can_act_as_driver === 'boolean') setViewerCanActAsDriver(di.viewer_can_act_as_driver);
        const vkh = (df.viewer_driver_vehicle_kind || di.viewer_driver_vehicle_kind || '').toString().toLowerCase();
        setViewerDriverVk(vkh === 'motorcycle' ? 'motorcycle' : vkh === 'car' ? 'car' : null);
        if (rFeed.ok && df.success && Array.isArray(df.listings)) {
          const seen = new Set<string>();
          const merged = [...df.listings, ...(di.success && Array.isArray(di.listings) ? di.listings : [])]
            .filter((row) => {
              if (!row?.id || seen.has(row.id)) return false;
              seen.add(row.id);
              return true;
            })
            .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
          const list = merged.filter((row) => {
            const ls = (row.status || '').toLowerCase();
            if (ls === 'matched' || ls === 'closed' || ls === 'cancelled' || ls === 'pending_chat') return false;
            const st = (row.match_request_status || '').toLowerCase();
            if (st === 'accepted') return false;
            return true;
          });
          setFeedPreview(list.slice(0, 36));
        } else {
          console.log('[muhabbet] preserving rows during reconnect');
        }
      }
    } catch {
      console.log('[muhabbet] preserving rows during reconnect');
    } finally {
      setFeedLoading(false);
    }
  }, [base, tok, selectedCity]);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview, refreshNonce, selectedCity]);

  useEffect(() => {
    setWindowOffset(0);
  }, [feedPreview]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(ctaPulse, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(ctaPulse, { toValue: 0, duration: 1800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [ctaPulse]);

  const rotateWindow = useCallback(() => {
    const n = feedPreview.length;
    if (n <= VISIBLE_OFFERS) return;
    Animated.parallel([
      Animated.timing(listAnim, { toValue: 0.82, duration: 160, useNativeDriver: true }),
      Animated.timing(listSlide, { toValue: 8, duration: 160, useNativeDriver: true }),
    ]).start(() => {
      setWindowOffset((o) => (o + 1) % n);
      Animated.parallel([
        Animated.timing(listAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(listSlide, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start();
    });
  }, [feedPreview.length, listAnim, listSlide]);

  useEffect(() => {
    if (feedPreview.length <= VISIBLE_OFFERS) return;
    const t = setInterval(() => rotateWindow(), 8500);
    return () => clearInterval(t);
  }, [feedPreview.length, rotateWindow]);

  const visibleOffers = React.useMemo(() => {
    const n = feedPreview.length;
    if (n === 0) return [];
    const take = Math.min(VISIBLE_OFFERS, n);
    if (n <= take) return [...feedPreview];
    const out: HomeFeedListing[] = [];
    for (let k = 0; k < take; k++) {
      out.push(feedPreview[(windowOffset + k) % n]!);
    }
    return out;
  }, [feedPreview, windowOffset]);

  /** Yalnızca chip gösterimi — mevcut feed önbelleğinden türetilir (fetch/API yok). */
  const listingScopeCounts = React.useMemo(() => {
    let local = 0;
    let intercity = 0;
    for (const row of feedPreview) {
      const sc = String(row.listing_scope || 'local').toLowerCase();
      if (sc === 'intercity') intercity += 1;
      else local += 1;
    }
    return { local, intercity, total: feedPreview.length };
  }, [feedPreview]);

  const uidLo = (currentUserId || '').trim().toLowerCase();

  const openChatForAcceptedRequest = useCallback((conversationId: string, row: IncomingOfferRequest) => {
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
    router.push((s ? `/muhabbet-chat/${encodeURIComponent(conversationId)}?${s}` : `/muhabbet-chat/${encodeURIComponent(conversationId)}`) as Href);
  }, [router]);

  const respondIncomingRequest = useCallback(async (row: IncomingOfferRequest, action: 'accept' | 'reject') => {
    if (!requireToken() || !tok || incomingBusyId) return;
    setIncomingBusyId(row.id);
    setIncomingBusyAction(action);
    try {
      const res = await fetch(`${base}/muhabbet/match-requests/${encodeURIComponent(row.id)}/${action}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (handleUnauthorizedAndMaybeRedirect(res)) return;
      const d = (await res.json().catch(() => ({}))) as { success?: boolean; conversation_id?: string; detail?: string };
      if (!res.ok || !d.success) {
        Alert.alert('Talep', typeof d.detail === 'string' && d.detail ? d.detail : action === 'accept' ? 'Kabul edilemedi.' : 'Reddedilemedi.');
        return;
      }
      setIncomingRequests((rows) => rows.filter((x) => x.id !== row.id));
      setPendingIncoming((n) => Math.max(0, n - 1));
      void loadPreview();
      if (action === 'accept' && d.conversation_id) {
        openChatForAcceptedRequest(d.conversation_id, row);
      }
    } catch {
      Alert.alert('Talep', 'Bağlantı hatası.');
    } finally {
      setIncomingBusyId(null);
      setIncomingBusyAction(null);
    }
  }, [base, incomingBusyId, loadPreview, openChatForAcceptedRequest, requireToken, tok]);

  const sendHomeMatchRequest = useCallback(
    async (listingId: string, actorIntent: 'driver' | 'passenger') => {
      if (!requireToken() || !tok) return;
      setMatchBusyId(listingId);
      try {
        const res = await fetch(`${base}/muhabbet/listings/${encodeURIComponent(listingId)}/match-request`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: null, actor_intent: actorIntent }),
        });
        const d = (await res.json().catch(() => ({}))) as { success?: boolean; detail?: string };
        if (handleUnauthorizedAndMaybeRedirect(res) || !res.ok || !d.success) {
          Alert.alert('Talep', typeof d.detail === 'string' && d.detail ? d.detail : 'Talep gönderilemedi.');
          return;
        }
        Alert.alert('Talep', 'Talebin gönderildi.');
        void loadPreview();
      } catch {
        Alert.alert('Talep', 'Bağlantı hatası.');
      } finally {
        setMatchBusyId(null);
      }
    },
    [base, tok, requireToken, loadPreview]
  );

  const pulseStyle = {
    opacity: ctaPulse.interpolate({ inputRange: [0, 1], outputRange: [0.24, 0.48] }),
    transform: [{ scale: ctaPulse.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1.05] }) }],
  };

  const renderCreateSection = (
    scope: ListingScope,
    title: string,
    subtitle: string,
    driverSub: string,
    passengerSub: string,
  ) => {
    const driverCTALabel = scope === 'intercity' ? 'Şehirler arası sürücü teklifi aç' : 'Şehir içi sürücü teklifi aç';
    const passengerCTALabel = scope === 'intercity' ? 'Şehirler arası yolcu teklifi aç' : 'Şehir içi yolcu teklifi aç';
    const driverGrad =
      scope === 'intercity'
        ? (['#0c4a6e', '#1d4ed8', '#38bdf8'] as const)
        : (['#082f49', '#1e40af', '#60a5fa'] as const);
    const passengerGrad =
      scope === 'intercity'
        ? (['#9a3412', '#dc2626', '#fb923c'] as const)
        : (['#7c2d12', '#ea580c', '#fdba74'] as const);
    const sectionBadgeIcon =
      scope === 'intercity' ? ('airplane-outline' as const) : ('business-outline' as const);
    const sectionBadgeLabel = scope === 'intercity' ? 'Uzun yol' : 'Şehir içi';

    return (
      <View
        style={[
          styles.createSectionWrap,
          scope === 'intercity' ? styles.createSectionWrapInter : styles.createSectionWrapLocal,
        ]}
      >
        <LinearGradient
          colors={['rgba(255,255,255,0.97)', 'rgba(239,246,255,0.94)', 'rgba(255,247,237,0.5)']}
          locations={[0, 0.55, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.createSection}>
          <View style={styles.createSectionHeadRow}>
            <View style={[styles.sectionBadge, scope === 'intercity' ? styles.sectionBadgeInter : styles.sectionBadgeLocal]}>
              <Ionicons name={sectionBadgeIcon} size={13} color={scope === 'intercity' ? '#0369A1' : '#1D4ED8'} />
              <Text style={styles.sectionBadgeText}>{sectionBadgeLabel}</Text>
            </View>
          </View>
          <View style={styles.createSectionHead}>
            <Text style={styles.ctaSectionTitle}>{title}</Text>
            <Text style={styles.ctaSectionSubtitle}>{subtitle}</Text>
          </View>
          <View style={[styles.ctaRow, !tok && styles.ctaRowDim]}>
            <Pressable
              onPress={() => openDriver(scope)}
              style={({ pressed }) => [styles.ctaBig, styles.ctaBigDriver, pressed && styles.ctaPressed]}
              android_ripple={{ color: 'rgba(255,255,255,0.16)' }}
            >
              <Animated.View pointerEvents="none" style={[styles.ctaPulseGlow, styles.ctaPulseDriver, pulseStyle]} />
              <LinearGradient colors={[...driverGrad]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              <View style={styles.ctaShine} />
              <View style={styles.ctaBigInner}>
                <View style={styles.ctaRoleBadgeRow}>
                  <View style={[styles.ctaRolePill, styles.ctaRolePillDriver]}>
                    <Text style={styles.ctaRolePillTxt}>Sürücü</Text>
                  </View>
                </View>
                <View style={styles.ctaIconBubble}>
                  <Ionicons name="car-sport-outline" size={22} color="#FFFFFF" />
                </View>
                <Text style={styles.ctaBigTitle}>{driverCTALabel}</Text>
                <Text style={styles.ctaBigSub}>{driverSub}</Text>
              </View>
            </Pressable>
            <Pressable
              onPress={() => openPassenger(scope)}
              style={({ pressed }) => [styles.ctaBig, styles.ctaBigPassenger, pressed && styles.ctaPressed]}
              android_ripple={{ color: 'rgba(255,255,255,0.16)' }}
            >
              <Animated.View pointerEvents="none" style={[styles.ctaPulseGlow, styles.ctaPulsePassenger, pulseStyle]} />
              <LinearGradient colors={[...passengerGrad]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              <View style={styles.ctaShine} />
              <View style={styles.ctaBigInner}>
                <View style={styles.ctaRoleBadgeRow}>
                  <View style={[styles.ctaRolePill, styles.ctaRolePillPax]}>
                    <Text style={styles.ctaRolePillTxt}>Yolcu</Text>
                  </View>
                </View>
                <View style={styles.ctaIconBubble}>
                  <Ionicons name="person-outline" size={22} color="#FFFFFF" />
                </View>
                <Text style={styles.ctaBigTitle}>{passengerCTALabel}</Text>
                <Text style={styles.ctaBigSub}>{passengerSub}</Text>
              </View>
            </Pressable>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#bfdbfe', '#dbeafe', '#eff6ff']}
        locations={[0, 0.45, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <View pointerEvents="none" style={styles.patternLayer}>
        <View style={[styles.patternBlob, styles.patternBlob1]} />
        <View style={[styles.patternBlob, styles.patternBlob2]} />
        <View style={[styles.patternBlob, styles.patternBlob3]} />
      </View>
      <MuhabbetWatermark />
      <View style={styles.foreground}>
      <View style={styles.insetTop}>
        <View style={styles.heroShell}>
          <LinearGradient
            colors={['rgba(255,255,255,0.98)', '#EFF6FF', 'rgba(254,243,199,0.35)']}
            locations={[0, 0.55, 1]}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.95, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.heroDecorCircle} />
          <View style={styles.heroContent}>
            <View style={styles.heroEyebrow}>
              <LinearGradient
                colors={['rgba(37,99,235,0.14)', 'rgba(249,115,22,0.12)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.heroEyebrowGrad}
              >
                <Ionicons name="sparkles" size={14} color="#2563EB" />
                <Text style={styles.heroEyebrowText}>Leylek Muhabbeti</Text>
              </LinearGradient>
            </View>
            <Text style={styles.heroTitle}>Teklif aç, eşleş, güvenle yola çık</Text>
            <Text style={styles.heroSubtitle}>
              Şehir içi kısa rotalar ve şehirler arası uzun yol için tekliflerini oluştur; özetinden şehir ve talepleri takip et.
            </Text>
          </View>
        </View>

        <View style={styles.chipsWrap}>
          <View style={styles.statChip}>
            <Ionicons name="location" size={15} color="#1D4ED8" />
            <Text style={styles.statChipTxt} numberOfLines={1}>
              {selectedCity.trim() || 'Şehir'}
            </Text>
          </View>
          <View style={styles.statChip}>
            <Ionicons name="albums-outline" size={15} color="#0369A1" />
            <Text style={styles.statChipTxt}>{listingScopeCounts.total} açık</Text>
          </View>
          <View style={[styles.statChip, styles.statChipMuted]}>
            <Ionicons name="navigate-outline" size={14} color="#15803D" />
            <Text style={styles.statChipTxtMuted}>İç {listingScopeCounts.local}</Text>
          </View>
          <View style={[styles.statChip, styles.statChipMuted]}>
            <Ionicons name="airplane-outline" size={14} color="#C2410C" />
            <Text style={styles.statChipTxtMuted}>Arası {listingScopeCounts.intercity}</Text>
          </View>
          {pendingIncoming > 0 ? (
            <View style={[styles.statChip, styles.statChipAlert]}>
              <Ionicons name="notifications-outline" size={15} color="#C2410C" />
              <Text style={styles.statChipAlertTxt}>{pendingIncoming} talep</Text>
            </View>
          ) : null}
        </View>

        {renderCreateSection(
          'intercity',
          'Şehirler arası yol paylaşımı',
          'Kalkış ve varış şehrini seçerek uzun yol teklifi aç',
          'Uzun yol rotanı ve boş koltuğunu paylaş.',
          'Şehirler arası yolculuk talebini oluştur.',
        )}
        {renderCreateSection(
          'local',
          'Şehir içi yol paylaşımı',
          `${selectedCity} içinde kısa mesafe teklif aç`,
          'Rotanı ve koltuğu şehir içinde paylaş.',
          'Şehir içinde nereye gideceğini yaz.',
        )}
        {!tok ? <Text style={styles.ctaHint}>Teklif açmak için oturum açman yeterli — butona basınca yönlendirilirsin.</Text> : null}
      </View>

      <View style={styles.inset}>
        {incomingRequests.length > 0 ? (
          <View style={styles.incomingCompactBlock}>
            {incomingRequests.map((r) => {
              const name = (r.sender_user_name || r.sender_name || 'Biri').trim();
              const initial = name.charAt(0).toLocaleUpperCase('tr-TR') || 'L';
              const acceptBusy = incomingBusyId === r.id && incomingBusyAction === 'accept';
              const rejectBusy = incomingBusyId === r.id && incomingBusyAction === 'reject';
              return (
                <View key={r.id} style={styles.incomingRow}>
                  <View style={styles.incomingAvatar}>
                    <Text style={styles.incomingAvatarText}>{initial}</Text>
                  </View>
                  <Text style={styles.incomingRowText} numberOfLines={1}>
                    <Text style={styles.incomingName}>{name}</Text> teklifine beni de al dedi
                  </Text>
                  <View style={styles.incomingActions}>
                  <Pressable
                    style={({ pressed }) => [styles.incomingRejectBtn, pressed && { opacity: 0.82 }]}
                    disabled={!!incomingBusyId}
                    onPress={() => void respondIncomingRequest(r, 'reject')}
                  >
                    <Text style={styles.incomingRejectText}>{rejectBusy ? '...' : 'Red'}</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.incomingAcceptBtn, pressed && { opacity: 0.88 }]}
                    disabled={!!incomingBusyId}
                    onPress={() => void respondIncomingRequest(r, 'accept')}
                  >
                    {acceptBusy ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.incomingAcceptText}>Kabul</Text>}
                  </Pressable>
                  </View>
                </View>
              );
            })}
            {pendingIncoming > incomingRequests.length ? (
              <Pressable onPress={onOpenMatchRequests} disabled={!onOpenMatchRequests} style={styles.incomingMoreBtn}>
                <Text style={styles.incomingMoreText}>+{pendingIncoming - incomingRequests.length} talep daha</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <View style={[styles.summaryCard, styles.offersCardPad]}>
          <View style={styles.offersSectionHead}>
            <LinearGradient
              colors={['rgba(37,99,235,0.12)', 'rgba(249,115,22,0.08)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.offersIconBadge}
            >
              <Ionicons name="sparkles" size={18} color="#1D4ED8" />
            </LinearGradient>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.offersSectionTitle}>Günün teklifleri</Text>
              <Text style={styles.offersSectionHint}>Şehrindeki açık teklifler — liste hafifçe yenilenir</Text>
            </View>
          </View>
          <View style={styles.offersDivider} />
          {feedLoading ? (
            <View style={styles.skeletonWrap}>
              {[0, 1, 2, 3, 4].map((i) => (
                <View key={i} style={styles.skeletonCard}>
                  <View style={styles.skeletonAccent} />
                  <View style={styles.skeletonRow}>
                    <View style={styles.skeletonPill} />
                    <View style={styles.skeletonPillShort} />
                  </View>
                  <View style={styles.skeletonLine} />
                  <View style={[styles.skeletonLine, { width: '68%' }]} />
                  <View style={styles.skeletonCta} />
                </View>
              ))}
            </View>
          ) : null}
          {!feedLoading && visibleOffers.length === 0 ? (
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIconRing}>
                <Ionicons name="earth-outline" size={42} color="#2563EB" />
              </View>
              <Text style={styles.emptyTitle}>Henüz liste görünmüyor</Text>
              <Text style={styles.emptySub}>
                Yukarıdan bir teklif türü seçerek başlayabilir veya veri geldiğinde burada günün tekliflerini görebilirsin.
              </Text>
              <Text style={styles.emptyHint}>Henüz teklif yok — teklif açarak başlat.</Text>
            </View>
          ) : null}
          {!feedLoading && visibleOffers.length > 0 ? (
            <Animated.View
              style={{
                opacity: listAnim,
                transform: [{ translateY: listSlide }],
              }}
            >
              {visibleOffers.map((L) => {
                const drvOffer = offerKindFromHomeListing(L) === 'driver_offer';
                const actor = drvOffer ? ('passenger' as const) : ('driver' as const);
                const effVk = viewerDriverVk ?? (viewerCanActAsDriver ? 'car' : null);
                const vehicleOk =
                  drvOffer ||
                  !viewerCanActAsDriver ||
                  effVk === null ||
                  homeListingVehicleKind(L) === effVk;
                return (
                <CompactOfferCard
                  key={L.id}
                  item={L}
                  onPressCard={() => onOpenListingsForListing?.(L.id)}
                  onPressCta={() => void sendHomeMatchRequest(L.id, actor)}
                  ctaLabel={
                    drvOffer
                      ? viewerCanActAsDriver
                        ? 'Yolcu olarak beni de al'
                        : 'Beni de al'
                      : 'Bu yolcuya talibim'
                  }
                  ctaBusy={matchBusyId === L.id}
                  ctaDisabled={
                    !tok ||
                    String(L.created_by_user_id || '')
                      .trim()
                      .toLowerCase() === uidLo ||
                    ['pending', 'accepted'].includes((L.match_request_status || '').toLowerCase()) ||
                    (!drvOffer && (!viewerCanActAsDriver || !vehicleOk))
                  }
                />
                );
              })}
            </Animated.View>
          ) : null}
        </View>
      </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, position: 'relative', overflow: 'hidden', backgroundColor: '#EFF6FF' },
  foreground: { flex: 1, zIndex: 2 },
  patternLayer: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  patternBlob: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.55,
  },
  patternBlob1: {
    width: 200,
    height: 200,
    top: -50,
    right: -60,
    backgroundColor: 'rgba(255,255,255,0.42)',
  },
  patternBlob2: {
    width: 140,
    height: 140,
    bottom: 120,
    left: -40,
    backgroundColor: 'rgba(59,130,246,0.14)',
  },
  patternBlob3: {
    width: 100,
    height: 100,
    bottom: -20,
    right: 40,
    backgroundColor: 'rgba(249,115,22,0.1)',
  },
  insetTop: { paddingHorizontal: 16, paddingTop: 4 },
  inset: { paddingHorizontal: 16, marginTop: 12, paddingBottom: 8 },
  heroShell: {
    borderRadius: 28,
    overflow: 'hidden',
    marginBottom: 14,
    position: 'relative',
    ...Platform.select({
      ios: {
        shadowColor: '#1e3a8a',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.14,
        shadowRadius: 24,
      },
      android: { elevation: 6 },
      default: {},
    }),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.85)',
  },
  heroDecorCircle: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(59,130,246,0.12)',
    top: -36,
    right: -28,
  },
  heroContent: { paddingHorizontal: 18, paddingVertical: 20, zIndex: 1 },
  heroEyebrow: { marginBottom: 10 },
  heroEyebrowGrad: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(59,130,246,0.2)',
  },
  heroEyebrowText: { fontSize: 11.5, fontWeight: '900', color: '#1D4ED8', letterSpacing: 0.6 },
  heroTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: TEXT_PRIMARY,
    letterSpacing: -0.5,
    lineHeight: 28,
  },
  heroSubtitle: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_SECONDARY,
    lineHeight: 21,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(59,130,246,0.18)',
    maxWidth: '100%',
  },
  statChipMuted: {
    backgroundColor: 'rgba(248,250,252,0.95)',
    borderColor: 'rgba(148,163,184,0.35)',
  },
  statChipAlert: {
    backgroundColor: 'rgba(255,247,237,0.96)',
    borderColor: 'rgba(249,115,22,0.35)',
  },
  statChipTxt: { fontSize: 12.5, fontWeight: '800', color: TEXT_PRIMARY, flexShrink: 1 },
  statChipTxtMuted: { fontSize: 12, fontWeight: '800', color: '#475569' },
  statChipAlertTxt: { fontSize: 12.5, fontWeight: '900', color: '#C2410C' },
  createSectionWrap: {
    marginBottom: 18,
    borderRadius: 28,
    overflow: 'hidden',
    position: 'relative',
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.08,
        shadowRadius: 22,
      },
      android: { elevation: 5 },
      default: {},
    }),
  },
  createSectionWrapInter: {
    borderLeftWidth: 4,
    borderLeftColor: '#0284c7',
  },
  createSectionWrapLocal: {
    borderLeftWidth: 4,
    borderLeftColor: '#2563eb',
  },
  createSection: {
    padding: 14,
    borderRadius: 26,
    position: 'relative',
    zIndex: 1,
  },
  createSectionHeadRow: { marginBottom: 8 },
  sectionBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sectionBadgeInter: {
    backgroundColor: 'rgba(14,165,233,0.1)',
    borderColor: 'rgba(14,165,233,0.35)',
  },
  sectionBadgeLocal: {
    backgroundColor: 'rgba(37,99,235,0.08)',
    borderColor: 'rgba(37,99,235,0.28)',
  },
  sectionBadgeText: { fontSize: 11, fontWeight: '900', letterSpacing: 0.35 },
  ctaSectionTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: TEXT_PRIMARY,
    letterSpacing: 0.45,
    textTransform: 'uppercase',
  },
  ctaSectionSubtitle: { marginTop: 4, fontSize: 12.5, fontWeight: '700', color: TEXT_SECONDARY, lineHeight: 17 },
  ctaRow: { flexDirection: 'row', gap: 10, marginBottom: 2 },
  ctaRowDim: { opacity: 0.92 },
  ctaHint: { fontSize: 13, color: TEXT_SECONDARY, marginTop: 6, lineHeight: 18 },
  ctaBig: {
    flex: 1,
    minHeight: 148,
    minWidth: 0,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.38)',
    ...CTA_CARD_SHADOW,
  },
  ctaBigDriver: { shadowColor: '#1D4ED8' },
  ctaBigPassenger: { shadowColor: '#EA580C' },
  ctaPulseGlow: {
    position: 'absolute',
    left: -14,
    right: -14,
    top: -14,
    bottom: -14,
    borderRadius: 32,
    zIndex: 1,
  },
  ctaPulseDriver: { backgroundColor: 'rgba(96,165,250,0.42)' },
  ctaPulsePassenger: { backgroundColor: 'rgba(251,146,60,0.4)' },
  ctaShine: {
    position: 'absolute',
    top: -42,
    right: -32,
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: 'rgba(255,255,255,0.16)',
    zIndex: 2,
  },
  ctaPressed: { transform: [{ scale: 0.96 }] },
  ctaBigInner: {
    flex: 1,
    minHeight: 152,
    paddingVertical: 12,
    paddingHorizontal: 10,
    justifyContent: 'flex-start',
    zIndex: 3,
  },
  ctaRoleBadgeRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 6 },
  ctaRolePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  ctaRolePillDriver: { backgroundColor: 'rgba(0,0,0,0.2)' },
  ctaRolePillPax: { backgroundColor: 'rgba(0,0,0,0.2)' },
  ctaRolePillTxt: { fontSize: 10.5, fontWeight: '900', color: '#fff', letterSpacing: 0.4 },
  ctaIconBubble: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    marginTop: 2,
  },
  ctaBigTitle: { fontSize: 13.5, fontWeight: '900', color: '#fff', marginTop: 8, letterSpacing: -0.15, lineHeight: 18 },
  ctaBigSub: { fontSize: 12.5, color: 'rgba(255,255,255,0.93)', marginTop: 5, lineHeight: 17 },
  offersSectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  offersIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(59,130,246,0.2)',
  },
  offersCardPad: { paddingBottom: 18 },
  offersSectionTitle: { fontSize: 20, fontWeight: '900', color: TEXT_PRIMARY, letterSpacing: -0.35 },
  offersDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(148,163,184,0.35)',
    marginBottom: 14,
    borderRadius: 999,
  },
  skeletonWrap: { gap: 12 },
  skeletonCard: {
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(148,163,184,0.35)',
    padding: 14,
    overflow: 'hidden',
  },
  skeletonAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: 'rgba(148,163,184,0.45)',
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
  },
  skeletonRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  skeletonPill: {
    width: 72,
    height: 22,
    borderRadius: 999,
    backgroundColor: 'rgba(203,213,225,0.95)',
  },
  skeletonPillShort: {
    width: 48,
    height: 22,
    borderRadius: 999,
    backgroundColor: 'rgba(226,232,240,0.95)',
  },
  skeletonLine: {
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(226,232,240,0.95)',
    width: '100%',
    marginBottom: 8,
  },
  skeletonCta: {
    height: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(203,213,225,0.85)',
    marginTop: 4,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  emptyIconRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(59,130,246,0.1)',
    borderWidth: 2,
    borderColor: 'rgba(59,130,246,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: { fontSize: 18, fontWeight: '900', color: TEXT_PRIMARY, letterSpacing: -0.3, textAlign: 'center' },
  emptySub: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_SECONDARY,
    lineHeight: 21,
    textAlign: 'center',
  },
  emptyHint: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: '700',
    color: '#2563EB',
    textAlign: 'center',
  },
  summaryCard: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 22,
    padding: 18,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(59,130,246,0.12)',
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.08,
        shadowRadius: 22,
      },
      android: { elevation: 5 },
      default: {},
    }),
  },
  incomingCompactBlock: {
    gap: 7,
    marginBottom: 12,
  },
  incomingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: 'rgba(255, 251, 247, 0.96)',
    borderRadius: 18,
    paddingVertical: 8,
    paddingLeft: 10,
    paddingRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(251, 146, 60, 0.22)',
    shadowColor: '#9A3412',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  incomingAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FED7AA',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.24)',
  },
  incomingAvatarText: { color: '#C2410C', fontSize: 13, fontWeight: '900' },
  incomingRowText: { flex: 1, minWidth: 0, fontSize: 12.5, color: TEXT_PRIMARY, fontWeight: '700', lineHeight: 17 },
  incomingName: { fontWeight: '900', color: '#111827' },
  incomingActions: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
  incomingRejectBtn: {
    borderRadius: 999,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  incomingRejectText: { color: '#6B7280', fontSize: 11.5, fontWeight: '900' },
  incomingAcceptBtn: {
    minWidth: 56,
    borderRadius: 999,
    backgroundColor: '#F97316',
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
    shadowColor: '#EA580C',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 5,
    elevation: 3,
  },
  incomingAcceptText: { color: '#FFFFFF', fontSize: 11.5, fontWeight: '900' },
  incomingMoreBtn: { alignSelf: 'flex-start', paddingHorizontal: 4, paddingVertical: 2 },
  incomingMoreText: { color: '#2563EB', fontSize: 12, fontWeight: '900' },
});
