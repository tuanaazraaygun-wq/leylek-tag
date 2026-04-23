/**
 * Leylek Muhabbeti — Ana Sayfa sekmesi: özet, güzergah, teklif CTA, sohbet özeti, keşfe geçiş.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TouchableOpacity, View, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import RouteSummaryCard, { type RouteSummaryPayload } from './RouteSummaryCard';
import { handleUnauthorizedAndMaybeRedirect } from '../lib/muhabbetAuthRedirect';
import type { MuhabbetConversationListItem } from './ConversationsScreen';

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

function parseRouteEndpoints(route: string): { from: string; to: string } {
  const t = route
    .trim()
    .replace(/\s*->\s*/gi, '→')
    .replace(/\s*—\s*/g, '→');
  if (t.includes('→')) {
    const parts = t.split('→');
    return { from: (parts[0] || '').trim(), to: parts.slice(1).join('→').trim() || '—' };
  }
  return { from: t || '—', to: '—' };
}

export type LeylekMuhabbetiHomeTabProps = {
  apiUrl: string;
  apiBaseUrl: string;
  accessToken: string;
  selectedCity: string;
  refreshNonce: number;
  roadstersSummary: RouteSummaryPayload | null;
  roadstersMatches: { match_id?: string; other_user_id: string }[];
  roadstersLoading: boolean;
  onNavigateToRouteSetup?: () => void;
  onNavigateToGroup?: (groupId: string) => void;
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
  apiBaseUrl,
  accessToken,
  selectedCity,
  refreshNonce,
  roadstersSummary,
  roadstersMatches,
  roadstersLoading,
  onNavigateToRouteSetup,
  onNavigateToGroup,
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
  const [convLoading, setConvLoading] = useState(false);
  const [convRows, setConvRows] = useState<MuhabbetConversationListItem[]>([]);
  const [pendingIncoming, setPendingIncoming] = useState(0);
  const [feedPreview, setFeedPreview] = useState<
    { id: string; from_text?: string | null; to_text?: string | null; role_type?: string | null; price_amount?: number | null }[]
  >([]);
  const [feedLoading, setFeedLoading] = useState(false);

  const loadPreview = useCallback(async () => {
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
      const u = new URLSearchParams({ city: selectedCity.trim(), limit: '6' });
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

  const routeLine =
    roadstersSummary?.route?.trim() ? parseRouteEndpoints(roadstersSummary.route.trim()) : null;

  return (
    <View style={styles.root}>
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
          <TouchableOpacity style={styles.ctaBig} onPress={openDriver} activeOpacity={0.9}>
            <LinearGradient colors={[...PRIMARY_GRAD]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            <Text style={styles.ctaBigEmoji}>🚗</Text>
            <Text style={styles.ctaBigTitle}>Sürücü teklifi aç</Text>
            <Text style={styles.ctaBigSub}>Aracın varsa sürücü teklifi aç — rotanı ve koltuğu paylaş.</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ctaBig} onPress={openPassenger} activeOpacity={0.9}>
            <LinearGradient colors={['#F59E0B', '#FBBF24']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            <Text style={styles.ctaBigEmoji}>🧍</Text>
            <Text style={styles.ctaBigTitle}>Yolcu teklifi aç</Text>
            <Text style={styles.ctaBigSub}>Gitmek istiyorsan yolcu teklifi aç — nereye gideceğini yaz.</Text>
          </TouchableOpacity>
        </View>
        {!tok ? <Text style={styles.ctaHint}>Teklif açmak için oturum açman yeterli — butona basınca yönlendirilirsin.</Text> : null}
      </View>

      {tok ? (
        <View style={styles.inset}>
          <RouteSummaryCard
            apiBaseUrl={apiBaseUrl}
            accessToken={tok}
            enabled={!!tok}
            onNavigateToGroup={onNavigateToGroup ?? (() => {})}
            onNavigateToRouteSetup={onNavigateToRouteSetup ?? (() => {})}
            horizontalInset={0}
          />
        </View>
      ) : null}

      <View style={styles.inset}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Güzergah özeti</Text>
          {roadstersLoading && !roadstersSummary ? (
            <ActivityIndicator color={PRIMARY_GRAD[0]} style={{ marginVertical: 8 }} />
          ) : routeLine ? (
            <>
              <Text style={styles.routeBig} numberOfLines={2}>
                {routeLine.from} → {routeLine.to}
              </Text>
              <Text style={styles.summaryMeta}>
                {roadstersMatches.length > 0
                  ? `${roadstersMatches.length} kişi bu rotada`
                  : 'Bu rotada teklif açabilir veya Teklifler sekmesinden sana uygun tekliflere talep gönderebilirsin.'}
              </Text>
            </>
          ) : (
            <Text style={styles.summaryMeta}>Güzergah ekleyerek aynı hat üzerindekilerle bağlantı kurabilirsin.</Text>
          )}
        </View>

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

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Bana uygun teklifler</Text>
          <Text style={styles.summaryHint}>Şehrindeki son teklifler — detay için Teklifler sekmesi</Text>
          {feedLoading ? <ActivityIndicator color={PRIMARY_GRAD[0]} style={{ marginVertical: 8 }} /> : null}
          {!feedLoading && feedPreview.length === 0 ? (
            <Text style={styles.summaryMeta}>Henüz önizleme yok — teklif açarak başlat.</Text>
          ) : (
            feedPreview.map((L) => {
              const r = (L.role_type || '').toLowerCase();
              const tag = r === 'driver' || r === 'private_driver' ? 'Sürücü' : 'Yolcu';
              return (
                <View key={L.id} style={styles.previewRow}>
                  <Text style={styles.previewTag}>{tag}</Text>
                  <Text style={styles.previewRoute} numberOfLines={2}>
                    {(L.from_text || '—').toString().trim()} → {(L.to_text || '—').toString().trim()}
                  </Text>
                  {L.price_amount != null && L.price_amount !== undefined ? (
                    <Text style={styles.previewPrice}>{Number(L.price_amount).toLocaleString('tr-TR')} ₺</Text>
                  ) : null}
                </View>
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
  root: { flex: 1 },
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
  inset: { paddingHorizontal: 16, marginTop: 12 },
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
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 12,
    overflow: 'hidden',
    minHeight: 128,
    justifyContent: 'center',
    ...CARD_SHADOW,
  },
  ctaBigEmoji: { fontSize: 22, color: '#fff', fontWeight: '800' },
  ctaBigTitle: { fontSize: 15, fontWeight: '800', color: '#fff', marginTop: 6 },
  ctaBigSub: { fontSize: 12, color: 'rgba(255,255,255,0.9)', marginTop: 4, lineHeight: 16 },
  previewRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(60,60,67,0.1)',
  },
  previewTag: {
    fontSize: 11,
    fontWeight: '800',
    color: PRIMARY_GRAD[0],
    backgroundColor: 'rgba(59,130,246,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  previewRoute: { flex: 1, fontSize: 14, color: TEXT_PRIMARY, fontWeight: '600' },
  previewPrice: { fontSize: 13, fontWeight: '700', color: TEXT_SECONDARY },
  summaryCard: { backgroundColor: CARD_BG, borderRadius: 18, padding: 16, marginBottom: 12, ...CARD_SHADOW },
  summaryTitle: { fontSize: 17, fontWeight: '800', color: TEXT_PRIMARY },
  summaryHint: { fontSize: 13, color: TEXT_SECONDARY, marginTop: 4, marginBottom: 6 },
  summaryMeta: { fontSize: 15, color: TEXT_SECONDARY, lineHeight: 22, marginTop: 4 },
  routeBig: { fontSize: 18, fontWeight: '700', color: TEXT_PRIMARY, marginTop: 6, lineHeight: 26 },
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
