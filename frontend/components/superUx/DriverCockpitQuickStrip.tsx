import React, { memo, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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

/** Sürücü idle kokpit — trusted network özet sayıları (read-only). */
function DriverCockpitQuickStrip() {
  const { status, summary } = useTrustedSummary();
  const summaryReady = status === 'ready' && summary != null;

  const headerSubtitle = useMemo(() => {
    if (summaryReady && summary) {
      return formatDriverTrustedHeaderSubtitle(summary);
    }
    return STUB_HEADER_SUBTITLE;
  }, [summaryReady, summary]);

  return (
    <View style={styles.wrap} accessibilityRole="summary">
      <LinearGradient
        colors={[PREMIUM_NAVY_DEEP, PREMIUM_NAVY_CARD, 'rgba(16, 26, 43, 0.88)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <View style={styles.headerRow}>
          <View style={styles.titleCol}>
            <Text style={styles.title} numberOfLines={1}>
              Yolcularım
            </Text>
            <Text style={styles.subtitle} numberOfLines={2}>
              {headerSubtitle}
            </Text>
          </View>
          {!summaryReady ? (
            <View style={styles.headerSoonPill}>
              <Text style={styles.headerSoonText}>Yakında</Text>
            </View>
          ) : null}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
          keyboardShouldPersistTaps="handled"
        >
          {CHIPS.map((label) => {
            const isDirect = label === 'Direkt istek';
            const chipMeta =
              summaryReady && summary && !isDirect
                ? chipMetaForLabel(label, summary)
                : null;
            const showSoon = isDirect || !chipMeta;
            const a11ySuffix = showSoon ? 'Yakında' : chipMeta?.trim() ?? '';

            return (
              <Pressable
                key={label}
                disabled
                accessibilityRole="button"
                accessibilityState={{ disabled: true }}
                accessibilityLabel={`${label}. ${a11ySuffix}`}
                style={styles.chip}
              >
                <Text style={styles.chipLabel} numberOfLines={1}>
                  {label}
                </Text>
                {showSoon ? (
                  <Text style={styles.chipSoon}>Yakında</Text>
                ) : (
                  <Text style={styles.chipMeta}>{chipMeta}</Text>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </LinearGradient>
    </View>
  );
}

export default memo(DriverCockpitQuickStrip);

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 12,
    paddingBottom: 4,
  },
  card: {
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth + 1,
    borderColor: PREMIUM_ROLE_COCKPIT_CYAN_EDGE,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  titleCol: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: PREMIUM_TEXT_SOFT,
    letterSpacing: -0.15,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: PREMIUM_TEXT_MUTED,
    lineHeight: 16,
  },
  headerSoonPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(30, 58, 95, 0.55)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PREMIUM_BORDER_SLATE,
  },
  headerSoonText: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(148, 163, 184, 0.92)',
    letterSpacing: 0.35,
    textTransform: 'uppercase',
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(8, 17, 31, 0.55)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PREMIUM_BORDER_SLATE,
    opacity: 0.72,
  },
  chipLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(186, 201, 222, 0.82)',
    maxWidth: 120,
  },
  chipSoon: {
    fontSize: 9,
    fontWeight: '800',
    color: PREMIUM_AUTH_CYAN,
    opacity: 0.65,
    letterSpacing: 0.25,
    textTransform: 'uppercase',
  },
  chipMeta: {
    fontSize: 10,
    fontWeight: '800',
    color: PREMIUM_AUTH_CYAN,
    opacity: 0.85,
    letterSpacing: 0.1,
  },
});
