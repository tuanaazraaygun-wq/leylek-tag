import React, { memo, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassSurface, PremiumText } from '../../design-system/primitives';
import { LDS_BORDER_WIDTH } from '../../design-system/tokens/border';
import { LDS_RADIUS } from '../../design-system/tokens/radius';
import { LDS_SPACING } from '../../design-system/tokens/spacing';
import { useTrustedSummary } from '../../hooks/useTrustedSummary';
import { formatDriverTrustedHeaderSubtitle } from '../../lib/trustedSummaryCopy';
import { useDriverTheme } from '../../lib/theme/useDriverTheme';

const STUB_HEADER_SUBTITLE = 'Yolcu bağlantıları ve davetler';

export type DriverCockpitQuickStripProps = {
  /** Güvenilir yolcular hub — /trusted-network?role=driver */
  onTrustedPress?: () => void;
  /** Kokpit panel — tek satır CTA, GlassSurface yok */
  embedded?: boolean;
};

/** Sürücü idle kokpit — Güven Ağı tek satır CTA (read-only özet). */
function DriverCockpitQuickStrip({ onTrustedPress, embedded = false }: DriverCockpitQuickStripProps) {
  const { quickStripSurfaces: qsLt, ui } = useDriverTheme();
  const { status, summary } = useTrustedSummary();
  const summaryReady = status === 'ready' && summary != null;
  const headerWired = typeof onTrustedPress === 'function';

  const headerSubtitle = useMemo(() => {
    if (summaryReady && summary) {
      return formatDriverTrustedHeaderSubtitle(summary);
    }
    return STUB_HEADER_SUBTITLE;
  }, [summaryReady, summary]);

  const badgeCount = useMemo(() => {
    if (!summaryReady || !summary) return 0;
    const active = Math.max(0, Number(summary.active_count) || 0);
    const incoming = Math.max(0, Number(summary.incoming_pending_count) || 0);
    return active + incoming;
  }, [summaryReady, summary]);

  const rowContent = (
    <>
      <View style={[styles.trustIconWrap, qsLt?.trustIconWrap]}>
        <Ionicons name="shield-checkmark-outline" size={14} color={ui.trustIcon} />
      </View>
      <View style={styles.titleCol}>
        <PremiumText variant="caption" style={[styles.title, qsLt?.title]} numberOfLines={1}>
          Güven ağı
        </PremiumText>
        <PremiumText variant="caption" muted style={[styles.subtitle, qsLt?.subtitle]} numberOfLines={1}>
          {headerSubtitle}
        </PremiumText>
      </View>
      {badgeCount > 0 ? (
        <View style={[styles.badge, qsLt?.badge]} accessibilityLabel={`${badgeCount} bağlantı`}>
          <PremiumText variant="caption" style={[styles.badgeText, qsLt?.badgeText]}>
            {badgeCount}
          </PremiumText>
        </View>
      ) : null}
      {headerWired ? <Ionicons name="chevron-forward" size={15} color={ui.chevron} /> : null}
    </>
  );

  const rowStyles = [styles.compactRow, embedded && styles.compactRowEmbedded, qsLt?.compactRow];

  if (embedded) {
    return headerWired ? (
      <Pressable
        onPress={onTrustedPress}
        accessibilityRole="button"
        accessibilityLabel={`Güven ağı. ${headerSubtitle}. Hub`}
        style={({ pressed }) => [...rowStyles, pressed && styles.rowPressed]}
      >
        {rowContent}
      </Pressable>
    ) : (
      <View style={rowStyles} accessibilityRole="summary">
        {rowContent}
      </View>
    );
  }

  return (
    <View style={styles.wrap} accessibilityRole="summary">
      <GlassSurface variant="plain" style={[styles.card, qsLt?.card]} borderRadius={LDS_RADIUS.lg}>
        {headerWired ? (
          <Pressable
            onPress={onTrustedPress}
            accessibilityRole="button"
            accessibilityLabel={`Güven ağı. ${headerSubtitle}`}
            style={({ pressed }) => [...rowStyles, styles.cardRow, pressed && styles.rowPressed]}
          >
            {rowContent}
          </Pressable>
        ) : (
          <View style={[...rowStyles, styles.cardRow]}>{rowContent}</View>
        )}
      </GlassSurface>
    </View>
  );
}

export default memo(DriverCockpitQuickStrip);

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: LDS_SPACING.sm,
    paddingBottom: LDS_SPACING.xxs,
  },
  card: {
    paddingVertical: LDS_SPACING.xxs,
    paddingHorizontal: LDS_SPACING.sm,
  },
  cardRow: {
    marginHorizontal: -LDS_SPACING.xxs,
    paddingHorizontal: LDS_SPACING.xxs,
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LDS_SPACING.xs,
    paddingVertical: LDS_SPACING.xxs,
    paddingHorizontal: LDS_SPACING.xxs,
    borderRadius: LDS_RADIUS.sm,
  },
  compactRowEmbedded: {
    paddingHorizontal: 0,
  },
  rowPressed: {
    opacity: 0.88,
  },
  trustIconWrap: {
    width: LDS_SPACING.lg + 2,
    height: LDS_SPACING.lg + 2,
    borderRadius: LDS_RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: LDS_BORDER_WIDTH.hairline,
    flexShrink: 0,
  },
  titleCol: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  title: {
    letterSpacing: 0.08,
    fontWeight: '600',
  },
  subtitle: {
    lineHeight: 14,
    fontSize: 11,
    opacity: 0.88,
  },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: LDS_RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: LDS_BORDER_WIDTH.hairline,
    flexShrink: 0,
  },
  badgeText: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
