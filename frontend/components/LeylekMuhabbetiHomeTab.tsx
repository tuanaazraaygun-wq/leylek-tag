/**
 * Leylek Muhabbeti — Ana Sayfa sekmesi: şehir özeti, teklif CTA, günün teklifleri önizlemesi.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
  Alert,
} from 'react-native';
import { handleUnauthorizedAndMaybeRedirect } from '../lib/muhabbetAuthRedirect';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import MuhabbetWatermark from './MuhabbetWatermark';

const PRIMARY_GRAD = ['#3B82F6', '#60A5FA'] as const;
const ACCENT = '#F59E0B';
const TEXT_PRIMARY = '#111111';
const TEXT_SECONDARY = '#6E6E73';
const CARD_BG = '#FFFFFF';
const CARD_SHADOW = Platform.select({
  ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 10 },
  android: { elevation: 3 },
  default: {},
});

type HomeFeedListing = {
  id: string;
  from_text?: string | null;
  to_text?: string | null;
  role_type?: string | null;
  price_amount?: number | null;
  transport_label?: string | null;
  vehicle_kind?: string | null;
  match_request_status?: string | null;
  created_by_user_id?: string | null;
  status?: string | null;
};

function isDriverRole(r: string | null | undefined): boolean {
  const x = (r || '').toLowerCase();
  return x === 'driver' || x === 'private_driver';
}

type CompactOfferProps = {
  item: HomeFeedListing;
  fade: Animated.Value;
  onPressCard: () => void;
  onPressCta: () => void;
  ctaLabel: string;
  ctaDisabled: boolean;
  ctaBusy: boolean;
};

function CompactOfferSlide({ item, fade, onPressCard, onPressCta, ctaLabel, ctaDisabled, ctaBusy }: CompactOfferProps) {
  const isDriver = isDriverRole(item.role_type);
  const glow = isDriver ? 'rgba(59,130,246,0.42)' : 'rgba(245,158,11,0.4)';
  const from = (item.from_text || '—').toString().trim() || '—';
  const to = (item.to_text || '—').toString().trim() || '—';
  const priceStr =
    item.price_amount != null && !Number.isNaN(Number(item.price_amount))
      ? `${Number(item.price_amount).toLocaleString('tr-TR')} ₺`
      : '—';
  const vk = (item.vehicle_kind || '').toLowerCase();
  const transport =
    (item.transport_label && String(item.transport_label).trim()) ||
    (vk === 'motor' || vk === 'motorcycle' ? 'Motor' : 'Araç');
  const roleLabel = isDriver ? 'Sürücü' : 'Yolcu';

  return (
    <Animated.View style={{ opacity: fade }}>
      <Pressable onPress={onPressCard} style={({ pressed }) => [{ opacity: pressed ? 0.94 : 1 }]}>
        <View style={cs.slot}>
          <View style={[cs.glow, { shadowColor: glow }]} />
          <View style={cs.card}>
            <View style={cs.row1}>
              <View style={[cs.pill, { backgroundColor: isDriver ? 'rgba(59,130,246,0.14)' : 'rgba(245,158,11,0.18)' }]}>
                <Text style={[cs.pillTxt, { color: isDriver ? '#1D4ED8' : '#C2410C' }]}>{roleLabel}</Text>
              </View>
              <View style={cs.pillGreen}>
                <Text style={cs.pillGreenTxt}>{transport}</Text>
              </View>
              <Text style={cs.price}>{priceStr}</Text>
            </View>
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
                pressed && !ctaDisabled && !ctaBusy && { opacity: 0.88 },
              ]}
            >
              {ctaBusy ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={cs.ctaTxt}>{ctaLabel}</Text>
              )}
            </Pressable>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const cs = StyleSheet.create({
  slot: { position: 'relative', marginBottom: 4 },
  glow: {
    position: 'absolute',
    left: -2,
    right: -2,
    top: -2,
    bottom: -2,
    borderRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 10,
    elevation: 4,
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
  price: { marginLeft: 'auto', fontSize: 14, fontWeight: '800', color: '#374151' },
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
});

export type LeylekMuhabbetiHomeTabProps = {
  apiUrl: string;
  accessToken: string;
  selectedCity: string;
  refreshNonce: number;
  onOpenListingsCreate: () => void;
  onOpenDriverListing?: () => void;
  onOpenPassengerListing?: () => void;
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
  const openDriver = onOpenDriverListing ?? onOpenListingsCreate;
  const openPassenger = onOpenPassengerListing ?? onOpenListingsCreate;
  const tok = accessToken.trim();
  const base = apiUrl.replace(/\/$/, '');
  const ctaPulse = useRef(new Animated.Value(1)).current;
  const slideFade = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(ctaPulse, {
          toValue: 0.94,
          duration: 2200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(ctaPulse, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [ctaPulse]);

  const [pendingIncoming, setPendingIncoming] = useState(0);
  const [feedPreview, setFeedPreview] = useState<HomeFeedListing[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [carouselIdx, setCarouselIdx] = useState(0);
  const [matchBusyId, setMatchBusyId] = useState<string | null>(null);

  const loadPreview = useCallback(async () => {
    const cityQ = (selectedCity || '').trim();
    if (!cityQ) {
      setPendingIncoming(0);
      setFeedPreview([]);
      setFeedLoading(false);
      return;
    }
    if (!tok) {
      setPendingIncoming(0);
      setFeedPreview([]);
      return;
    }
    setFeedLoading(true);
    try {
      const h = { Authorization: `Bearer ${tok}` };
      const u = new URLSearchParams({ city: cityQ, limit: '12' });
      const [rInc, rFeed] = await Promise.all([
        fetch(`${base}/muhabbet/match-requests/incoming?status=pending&limit=50`, { headers: h }),
        fetch(`${base}/muhabbet/listings/feed?${u.toString()}`, { headers: h }),
      ]);
      if (handleUnauthorizedAndMaybeRedirect(rInc) || handleUnauthorizedAndMaybeRedirect(rFeed)) {
        setPendingIncoming(0);
        setFeedPreview([]);
        return;
      }
      {
        const di = (await rInc.json().catch(() => ({}))) as { success?: boolean; requests?: unknown[] };
        if (rInc.ok && di.success && Array.isArray(di.requests)) setPendingIncoming(di.requests.length);
        else setPendingIncoming(0);
      }
      {
        const df = (await rFeed.json().catch(() => ({}))) as { success?: boolean; listings?: HomeFeedListing[] };
        if (rFeed.ok && df.success && Array.isArray(df.listings)) {
          const list = df.listings.filter((row) => {
            const ls = (row.status || '').toLowerCase();
            if (ls === 'matched' || ls === 'closed' || ls === 'cancelled') return false;
            const st = (row.match_request_status || '').toLowerCase();
            if (st === 'accepted') return false;
            return true;
          });
          setFeedPreview(list.slice(0, 12));
        } else setFeedPreview([]);
      }
    } catch {
      setPendingIncoming(0);
      setFeedPreview([]);
    } finally {
      setFeedLoading(false);
    }
  }, [base, tok, selectedCity]);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview, refreshNonce, selectedCity]);

  useEffect(() => {
    setCarouselIdx(0);
  }, [feedPreview]);

  useEffect(() => {
    if (feedPreview.length <= 1) return;
    const t = setInterval(() => {
      Animated.timing(slideFade, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start(() => {
        setCarouselIdx((i) => (i + 1) % feedPreview.length);
        Animated.timing(slideFade, { toValue: 1, duration: 280, useNativeDriver: true }).start();
      });
    }, 5200);
    return () => clearInterval(t);
  }, [feedPreview.length, slideFade]);

  const uidLo = (currentUserId || '').trim().toLowerCase();
  const vr = (viewerAppRole || '').trim().toLowerCase();
  const viewerIsDriver = vr === 'driver' || vr === 'private_driver';

  const sendHomeMatchRequest = useCallback(
    async (listingId: string) => {
      if (!requireToken() || !tok) return;
      setMatchBusyId(listingId);
      try {
        const res = await fetch(`${base}/muhabbet/listings/${encodeURIComponent(listingId)}/match-request`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: null }),
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

  const activeSlide =
    feedPreview.length > 0 ? feedPreview[carouselIdx % feedPreview.length] : null;

  return (
    <View style={styles.root}>
      <MuhabbetWatermark />
      <View style={styles.hero}>
        <LinearGradient colors={[...PRIMARY_GRAD]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <Text style={styles.heroEyebrow}>Şehrin</Text>
        <Text style={styles.heroCity}>{selectedCity}</Text>
      </View>

      <View style={styles.insetTight}>
        <Text style={styles.ctaSectionTitle}>Teklif aç</Text>
        <View style={[styles.ctaRow, !tok && styles.ctaRowDim]}>
          <Animated.View style={[styles.ctaBig, { opacity: ctaPulse }]}>
            <TouchableOpacity style={styles.ctaBigInner} onPress={openDriver} activeOpacity={0.9}>
              <LinearGradient colors={[...PRIMARY_GRAD]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              <Text style={styles.ctaBigEmoji}>🚗</Text>
              <Text style={styles.ctaBigTitle}>Sürücü teklifi aç</Text>
              <Text style={styles.ctaBigSub}>Rotanı ve koltuğu paylaş.</Text>
            </TouchableOpacity>
          </Animated.View>
          <Animated.View style={[styles.ctaBig, { opacity: ctaPulse }]}>
            <TouchableOpacity style={styles.ctaBigInner} onPress={openPassenger} activeOpacity={0.9}>
              <LinearGradient colors={['#F59E0B', '#FBBF24']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              <Text style={styles.ctaBigEmoji}>🧍</Text>
              <Text style={styles.ctaBigTitle}>Yolcu teklifi aç</Text>
              <Text style={styles.ctaBigSub}>Nereye gideceğini yaz.</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
        {!tok ? <Text style={styles.ctaHint}>Teklif açmak için oturum açman yeterli — butona basınca yönlendirilirsin.</Text> : null}
      </View>

      <View style={styles.inset}>
        {pendingIncoming > 0 ? (
          <Pressable
            onPress={onOpenMatchRequests}
            disabled={!onOpenMatchRequests}
            style={({ pressed }) => [styles.alertCard, pressed && onOpenMatchRequests && { opacity: 0.92 }]}
          >
            <Ionicons name="notifications-outline" size={22} color={ACCENT} />
            <Text style={styles.alertText}>
              {pendingIncoming} bekleyen talebin var. Gelen talepleri görmek için dokun.
            </Text>
          </Pressable>
        ) : null}

        <View style={[styles.summaryCard, styles.offersCardPad]}>
          <Text style={styles.offersSectionTitle}>Günün teklifleri</Text>
          <Text style={styles.offersSectionHint}>Şehrindeki açık teklifler — kaydırarak örnekler değişir</Text>
          {feedLoading ? <ActivityIndicator color={PRIMARY_GRAD[0]} style={{ marginVertical: 8 }} /> : null}
          {!feedLoading && !activeSlide ? (
            <Text style={styles.offersEmpty}>Henüz teklif yok — teklif açarak başlat.</Text>
          ) : activeSlide ? (
            <CompactOfferSlide
              item={activeSlide}
              fade={slideFade}
              onPressCard={() => onOpenListingsForListing?.(activeSlide.id)}
              onPressCta={() => void sendHomeMatchRequest(activeSlide.id)}
              ctaLabel={isDriverRole(activeSlide.role_type) ? 'Beni de al' : 'Bu yolcuya talibim'}
              ctaBusy={matchBusyId === activeSlide.id}
              ctaDisabled={
                !tok ||
                String(activeSlide.created_by_user_id || '')
                  .trim()
                  .toLowerCase() === uidLo ||
                ['pending', 'accepted'].includes((activeSlide.match_request_status || '').toLowerCase()) ||
                (isDriverRole(activeSlide.role_type) ? viewerIsDriver : !viewerIsDriver)
              }
            />
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, position: 'relative' },
  hero: {
    marginHorizontal: 16,
    marginTop: 4,
    borderRadius: 20,
    paddingVertical: 22,
    paddingHorizontal: 16,
    overflow: 'hidden',
    alignItems: 'center',
    ...CARD_SHADOW,
  },
  heroEyebrow: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600', textAlign: 'center' },
  heroCity: { color: '#fff', fontSize: 32, fontWeight: '800', marginTop: 6, textAlign: 'center' },
  inset: { paddingHorizontal: 16, marginTop: 12, zIndex: 1 },
  insetTight: { paddingHorizontal: 16, marginTop: 6, zIndex: 1 },
  ctaSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    letterSpacing: 0.3,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  ctaRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  ctaRowDim: { opacity: 0.92 },
  ctaHint: { fontSize: 13, color: TEXT_SECONDARY, marginTop: 6, lineHeight: 18 },
  ctaBig: {
    flex: 1,
    minHeight: 132,
    borderRadius: 18,
    overflow: 'hidden',
    ...CARD_SHADOW,
  },
  ctaBigInner: {
    flex: 1,
    minHeight: 132,
    paddingVertical: 18,
    paddingHorizontal: 12,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  ctaBigEmoji: { fontSize: 24, color: '#fff', fontWeight: '800' },
  ctaBigTitle: { fontSize: 16, fontWeight: '800', color: '#fff', marginTop: 6 },
  ctaBigSub: { fontSize: 13, color: 'rgba(255,255,255,0.92)', marginTop: 4, lineHeight: 18 },
  offersCardPad: { paddingBottom: 18 },
  offersSectionTitle: { fontSize: 19, fontWeight: '800', color: TEXT_PRIMARY },
  offersSectionHint: { fontSize: 14, color: TEXT_SECONDARY, marginTop: 4, marginBottom: 8, lineHeight: 20 },
  offersEmpty: { fontSize: 17, color: TEXT_SECONDARY, lineHeight: 24, marginTop: 4 },
  summaryCard: { backgroundColor: CARD_BG, borderRadius: 18, padding: 16, marginBottom: 12, ...CARD_SHADOW },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  alertText: { flex: 1, fontSize: 14, color: TEXT_PRIMARY, lineHeight: 20 },
});
