import React, { memo, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassSurface, PremiumText } from '../../design-system/primitives';
import { LDS_BORDER_COLOR, LDS_BORDER_WIDTH } from '../../design-system/tokens/border';
import { LDS_RADIUS } from '../../design-system/tokens/radius';
import { LDS_SPACING } from '../../design-system/tokens/spacing';
import { useTrustedSummary } from '../../hooks/useTrustedSummary';
import { formatDriverTrustedHeaderSubtitle } from '../../lib/trustedSummaryCopy';
import { useDriverTheme } from '../../lib/theme/useDriverTheme';
import type { TrustedSummaryResponse } from '../../lib/trustedNetworkApi';

const CHIPS = [
  'Aktif yolcular',
  'Bekleyen davetler',
  'Güven ağı',
  'Direkt istek',
] as const;

type ChipLabel = (typeof CHIPS)[number];

const STUB_HEADER_SUBTITLE = 'Güven ağı ve direkt eşleşme yakında';

/** Collapsed trust metrics — duplicate “Güven ağı” chip omitted in presentation. */
const TRUST_METRIC_KEYS: ChipLabel[] = ['Aktif yolcular', 'Bekleyen davetler'];

const METRIC_PRESENTATION: Record<
  (typeof TRUST_METRIC_KEYS)[number],
  { shortLabel: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  'Aktif yolcular': { shortLabel: 'Aktif', icon: 'people-outline' },
  'Bekleyen davetler': { shortLabel: 'Bekleyen', icon: 'mail-open-outline' },
};

function chipMetaForLabel(
  label: ChipLabel,
  summary: TrustedSummaryResponse,
): string | null {
  const active = Math.max(0, Number(summary.active_count) || 0);
  const incoming = Math.max(0, Number(summary.incoming_pending_count) || 0);
  if (label === 'Aktif yolcular') {
    return ` · ${active}`;
  }
  if (label === 'Bekleyen davetler') {
    return ` · ${incoming}`;
  }
  if (label === 'Güven ağı') {
    return ` · ${active}`;
  }
  return null;
}

function metricValueFromMeta(meta: string | null): string {
  if (!meta) return '—';
  const trimmed = meta.replace(/^\s*·\s*/, '').trim();
  return trimmed || '—';
}

export type DriverCockpitQuickStripProps = {
  /** Güvenilir yolcular hub — /trusted-network?role=driver */
  onTrustedPress?: () => void;
  /** Kokpit panel sağ kolon — GlassSurface yok */
  embedded?: boolean;
};

function TrustMetricRow({
  label,
  summaryReady,
  summary,
  compact,
}: {
  label: (typeof TRUST_METRIC_KEYS)[number];
  summaryReady: boolean;
  summary: TrustedSummaryResponse | null;
  compact?: boolean;
}) {
  const { quickStripSurfaces: qsLt, ui } = useDriverTheme();
  const presentation = METRIC_PRESENTATION[label];
  const chipMeta = summaryReady && summary ? chipMetaForLabel(label, summary) : null;
  const value = metricValueFromMeta(chipMeta);
  const hasValue = value !== '—';

  return (
    <View
      style={[
        compact ? styles.embeddedMetricRow : styles.metricCell,
        compact && qsLt?.embeddedMetricRow,
        !compact && qsLt?.metricCell,
        hasValue && !compact && styles.metricCellActive,
        hasValue && !compact && qsLt?.metricCellActive,
      ]}
      accessibilityLabel={`${presentation.shortLabel}. ${value}`}
    >
      <Ionicons
        name={presentation.icon}
        size={compact ? 12 : 11}
        color={hasValue ? ui.iconMuted : ui.sessionInactive}
      />
      <PremiumText variant="caption" muted style={compact ? styles.embeddedMetricLabel : styles.metricLabel} numberOfLines={1}>
        {presentation.shortLabel}
      </PremiumText>
      <PremiumText
        variant="caption"
        muted
        style={[
          compact ? styles.embeddedMetricValue : styles.metricValue,
          hasValue && styles.metricValueActive,
          hasValue && qsLt?.metricValueActive,
        ]}
        numberOfLines={1}
      >
        {value}
      </PremiumText>
    </View>
  );
}

/** Sürücü idle kokpit — secondary trust özeti (read-only). */
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

  const headerContent = (
    <>
      <View style={[embedded ? styles.embeddedTrustIconWrap : styles.trustIconWrap, embedded ? qsLt?.embeddedTrustIconWrap : qsLt?.trustIconWrap]}>
        <Ionicons name="shield-checkmark-outline" size={embedded ? 13 : 12} color={ui.trustIcon} />
      </View>
      <View style={styles.titleCol}>
        <PremiumText variant="caption" style={styles.title} numberOfLines={1}>
          Güven ağı
        </PremiumText>
        <PremiumText variant="caption" muted style={styles.subtitle} numberOfLines={1}>
          {headerSubtitle}
        </PremiumText>
      </View>
      {headerWired ? (
        <Ionicons name="chevron-forward" size={15} color={ui.chevron} />
      ) : null}
    </>
  );

  if (embedded) {
    return (
      <View style={styles.embeddedCol} accessibilityRole="summary">
        {headerWired ? (
          <Pressable
            onPress={onTrustedPress}
            accessibilityRole="button"
            accessibilityLabel={`Güven ağı. ${headerSubtitle}. Hub`}
            style={({ pressed }) => [styles.embeddedHeaderRow, pressed && styles.headerRowPressed]}
          >
            {headerContent}
          </Pressable>
        ) : (
          <View style={styles.embeddedHeaderRow}>{headerContent}</View>
        )}

        <View style={styles.embeddedMetricsCol}>
          {TRUST_METRIC_KEYS.map((label) => (
            <TrustMetricRow
              key={label}
              label={label}
              summaryReady={summaryReady}
              summary={summary}
              compact
            />
          ))}
        </View>

        <View style={[styles.embeddedQmPill, qsLt?.embeddedQmPill]} accessibilityLabel="Hızlı eşleşme. Yakında" accessibilityRole="text">
          <Ionicons name="flash-outline" size={10} color={ui.sessionInactive} />
          <PremiumText variant="caption" muted style={styles.qmLabel} numberOfLines={1}>
            Yakında
          </PremiumText>
        </View>
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
            style={({ pressed }) => [
              styles.headerRow,
              styles.headerRowPressable,
              pressed && styles.headerRowPressed,
            ]}
          >
            {headerContent}
          </Pressable>
        ) : (
          <View style={styles.headerRow}>{headerContent}</View>
        )}

        <View style={styles.metricsRow}>
          {TRUST_METRIC_KEYS.map((label) => (
            <TrustMetricRow
              key={label}
              label={label}
              summaryReady={summaryReady}
              summary={summary}
            />
          ))}

          <View
            style={[styles.qmPill, qsLt?.qmPill]}
            accessibilityLabel="Hızlı eşleşme. Yakında"
            accessibilityRole="text"
          >
            <Ionicons name="flash-outline" size={10} color={ui.sessionInactive} />
            <PremiumText variant="caption" muted style={styles.qmLabel} numberOfLines={1}>
              Yakında
            </PremiumText>
          </View>
        </View>
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
    paddingVertical: LDS_SPACING.xs,
    paddingHorizontal: LDS_SPACING.sm,
  },
  embeddedCol: {
    flex: 1,
    minWidth: 0,
    gap: LDS_SPACING.xxs,
  },
  embeddedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LDS_SPACING.xxs,
  },
  embeddedMetricsCol: {
    gap: 3,
  },
  embeddedMetricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LDS_SPACING.xxs,
    paddingVertical: 2,
  },
  embeddedMetricLabel: {
    flex: 1,
    fontSize: 10,
    letterSpacing: 0.04,
  },
  embeddedMetricValue: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  embeddedTrustIconWrap: {
    width: LDS_SPACING.lg,
    height: LDS_SPACING.lg,
    borderRadius: LDS_RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(8,17,31,0.38)',
    borderWidth: LDS_BORDER_WIDTH.hairline,
    borderColor: LDS_BORDER_COLOR.cockpitPanel,
    flexShrink: 0,
  },
  embeddedQmPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    alignSelf: 'flex-start',
    paddingVertical: 2,
    paddingHorizontal: LDS_SPACING.xs,
    borderRadius: LDS_RADIUS.sm,
    backgroundColor: 'rgba(8,17,31,0.24)',
    borderWidth: LDS_BORDER_WIDTH.hairline,
    borderColor: LDS_BORDER_COLOR.cockpitPanel,
    opacity: 0.82,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LDS_SPACING.xs,
    marginBottom: LDS_SPACING.xs,
  },
  headerRowPressable: {
    borderRadius: LDS_RADIUS.sm,
    marginHorizontal: -LDS_SPACING.xxs,
    paddingHorizontal: LDS_SPACING.xxs,
    paddingVertical: LDS_SPACING.xxs,
  },
  headerRowPressed: {
    opacity: 0.88,
  },
  trustIconWrap: {
    width: LDS_SPACING.lg,
    height: LDS_SPACING.lg,
    borderRadius: LDS_RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(8,17,31,0.38)',
    borderWidth: LDS_BORDER_WIDTH.hairline,
    borderColor: LDS_BORDER_COLOR.cockpitPanel,
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
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LDS_SPACING.xxs,
  },
  metricCell: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: LDS_SPACING.xxs,
    paddingVertical: LDS_SPACING.xxs,
    paddingHorizontal: LDS_SPACING.xs,
    borderRadius: LDS_RADIUS.sm,
    backgroundColor: 'rgba(8,17,31,0.32)',
    borderWidth: LDS_BORDER_WIDTH.hairline,
    borderColor: LDS_BORDER_COLOR.cockpitPanel,
  },
  metricCellActive: {
    backgroundColor: 'rgba(8,17,31,0.42)',
  },
  metricLabel: {
    flex: 1,
    fontSize: 10,
    letterSpacing: 0.05,
    opacity: 0.9,
  },
  metricValue: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: 0,
  },
  metricValueActive: {
    opacity: 0.95,
  },
  qmPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: LDS_SPACING.xxs,
    paddingHorizontal: LDS_SPACING.xs,
    borderRadius: LDS_RADIUS.sm,
    backgroundColor: 'rgba(8,17,31,0.24)',
    borderWidth: LDS_BORDER_WIDTH.hairline,
    borderColor: LDS_BORDER_COLOR.cockpitPanel,
    opacity: 0.82,
    maxWidth: 72,
    flexShrink: 0,
  },
  qmLabel: {
    fontSize: 9,
    letterSpacing: 0.04,
    opacity: 0.78,
  },
});
