import React, { memo, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassSurface, PremiumText } from '../../design-system/primitives';
import { LDS_BORDER_COLOR, LDS_BORDER_WIDTH } from '../../design-system/tokens/border';
import { LDS_RADIUS } from '../../design-system/tokens/radius';
import { LDS_SPACING } from '../../design-system/tokens/spacing';
import { PREMIUM_AUTH_CYAN } from '../auth/premiumAuthStyles';
import { useTrustedSummary } from '../../hooks/useTrustedSummary';
import { formatDriverTrustedHeaderSubtitle } from '../../lib/trustedSummaryCopy';
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
  'Aktif yolcular': { shortLabel: 'Aktif yolcu', icon: 'people-outline' },
  'Bekleyen davetler': { shortLabel: 'Bekleyen davet', icon: 'mail-open-outline' },
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
};

/** Sürücü idle kokpit — trusted network özet sayıları (read-only). */
function DriverCockpitQuickStrip({ onTrustedPress }: DriverCockpitQuickStripProps) {
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
      <View style={styles.titleCol}>
        <View style={styles.titleRow}>
          <View style={styles.trustIconWrap}>
            <Ionicons name="shield-checkmark-outline" size={14} color={PREMIUM_AUTH_CYAN} />
          </View>
          <PremiumText variant="step" style={styles.title} numberOfLines={1}>
            Güven ağı
          </PremiumText>
        </View>
        <PremiumText variant="caption" muted style={styles.subtitle} numberOfLines={2}>
          {headerSubtitle}
        </PremiumText>
      </View>
      {headerWired ? (
        <Ionicons name="chevron-forward" size={18} color={PREMIUM_AUTH_CYAN} />
      ) : null}
    </>
  );

  return (
    <View style={styles.wrap} accessibilityRole="summary">
      <GlassSurface variant="panel" style={styles.card} borderRadius={LDS_RADIUS.xl}>
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
          {TRUST_METRIC_KEYS.map((label) => {
            const presentation = METRIC_PRESENTATION[label];
            const chipMeta =
              summaryReady && summary ? chipMetaForLabel(label, summary) : null;
            const value = metricValueFromMeta(chipMeta);
            const hasValue = value !== '—';

            return (
              <View
                key={label}
                style={[styles.metricCell, hasValue && styles.metricCellActive]}
                accessibilityLabel={`${presentation.shortLabel}. ${value}`}
              >
                <View style={styles.metricLabelRow}>
                  <Ionicons
                    name={presentation.icon}
                    size={12}
                    color={hasValue ? PREMIUM_AUTH_CYAN : 'rgba(148,163,184,0.72)'}
                  />
                  <PremiumText variant="caption" muted style={styles.metricLabel} numberOfLines={1}>
                    {presentation.shortLabel}
                  </PremiumText>
                </View>
                <PremiumText
                  variant="title"
                  style={[styles.metricValue, hasValue && styles.metricValueActive]}
                  numberOfLines={1}
                >
                  {value}
                </PremiumText>
              </View>
            );
          })}

          <View
            style={styles.qmPill}
            accessibilityLabel="Hızlı eşleşme. Yakında"
            accessibilityRole="text"
          >
            <Ionicons name="flash-outline" size={13} color="rgba(34,211,238,0.75)" />
            <PremiumText variant="caption" muted style={styles.qmLabel} numberOfLines={1}>
              Hızlı eşleşme
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
    paddingVertical: LDS_SPACING.sm,
    paddingHorizontal: LDS_SPACING.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: LDS_SPACING.sm,
    marginBottom: LDS_SPACING.sm,
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
  titleCol: {
    flex: 1,
    minWidth: 0,
    gap: LDS_SPACING.xxs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LDS_SPACING.xs,
  },
  trustIconWrap: {
    width: LDS_SPACING.lg,
    height: LDS_SPACING.lg,
    borderRadius: LDS_RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(34,211,238,0.08)',
    borderWidth: LDS_BORDER_WIDTH.hairline,
    borderColor: LDS_BORDER_COLOR.cockpitPanel,
  },
  title: {
    letterSpacing: 0.2,
    textTransform: 'uppercase',
    flex: 1,
  },
  subtitle: {
    lineHeight: 15,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: LDS_SPACING.xs,
  },
  metricCell: {
    flex: 1,
    minWidth: 0,
    paddingVertical: LDS_SPACING.xs,
    paddingHorizontal: LDS_SPACING.sm,
    borderRadius: LDS_RADIUS.md,
    backgroundColor: 'rgba(8,17,31,0.42)',
    borderWidth: LDS_BORDER_WIDTH.hairline,
    borderColor: LDS_BORDER_COLOR.cockpitPanel,
    gap: LDS_SPACING.xxs,
  },
  metricCellActive: {
    borderTopColor: 'rgba(34,211,238,0.14)',
    backgroundColor: 'rgba(8,17,31,0.55)',
  },
  metricLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LDS_SPACING.xxs,
  },
  metricLabel: {
    flex: 1,
    fontSize: 10,
    letterSpacing: 0.1,
  },
  metricValue: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '800',
    letterSpacing: -0.25,
    fontVariant: ['tabular-nums'],
    color: 'rgba(148,163,184,0.75)',
    textAlign: 'left',
  },
  metricValueActive: {
    color: 'rgba(94,229,209,0.95)',
  },
  qmPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: LDS_SPACING.xxs,
    paddingVertical: LDS_SPACING.xs,
    paddingHorizontal: LDS_SPACING.sm,
    borderRadius: LDS_RADIUS.md,
    backgroundColor: 'rgba(8,17,31,0.38)',
    borderWidth: LDS_BORDER_WIDTH.hairline,
    borderColor: LDS_BORDER_COLOR.cockpitPanel,
    maxWidth: 108,
  },
  qmLabel: {
    fontSize: 10,
    letterSpacing: 0.05,
  },
});
