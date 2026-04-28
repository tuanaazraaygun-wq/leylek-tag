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

const PRIMARY_GRAD = ['#3B82F6', '#60A5FA'] as const;
const TEXT_PRIMARY = '#111111';
const TEXT_SECONDARY = '#6E6E73';
const CARD_BG = '#FFFFFF';
const VISIBLE_OFFERS = 10;
const CARD_SHADOW = Platform.select({
  ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 10 },
  android: { elevation: 3 },
  default: {},
});
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
  const glow = isDriver ? 'rgba(59,130,246,0.38)' : 'rgba(245,158,11,0.36)';
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

  return (
    <Pressable
      onPress={onPressCard}
      style={({ pressed }) => [{ opacity: pressed ? 0.96 : 1 }, cs.slot]}
      android_ripple={{ color: 'rgba(0,0,0,0.06)' }}
    >
      <View style={[cs.glow, { shadowColor: glow }]} />
      <View style={cs.card}>
        <View style={cs.row1}>
          <View style={[cs.pill, { backgroundColor: isDriver ? 'rgba(59,130,246,0.14)' : 'rgba(245,158,11,0.18)' }]}>
            <Text style={[cs.pillTxt, { color: isDriver ? '#1D4ED8' : '#C2410C' }]}>{roleLabel}</Text>
          </View>
          <View style={cs.pillGreen}>
            <Text style={cs.pillGreenTxt}>{transport}</Text>
          </View>
          {isIntercity ? (
            <View style={cs.scopePill}>
              <Text style={cs.scopePillTxt}>Şehirler arası</Text>
            </View>
          ) : null}
          <Text style={cs.price}>{priceStr}</Text>
        </View>
        {isIntercity && originCity && destinationCity ? (
          <Text style={cs.cityRoute} numberOfLines={1}>
            {originCity} → {destinationCity}
          </Text>
        ) : null}
        <View style={cs.routeRow}>
          <View style={cs.miniCol}>
            <Text style={cs.tagG}>NEREDEN</Text>
            <Text style={cs.place} numberOfLines={1}>
              {from}
            </Text>
          </View>
          <Ionicons name="arrow-forward" size={14} color="#9CA3AF" style={{ marginHorizontal: 6 }} />
          <View style={cs.miniCol}>
            <Text style={cs.tagG}>NEREYE</Text>
            <Text style={cs.place} numberOfLines={1}>
              {to}
            </Text>
          </View>
        </View>
        <Text style={cs.creatorLine} numberOfLines={1}>
          {creatorPublic}
        </Text>
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
            pressed && !ctaDisabled && !ctaBusy && { opacity: 0.9 },
          ]}
        >
          {ctaBusy ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={cs.ctaTxt}>{ctaLabel}</Text>
          )}
        </Pressable>
      </View>
    </Pressable>
  );
}

const cs = StyleSheet.create({
  slot: { position: 'relative', marginBottom: 8 },
  glow: {
    position: 'absolute',
    left: -1,
    right: -1,
    top: -1,
    bottom: -1,
    borderRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 3,
  },
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    ...CARD_SHADOW,
  },
  row1: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  pillTxt: { fontSize: 11, fontWeight: '800' },
  pillGreen: {
    backgroundColor: 'rgba(22, 163, 74, 0.14)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(22, 163, 74, 0.35)',
  },
  pillGreenTxt: { fontSize: 10, fontWeight: '800', color: '#15803D' },
  scopePill: {
    backgroundColor: 'rgba(14, 165, 233, 0.14)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(14, 165, 233, 0.34)',
  },
  scopePillTxt: { fontSize: 10, fontWeight: '900', color: '#0369A1' },
  price: { marginLeft: 'auto', fontSize: 14, fontWeight: '800', color: '#374151' },
  cityRoute: { marginBottom: 8, fontSize: 13, fontWeight: '900', color: '#0F172A' },
  routeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  miniCol: { flex: 1, minWidth: 0 },
  tagG: { fontSize: 9, fontWeight: '800', color: '#15803D', marginBottom: 2 },
  place: { fontSize: 13, fontWeight: '700', color: '#111' },
  cta: {
    alignSelf: 'stretch',
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaDriver: { backgroundColor: '#2563EB' },
  ctaPassenger: { backgroundColor: '#EA580C' },
  ctaTxt: { color: '#fff', fontSize: 13, fontWeight: '800' },
  creatorLine: { marginBottom: 8, fontSize: 12, color: '#6B7280', fontWeight: '700' },
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
      Animated.timing(listAnim, { toValue: 0.82, duration: 140, useNativeDriver: true }),
      Animated.timing(listSlide, { toValue: 4, duration: 140, useNativeDriver: true }),
    ]).start(() => {
      setWindowOffset((o) => (o + 1) % n);
      Animated.parallel([
        Animated.timing(listAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(listSlide, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    });
  }, [feedPreview.length, listAnim, listSlide]);

  useEffect(() => {
    if (feedPreview.length <= VISIBLE_OFFERS) return;
    const t = setInterval(() => rotateWindow(), 7000);
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
    opacity: ctaPulse.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.34] }),
    transform: [{ scale: ctaPulse.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1.04] }) }],
  };

  const renderCreateSection = (
    scope: ListingScope,
    title: string,
    subtitle: string,
    driverSub: string,
    passengerSub: string,
  ) => (
    <View style={styles.createSection}>
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
          <LinearGradient colors={['#0B2B6F', '#1D4ED8', '#38BDF8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <View style={styles.ctaShine} />
          <View style={styles.ctaBigInner}>
            <View style={styles.ctaIconBubble}>
              <Text style={styles.ctaBigEmoji}>🚗</Text>
            </View>
            <Text style={styles.ctaBigTitle}>Sürücü teklifi aç</Text>
            <Text style={styles.ctaBigSub}>{driverSub}</Text>
          </View>
        </Pressable>
        <Pressable
          onPress={() => openPassenger(scope)}
          style={({ pressed }) => [styles.ctaBig, styles.ctaBigPassenger, pressed && styles.ctaPressed]}
          android_ripple={{ color: 'rgba(255,255,255,0.16)' }}
        >
          <Animated.View pointerEvents="none" style={[styles.ctaPulseGlow, styles.ctaPulsePassenger, pulseStyle]} />
          <LinearGradient colors={['#7C2D12', '#C2410C', '#F97316']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <View style={styles.ctaShine} />
          <View style={styles.ctaBigInner}>
            <View style={styles.ctaIconBubble}>
              <Text style={styles.ctaBigEmoji}>🧍</Text>
            </View>
            <Text style={styles.ctaBigTitle}>Yolcu teklifi aç</Text>
            <Text style={styles.ctaBigSub}>{passengerSub}</Text>
          </View>
        </Pressable>
      </View>
    </View>
  );

  return (
    <View style={styles.root}>
      <MuhabbetWatermark />
      <View style={styles.insetTop}>
        {renderCreateSection(
          'local',
          'Şehir içi yol paylaşımı',
          `${selectedCity} içinde kısa mesafe teklif aç`,
          'Rotanı ve koltuğu şehir içinde paylaş.',
          'Şehir içinde nereye gideceğini yaz.',
        )}
        {renderCreateSection(
          'intercity',
          'Şehirler arası yol paylaşımı',
          'Kalkış ve varış şehrini seçerek uzun yol teklifi aç',
          'Uzun yol rotanı ve boş koltuğunu paylaş.',
          'Şehirler arası yolculuk talebini oluştur.',
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
          <Text style={styles.offersSectionTitle}>Günün teklifleri</Text>
          <Text style={styles.offersSectionHint}>Şehrindeki açık teklifler — liste hafifçe yenilenir</Text>
          {feedLoading ? <ActivityIndicator color={PRIMARY_GRAD[0]} style={{ marginVertical: 8 }} /> : null}
          {!feedLoading && visibleOffers.length === 0 ? (
            <Text style={styles.offersEmpty}>Henüz teklif yok — teklif açarak başlat.</Text>
          ) : !feedLoading ? (
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
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, position: 'relative' },
  insetTop: { paddingHorizontal: 16, paddingTop: 4, zIndex: 1 },
  inset: { paddingHorizontal: 16, marginTop: 12, zIndex: 1 },
  createSection: {
    marginBottom: 14,
    padding: 12,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(148,163,184,0.22)',
    ...CARD_SHADOW,
  },
  createSectionHead: { marginBottom: 10 },
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
    minHeight: 136,
    minWidth: 0,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
    ...CTA_CARD_SHADOW,
  },
  ctaBigDriver: { shadowColor: '#1D4ED8' },
  ctaBigPassenger: { shadowColor: '#C2410C' },
  ctaPulseGlow: {
    position: 'absolute',
    left: -12,
    right: -12,
    top: -12,
    bottom: -12,
    borderRadius: 28,
    zIndex: 1,
  },
  ctaPulseDriver: { backgroundColor: 'rgba(96,165,250,0.36)' },
  ctaPulsePassenger: { backgroundColor: 'rgba(251,146,60,0.34)' },
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
  ctaPressed: { transform: [{ scale: 0.98 }] },
  ctaBigInner: {
    flex: 1,
    minHeight: 136,
    paddingVertical: 16,
    paddingHorizontal: 12,
    justifyContent: 'center',
    zIndex: 3,
  },
  ctaIconBubble: {
    width: 38,
    height: 38,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  ctaBigEmoji: { fontSize: 22, color: '#fff', fontWeight: '800' },
  ctaBigTitle: { fontSize: 16, fontWeight: '900', color: '#fff', marginTop: 10, letterSpacing: -0.2 },
  ctaBigSub: { fontSize: 13, color: 'rgba(255,255,255,0.92)', marginTop: 4, lineHeight: 18 },
  offersCardPad: { paddingBottom: 18 },
  offersSectionTitle: { fontSize: 19, fontWeight: '800', color: TEXT_PRIMARY },
  offersSectionHint: { fontSize: 13, color: TEXT_SECONDARY, marginTop: 4, marginBottom: 8, lineHeight: 18 },
  offersEmpty: { fontSize: 17, color: TEXT_SECONDARY, lineHeight: 24, marginTop: 4 },
  summaryCard: { backgroundColor: CARD_BG, borderRadius: 18, padding: 16, marginBottom: 12, ...CARD_SHADOW },
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
