/**
 * Leylek Muhabbeti — Ana Sayfa sekmesi: teklif CTA, sohbet özeti, keşfe geçiş.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, StyleSheet, Text, TouchableOpacity, View, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import MuhabbetWatermark from './MuhabbetWatermark';
import { handleUnauthorizedAndMaybeRedirect } from '../lib/muhabbetAuthRedirect';
import type { MuhabbetConversationListItem } from './ConversationsScreen';

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

/** Bana uygun teklifler: mavi (sürücü) / turuncu (yolcu) glow + nereden/nereye yeşil etiket */
type OfferCardProps = {
  fromText: string;
  toText: string;
  isDriver: boolean;
  priceAmount?: number | null;
  pulse: Animated.Value;
};

function OfferCard({ fromText, toText, isDriver, priceAmount, pulse }: OfferCardProps) {
  const glowOpacity = pulse.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.35, 0.62, 0.35],
  });
  const glowScale = pulse.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.99, 1.008, 0.99],
  });
  const labelPulse = pulse.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.72, 1, 0.72],
  });
  const arrowY = pulse.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 3, 0],
  });

  const from = (fromText || '—').toString().trim() || '—';
  const to = (toText || '—').toString().trim() || '—';
  const glowColor = isDriver ? 'rgba(59,130,246,0.5)' : 'rgba(245,158,11,0.48)';
  const roleLabel = isDriver ? 'Sürücü' : 'Yolcu';
  const priceStr =
    priceAmount != null && !Number.isNaN(Number(priceAmount))
      ? `${Number(priceAmount).toLocaleString('tr-TR')} ₺`
      : null;

  return (
    <View style={ocStyles.cardSlot}>
      <Animated.View
        pointerEvents="none"
        style={[
          ocStyles.glowRing,
          {
            backgroundColor: glowColor,
            opacity: glowOpacity,
            transform: [{ scale: glowScale }],
          },
        ]}
      />
      <View style={ocStyles.card}>
        <View style={ocStyles.topRow}>
          <View
            style={[
              ocStyles.rolePill,
              { backgroundColor: isDriver ? 'rgba(59,130,246,0.12)' : 'rgba(245,158,11,0.16)' },
            ]}
          >
            <Text style={[ocStyles.rolePillText, { color: isDriver ? '#1D4ED8' : '#C2410C' }]}>{roleLabel}</Text>
          </View>
          {priceStr ? <Text style={ocStyles.priceText}>{priceStr}</Text> : <View style={{ width: 8 }} />}
        </View>

        <View style={ocStyles.routeBlock}>
          <Animated.View style={{ opacity: labelPulse }}>
            <View style={ocStyles.tagGreen}>
              <Text style={ocStyles.tagGreenText}>NEREDEN</Text>
            </View>
          </Animated.View>
          <Text style={ocStyles.bigPlace} numberOfLines={2}>
            {from}
          </Text>
          <Animated.View style={{ alignItems: 'center', marginVertical: 2, transform: [{ translateY: arrowY }] }}>
            <Ionicons name="chevron-down" size={16} color="#86868B" />
          </Animated.View>
          <Animated.View style={{ opacity: labelPulse }}>
            <View style={ocStyles.tagGreen}>
              <Text style={ocStyles.tagGreenText}>NEREYE</Text>
            </View>
          </Animated.View>
          <Text style={ocStyles.bigPlace} numberOfLines={2}>
            {to}
          </Text>
        </View>
      </View>
    </View>
  );
}

const ocStyles = StyleSheet.create({
  cardSlot: {
    position: 'relative',
    marginBottom: 10,
  },
  glowRing: {
    position: 'absolute',
    left: -3,
    right: -3,
    top: -3,
    bottom: -3,
    borderRadius: 20,
  },
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 16,
    ...CARD_SHADOW,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  rolePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  rolePillText: { fontSize: 13, fontWeight: '800' },
  priceText: { fontSize: 15, fontWeight: '800', color: '#6E6E73' },
  routeBlock: { gap: 0 },
  tagGreen: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(22, 163, 74, 0.14)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(22, 163, 74, 0.35)',
  },
  tagGreenText: { fontSize: 11, fontWeight: '800', color: '#15803D', letterSpacing: 0.3 },
  bigPlace: { fontSize: 18, fontWeight: '800', color: '#111', marginTop: 4, lineHeight: 24 },
});

export type LeylekMuhabbetiHomeTabProps = {
  apiUrl: string;
  accessToken: string;
  selectedCity: string;
  refreshNonce: number;
  onOpenLegacyDiscovery: () => void;
  onOpenListingsCreate: () => void;
  onOpenDriverListing?: () => void;
  onOpenPassengerListing?: () => void;
  onOpenMatchRequests?: () => void;
  /** Son sohbet satırına basılınca (conversation_id ile chat, yoksa Sohbetler sekmesi parent’ta). */
  onPressConversationPreview?: (c: MuhabbetConversationListItem) => void;
};

export default function LeylekMuhabbetiHomeTab({
  apiUrl,
  accessToken,
  selectedCity,
  refreshNonce,
  onOpenLegacyDiscovery,
  onOpenListingsCreate,
  onOpenDriverListing,
  onOpenPassengerListing,
  onOpenMatchRequests,
  onPressConversationPreview,
}: LeylekMuhabbetiHomeTabProps) {
  const openDriver = onOpenDriverListing ?? onOpenListingsCreate;
  const openPassenger = onOpenPassengerListing ?? onOpenListingsCreate;
  const tok = accessToken.trim();
  const base = apiUrl.replace(/\/$/, '');
  const ctaPulse = useRef(new Animated.Value(1)).current;
  const offerPulse = useRef(new Animated.Value(0)).current;
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

  useEffect(() => {
    const a = Animated.loop(
      Animated.sequence([
        Animated.timing(offerPulse, {
          toValue: 1,
          duration: 1300,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(offerPulse, {
          toValue: 0,
          duration: 1300,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    a.start();
    return () => {
      a.stop();
      offerPulse.setValue(0);
    };
  }, [offerPulse]);
  const [convLoading, setConvLoading] = useState(false);
  const [convRows, setConvRows] = useState<MuhabbetConversationListItem[]>([]);
  const [pendingIncoming, setPendingIncoming] = useState(0);
  const [feedPreview, setFeedPreview] = useState<
    { id: string; from_text?: string | null; to_text?: string | null; role_type?: string | null; price_amount?: number | null }[]
  >([]);
  const [feedLoading, setFeedLoading] = useState(false);

  const loadPreview = useCallback(async () => {
    const cityQ = (selectedCity || '').trim();
    if (!cityQ) {
      setConvRows([]);
      setPendingIncoming(0);
      setFeedPreview([]);
      setConvLoading(false);
      setFeedLoading(false);
      return;
    }
    if (!tok) {
      setConvRows([]);
      setPendingIncoming(0);
      setFeedPreview([]);
      return;
    }
    setConvLoading(true);
    setFeedLoading(true);
    try {
      const h = { Authorization: `Bearer ${tok}` };
      const u = new URLSearchParams({ city: cityQ, limit: '6' });
      const [rConv, rInc, rFeed] = await Promise.all([
        fetch(`${base}/muhabbet/conversations/me?limit=8`, { headers: h }),
        fetch(`${base}/muhabbet/match-requests/incoming?status=pending&limit=50`, { headers: h }),
        fetch(`${base}/muhabbet/listings/feed?${u.toString()}`, { headers: h }),
      ]);
      if (
        handleUnauthorizedAndMaybeRedirect(rConv) ||
        handleUnauthorizedAndMaybeRedirect(rInc) ||
        handleUnauthorizedAndMaybeRedirect(rFeed)
      ) {
        setConvRows([]);
        setPendingIncoming(0);
        setFeedPreview([]);
        return;
      }
      {
        const d = (await rConv.json().catch(() => ({}))) as { success?: boolean; conversations?: MuhabbetConversationListItem[] };
        if (rConv.ok && d.success && Array.isArray(d.conversations)) {
          const acc = d.conversations.filter((c) => (c.request_status || '').toLowerCase() === 'accepted');
          setConvRows(acc.slice(0, 4));
        } else setConvRows([]);
      }
      {
        const di = (await rInc.json().catch(() => ({}))) as { success?: boolean; requests?: unknown[] };
        if (rInc.ok && di.success && Array.isArray(di.requests)) setPendingIncoming(di.requests.length);
        else setPendingIncoming(0);
      }
      {
        const df = (await rFeed.json().catch(() => ({}))) as { success?: boolean; listings?: typeof feedPreview };
        if (rFeed.ok && df.success && Array.isArray(df.listings)) setFeedPreview(df.listings.slice(0, 5));
        else setFeedPreview([]);
      }
    } catch {
      setConvRows([]);
      setPendingIncoming(0);
      setFeedPreview([]);
    } finally {
      setConvLoading(false);
      setFeedLoading(false);
    }
  }, [base, tok, selectedCity]);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview, refreshNonce, selectedCity]);

  return (
    <View style={styles.root}>
      <MuhabbetWatermark />
      <View style={styles.hero}>
        <LinearGradient colors={[...PRIMARY_GRAD]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <Text style={styles.heroEyebrow}>Şehrin</Text>
        <Text style={styles.heroCity}>{selectedCity}</Text>
        <Text style={styles.heroSub}>Şehir içi teklifler — güzergahını paylaş, teklif aç veya sana uygun teklife talep gönder.</Text>
      </View>

      {/* Teklif CTA: oturumdan bağımsız her zaman görünür (token yoksa üst ekran uyarısı + tıklamada oturum kontrolü). */}
      <View style={styles.inset}>
        <Text style={styles.ctaSectionTitle}>Teklif aç</Text>
        <View style={[styles.ctaRow, !tok && styles.ctaRowDim]}>
          <Animated.View style={[styles.ctaBig, { opacity: ctaPulse }]}>
            <TouchableOpacity style={styles.ctaBigInner} onPress={openDriver} activeOpacity={0.9}>
              <LinearGradient colors={[...PRIMARY_GRAD]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              <Text style={styles.ctaBigEmoji}>🚗</Text>
              <Text style={styles.ctaBigTitle}>Sürücü teklifi aç</Text>
              <Text style={styles.ctaBigSub}>Aracın varsa sürücü teklifi aç — rotanı ve koltuğu paylaş.</Text>
            </TouchableOpacity>
          </Animated.View>
          <Animated.View style={[styles.ctaBig, { opacity: ctaPulse }]}>
            <TouchableOpacity style={styles.ctaBigInner} onPress={openPassenger} activeOpacity={0.9}>
              <LinearGradient colors={['#F59E0B', '#FBBF24']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              <Text style={styles.ctaBigEmoji}>🧍</Text>
              <Text style={styles.ctaBigTitle}>Yolcu teklifi aç</Text>
              <Text style={styles.ctaBigSub}>Gitmek istiyorsan yolcu teklifi aç — nereye gideceğini yaz.</Text>
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
          <Text style={styles.offersSectionTitle}>Bana uygun teklifler</Text>
          <Text style={styles.offersSectionHint}>Şehrindeki son teklifler — detay için Teklifler sekmesi</Text>
          {feedLoading ? <ActivityIndicator color={PRIMARY_GRAD[0]} style={{ marginVertical: 8 }} /> : null}
          {!feedLoading && feedPreview.length === 0 ? (
            <Text style={styles.offersEmpty}>Henüz önizleme yok — teklif açarak başlat.</Text>
          ) : (
            feedPreview.map((L) => {
              const r = (L.role_type || '').toLowerCase();
              const isDriver = r === 'driver' || r === 'private_driver';
              return (
                <OfferCard
                  key={L.id}
                  fromText={(L.from_text || '—').toString()}
                  toText={(L.to_text || '—').toString()}
                  isDriver={isDriver}
                  priceAmount={L.price_amount}
                  pulse={offerPulse}
                />
              );
            })
          )}
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Son sohbetler</Text>
          <Text style={styles.summaryHint}>Kabul edilen tekliflerden kısa özet</Text>
          {convLoading ? <ActivityIndicator color={PRIMARY_GRAD[0]} style={{ marginVertical: 8 }} /> : null}
          {!convLoading && convRows.length === 0 ? (
            <Text style={styles.summaryMeta}>Henüz sohbet yok — teklife talep gönder, kabul sonrası konuş.</Text>
          ) : (
            convRows.map((c, idx) => {
              const cid = String(c.conversation_id || c.id || '');
              const last = (c.last_message_body || '').trim();
              const rowKey = cid ? `conv-${cid}` : `conv-i-${idx}`;
              const row = (
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.convName} numberOfLines={1}>
                    {c.other_user_name || 'Kullanıcı'}
                  </Text>
                  <Text style={styles.convPreview} numberOfLines={1}>
                    {last || 'Sohbet başlat'}
                  </Text>
                </View>
              );
              if (onPressConversationPreview) {
                return (
                  <Pressable
                    key={rowKey}
                    onPress={() => onPressConversationPreview(c)}
                    style={({ pressed }) => [styles.convRow, pressed && { opacity: 0.88 }]}
                    accessibilityRole="button"
                    accessibilityLabel={`Sohbet: ${c.other_user_name || 'Kullanıcı'}`}
                  >
                    {row}
                    <Ionicons name="chevron-forward" size={16} color={TEXT_SECONDARY} style={styles.convChevron} />
                  </Pressable>
                );
              }
              return (
                <View key={cid} style={styles.convRow}>
                  {row}
                </View>
              );
            })
          )}
        </View>

        <Pressable onPress={onOpenLegacyDiscovery} style={({ pressed }) => [styles.legacyLink, pressed && { opacity: 0.9 }]}>
          <Ionicons name="compass-outline" size={20} color={PRIMARY_GRAD[0]} />
          <Text style={styles.legacyLinkText}>Mahalle & grup keşfi (arka plan)</Text>
          <Ionicons name="chevron-forward" size={18} color={TEXT_SECONDARY} />
        </Pressable>
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
    padding: 20,
    overflow: 'hidden',
    ...CARD_SHADOW,
  },
  heroEyebrow: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600' },
  heroCity: { color: '#fff', fontSize: 28, fontWeight: '800', marginTop: 4 },
  heroSub: { color: 'rgba(255,255,255,0.92)', fontSize: 14, lineHeight: 20, marginTop: 8 },
  inset: { paddingHorizontal: 16, marginTop: 12, zIndex: 1 },
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
  summaryTitle: { fontSize: 17, fontWeight: '800', color: TEXT_PRIMARY },
  summaryHint: { fontSize: 13, color: TEXT_SECONDARY, marginTop: 4, marginBottom: 6 },
  summaryMeta: { fontSize: 15, color: TEXT_SECONDARY, lineHeight: 22, marginTop: 4 },
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
  convRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(60,60,67,0.12)',
  },
  convChevron: { marginLeft: 'auto' },
  convName: { fontSize: 15, fontWeight: '700', color: TEXT_PRIMARY },
  convPreview: { fontSize: 13, color: TEXT_SECONDARY, marginTop: 2 },
  legacyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 4,
    marginBottom: 24,
  },
  legacyLinkText: { flex: 1, fontSize: 15, fontWeight: '600', color: PRIMARY_GRAD[0] },
});
