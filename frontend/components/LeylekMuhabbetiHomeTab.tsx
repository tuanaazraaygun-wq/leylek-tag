/**
 * Leylek Muhabbeti — Ana Sayfa sekmesi: özet, güzergah, ilan CTA, sohbet özeti, keşfe geçiş.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import RouteSummaryCard, { type RouteSummaryPayload } from './RouteSummaryCard';
import { GradientButton } from './GradientButton';
import { getPersistedAccessToken } from '../lib/sessionToken';
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
}: LeylekMuhabbetiHomeTabProps) {
  const tok = accessToken.trim();
  const base = apiUrl.replace(/\/$/, '');
  const [convLoading, setConvLoading] = useState(false);
  const [convRows, setConvRows] = useState<MuhabbetConversationListItem[]>([]);
  const [pendingIncoming, setPendingIncoming] = useState(0);

  const loadPreview = useCallback(async () => {
    if (!tok) {
      setConvRows([]);
      setPendingIncoming(0);
      return;
    }
    setConvLoading(true);
    try {
      const h = { Authorization: `Bearer ${tok}` };
      const [rConv, rInc] = await Promise.all([
        fetch(`${base}/muhabbet/conversations/me?limit=8`, { headers: h }),
        fetch(`${base}/muhabbet/match-requests/incoming?status=pending&limit=50`, { headers: h }),
      ]);
      if (!handleUnauthorizedAndMaybeRedirect(rConv)) {
        const d = (await rConv.json().catch(() => ({}))) as { success?: boolean; conversations?: MuhabbetConversationListItem[] };
        if (rConv.ok && d.success && Array.isArray(d.conversations)) {
          const acc = d.conversations.filter((c) => (c.request_status || '').toLowerCase() === 'accepted');
          setConvRows(acc.slice(0, 4));
        } else setConvRows([]);
      }
      if (!handleUnauthorizedAndMaybeRedirect(rInc)) {
        const di = (await rInc.json().catch(() => ({}))) as { success?: boolean; requests?: unknown[] };
        if (rInc.ok && di.success && Array.isArray(di.requests)) setPendingIncoming(di.requests.length);
        else setPendingIncoming(0);
      }
    } catch {
      setConvRows([]);
      setPendingIncoming(0);
    } finally {
      setConvLoading(false);
    }
  }, [base, tok]);

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
        <Text style={styles.heroSub}>Şehir içi ilanlar ve eşleşmeler — güzergahını paylaş, yolculuğunu planla.</Text>
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
                  : 'Bu rotada eşleşme için ilan verebilir veya ilanlara göz atabilirsin.'}
              </Text>
            </>
          ) : (
            <Text style={styles.summaryMeta}>Güzergah ekleyerek aynı hat üzerindekilerle bağlantı kurabilirsin.</Text>
          )}
          <GradientButton label="İlan Ver" variant="secondary" onPress={onOpenListingsCreate} style={{ marginTop: 14 }} />
        </View>

        {pendingIncoming > 0 ? (
          <View style={styles.alertCard}>
            <Ionicons name="notifications-outline" size={22} color={ACCENT} />
            <Text style={styles.alertText}>
              {pendingIncoming} bekleyen eşleşme isteğin var. İlanlar sekmesinden yanıtlayabilirsin.
            </Text>
          </View>
        ) : null}

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Son sohbetler</Text>
          <Text style={styles.summaryHint}>Kabul edilen eşleşmelerden kısa özet</Text>
          {convLoading ? <ActivityIndicator color={PRIMARY_GRAD[0]} style={{ marginVertical: 8 }} /> : null}
          {!convLoading && convRows.length === 0 ? (
            <Text style={styles.summaryMeta}>Henüz sohbet yok — ilanlara katıl, eşleş, konuş.</Text>
          ) : (
            convRows.map((c) => {
              const cid = String(c.conversation_id || c.id || '');
              const last = (c.last_message_body || '').trim();
              return (
                <View key={cid} style={styles.convRow}>
                  <Text style={styles.convName} numberOfLines={1}>
                    {c.other_user_name || 'Kullanıcı'}
                  </Text>
                  <Text style={styles.convPreview} numberOfLines={1}>
                    {last || 'Sohbet başlat'}
                  </Text>
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
  convRow: { paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(60,60,67,0.12)' },
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
