import React, { memo, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  PREMIUM_AUTH_CYAN,
  PREMIUM_BORDER_SLATE,
  PREMIUM_NAVY_CARD,
  PREMIUM_NAVY_DEEP,
  PREMIUM_ROLE_COCKPIT_CYAN_EDGE,
  PREMIUM_TEXT_MUTED,
  PREMIUM_TEXT_SOFT,
} from '../auth/premiumAuthStyles';
import { useTrustedNetworkHub } from '../../hooks/useTrustedNetworkHub';
import {
  globalEmptyBody,
  globalEmptyTitle,
  hubHeaderSubtitle,
  hubTitle,
  HUB_ERROR_BODY,
  HUB_ERROR_TITLE,
  SECTION_INCOMING_TITLE,
  SECTION_OUTGOING_TITLE,
  sectionConnectionsTitle,
  formatTrustedRadarBriefing,
  type TrustedHubRole,
} from '../../lib/trustedHubCopy';
import TrustedConnectionRow from './TrustedConnectionRow';
import TrustedPendingRow from './TrustedPendingRow';
import TrustedRadarBriefingStrip from './TrustedRadarBriefingStrip';

export type TrustedNetworkHubProps = {
  role: TrustedHubRole;
};

function HubSkeletonRows() {
  return (
    <View style={styles.skeletonWrap}>
      {[0, 1, 2].map((key) => (
        <View key={key} style={styles.skeletonRow}>
          <View style={styles.skeletonAvatar} />
          <View style={styles.skeletonTextCol}>
            <View style={styles.skeletonLineMain} />
            <View style={styles.skeletonLineSub} />
          </View>
        </View>
      ))}
    </View>
  );
}

function HubSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionList}>{children}</View>
    </View>
  );
}

function TrustedNetworkHub({ role }: TrustedNetworkHubProps) {
  const router = useRouter();
  const {
    status,
    connections,
    incoming,
    outgoing,
    actingId,
    actionError,
    actionSuccess,
    acceptInvite,
    declineInvite,
    revokeConnection,
    clearActionFeedback,
  } = useTrustedNetworkHub();

  const title = hubTitle(role);
  const isReady = status === 'ready';
  const isLoading = status === 'loading' || status === 'idle';
  const isError = status === 'error';
  const actionsDisabled = actingId != null;

  const hasConnections = connections.length > 0;
  const hasIncoming = incoming.length > 0;
  const hasOutgoing = outgoing.length > 0;
  const hasAnyData = hasConnections || hasIncoming || hasOutgoing;
  const showActionBanner = isReady && (!!actionError || !!actionSuccess);

  const displayConnections = useMemo(() => {
    if (role !== 'passenger') return connections;
    const hasAnyRadar = connections.some((c) => c.radar != null);
    const hasAnyTie = connections.some((c) => c.tie != null);
    if (!hasAnyRadar && !hasAnyTie) return connections;
    return [...connections]
      .map((item, index) => ({ item, index }))
      .sort((a, b) => {
        const rankA =
          a.item.radar?.availability_rank != null &&
          Number.isFinite(Number(a.item.radar.availability_rank))
            ? Number(a.item.radar.availability_rank)
            : -1;
        const rankB =
          b.item.radar?.availability_rank != null &&
          Number.isFinite(Number(b.item.radar.availability_rank))
            ? Number(b.item.radar.availability_rank)
            : -1;
        if (rankB !== rankA) return rankB - rankA;
        const tieRankA =
          a.item.tie?.tie_rank != null && Number.isFinite(Number(a.item.tie.tie_rank))
            ? Number(a.item.tie.tie_rank)
            : -1;
        const tieRankB =
          b.item.tie?.tie_rank != null && Number.isFinite(Number(b.item.tie.tie_rank))
            ? Number(b.item.tie.tie_rank)
            : -1;
        if (tieRankB !== tieRankA) return tieRankB - tieRankA;
        return a.index - b.index;
      })
      .map(({ item }) => item);
  }, [connections, role]);

  const radarBriefingText = useMemo(() => {
    if (role !== 'passenger') return null;
    const withRadar = connections.filter((c) => c.role === 'driver' && c.radar != null);
    if (withRadar.length === 0) return null;

    let readyCount = 0;
    let onTripCount = 0;
    let staleCount = 0;
    let offlineCount = 0;

    for (const item of withRadar) {
      const state = String(item.radar?.radar_state || '').trim();
      if (state === 'TRUST_READY') readyCount += 1;
      else if (state === 'TRUST_ON_TRIP') onTripCount += 1;
      else if (state === 'TRUST_STALE') staleCount += 1;
      else if (state === 'TRUST_OFFLINE') offlineCount += 1;
    }

    return formatTrustedRadarBriefing({
      hasRadarData: true,
      readyCount,
      onTripCount,
      staleCount,
      offlineCount,
    });
  }, [connections, role]);

  const subtitle =
    isReady && hasAnyData
      ? hubHeaderSubtitle(role, connections.length, incoming.length, outgoing.length)
      : isReady
        ? hubHeaderSubtitle(role, 0, 0, 0)
        : isLoading
          ? 'Yükleniyor…'
          : '';

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <LinearGradient
        colors={[PREMIUM_NAVY_DEEP, PREMIUM_NAVY_CARD, 'rgba(11, 18, 32, 0.98)']}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.header}>
        <Pressable
          style={styles.backBtn}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Geri"
        >
          <Ionicons name="arrow-back" size={20} color={PREMIUM_AUTH_CYAN} />
        </Pressable>
        <View style={styles.headerBody}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>

      {showActionBanner ? (
        <Pressable
          style={[
            styles.actionBanner,
            actionError ? styles.actionBannerError : styles.actionBannerSuccess,
          ]}
          onPress={clearActionFeedback}
          accessibilityRole="text"
        >
          <Ionicons
            name={actionError ? 'alert-circle-outline' : 'checkmark-circle-outline'}
            size={16}
            color={actionError ? 'rgba(252, 165, 165, 0.95)' : 'rgba(52, 211, 153, 0.95)'}
          />
          <Text
            style={[
              styles.actionBannerText,
              actionError ? styles.actionBannerTextError : styles.actionBannerTextSuccess,
            ]}
            numberOfLines={2}
          >
            {actionError || actionSuccess}
          </Text>
        </Pressable>
      ) : null}

      {isLoading ? (
        <HubSkeletonRows />
      ) : isError ? (
        <View style={styles.errorPanel}>
          <View style={styles.errorIconWrap}>
            <Ionicons name="cloud-offline-outline" size={28} color={PREMIUM_AUTH_CYAN} />
          </View>
          <Text style={styles.errorTitle}>{HUB_ERROR_TITLE}</Text>
          <Text style={styles.errorBody}>{HUB_ERROR_BODY}</Text>
        </View>
      ) : isReady && !hasAnyData ? (
        <View style={styles.emptyPanel}>
          <Text style={styles.emptyEmoji}>🦢</Text>
          <Text style={styles.emptyTitle}>{globalEmptyTitle(role)}</Text>
          <Text style={styles.emptyBody}>{globalEmptyBody(role)}</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {hasConnections ? (
            <HubSection title={sectionConnectionsTitle(role)}>
              {radarBriefingText ? (
                <TrustedRadarBriefingStrip text={radarBriefingText} />
              ) : null}
              {displayConnections.map((item) => (
                <TrustedConnectionRow
                  key={item.connection_id}
                  item={item}
                  hubRole={role}
                  actingId={actingId}
                  actionsDisabled={actionsDisabled}
                  onRevoke={revokeConnection}
                />
              ))}
            </HubSection>
          ) : null}

          {hasIncoming ? (
            <HubSection title={SECTION_INCOMING_TITLE}>
              {incoming.map((item) => (
                <TrustedPendingRow
                  key={item.invite_id}
                  item={item}
                  direction="incoming"
                  actingId={actingId}
                  actionsDisabled={actionsDisabled}
                  onAccept={acceptInvite}
                  onDecline={declineInvite}
                />
              ))}
            </HubSection>
          ) : null}

          {hasOutgoing ? (
            <HubSection title={SECTION_OUTGOING_TITLE}>
              {outgoing.map((item) => (
                <TrustedPendingRow
                  key={item.invite_id}
                  item={item}
                  direction="outgoing"
                  actingId={actingId}
                  actionsDisabled={actionsDisabled}
                />
              ))}
            </HubSection>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

export default memo(TrustedNetworkHub);

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: PREMIUM_NAVY_DEEP,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: PREMIUM_ROLE_COCKPIT_CYAN_EDGE,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16, 26, 43, 0.88)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PREMIUM_BORDER_SLATE,
  },
  headerBody: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: PREMIUM_TEXT_SOFT,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: PREMIUM_TEXT_MUTED,
    lineHeight: 18,
  },
  actionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  actionBannerSuccess: {
    backgroundColor: 'rgba(6, 78, 59, 0.22)',
    borderColor: 'rgba(52, 211, 153, 0.32)',
  },
  actionBannerError: {
    backgroundColor: 'rgba(127, 29, 29, 0.18)',
    borderColor: 'rgba(248, 113, 113, 0.32)',
  },
  actionBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  actionBannerTextSuccess: {
    color: 'rgba(167, 243, 208, 0.95)',
  },
  actionBannerTextError: {
    color: 'rgba(252, 165, 165, 0.95)',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 28,
    gap: 18,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: 'rgba(148, 163, 184, 0.95)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  sectionList: {
    gap: 8,
  },
  skeletonWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 8,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(16, 26, 43, 0.55)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PREMIUM_BORDER_SLATE,
  },
  skeletonAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(30, 58, 95, 0.45)',
  },
  skeletonTextCol: {
    flex: 1,
    gap: 8,
  },
  skeletonLineMain: {
    height: 12,
    width: '58%',
    borderRadius: 6,
    backgroundColor: 'rgba(30, 58, 95, 0.5)',
  },
  skeletonLineSub: {
    height: 10,
    width: '36%',
    borderRadius: 5,
    backgroundColor: 'rgba(30, 58, 95, 0.38)',
  },
  errorPanel: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingBottom: 48,
    gap: 10,
  },
  errorIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16, 26, 43, 0.88)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PREMIUM_BORDER_SLATE,
    marginBottom: 4,
  },
  errorTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: PREMIUM_TEXT_SOFT,
    textAlign: 'center',
  },
  errorBody: {
    fontSize: 14,
    fontWeight: '600',
    color: PREMIUM_TEXT_MUTED,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyPanel: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingBottom: 48,
    gap: 10,
  },
  emptyEmoji: {
    fontSize: 36,
    lineHeight: 42,
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: PREMIUM_TEXT_SOFT,
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 14,
    fontWeight: '600',
    color: PREMIUM_TEXT_MUTED,
    textAlign: 'center',
    lineHeight: 20,
  },
});
