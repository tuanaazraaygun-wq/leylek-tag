/**
 * Settings hub — theme mode segment (Gece / Gündüz / Sistem). B3-5.
 * Gated by themeSettingsEnabled in settings-hub.tsx.
 */

import React, { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { GlassSurface, PremiumText } from '../../design-system/primitives';
import { LDS_RADIUS } from '../../design-system/tokens/radius';
import { LDS_SPACING } from '../../design-system/tokens/spacing';
import { useTheme } from '../../hooks/useTheme';
import { useThemeSettingsBridge } from '../../lib/theme/themeSettingsBridge';
import type { ThemeMode } from '../../lib/theme/types';

const SEGMENTS: { mode: ThemeMode; label: string; accessibilityLabel: string }[] = [
  { mode: 'dark', label: 'Gece', accessibilityLabel: 'Gece teması' },
  { mode: 'light', label: 'Gündüz', accessibilityLabel: 'Gündüz teması' },
  { mode: 'system', label: 'Sistem', accessibilityLabel: 'Sistem teması' },
];

async function segmentHaptic(): Promise<void> {
  try {
    await Haptics.selectionAsync();
  } catch {
    /* ignore */
  }
}

export default function ThemeSettingsSegment() {
  const { tokens } = useTheme();
  const bridge = useThemeSettingsBridge();
  const themeMode = bridge.getThemeMode();
  const disabled = !bridge.isHydrated();

  const handleSelect = useCallback(
    (mode: ThemeMode) => {
      if (disabled || themeMode === mode) return;
      void segmentHaptic();
      void bridge.setThemeMode(mode);
    },
    [bridge, disabled, themeMode],
  );

  return (
    <GlassSurface variant="plain" style={styles.card}>
      <PremiumText variant="title" style={styles.cardTitle}>
        Görünüm
      </PremiumText>
      <PremiumText variant="caption" muted style={styles.description}>
        LeylekTAG temasını seç
      </PremiumText>

      <View
        style={[
          styles.segmentTrack,
          {
            backgroundColor: tokens.bg.glassMuted,
            borderColor: tokens.borderColors.card,
          },
        ]}
        accessibilityRole="radiogroup"
        accessibilityLabel="Tema seçenekleri"
      >
        {SEGMENTS.map((segment) => {
          const selected = themeMode === segment.mode;
          return (
            <Pressable
              key={segment.mode}
              disabled={disabled}
              onPress={() => handleSelect(segment.mode)}
              style={({ pressed }) => [
                styles.segment,
                {
                  backgroundColor: selected ? tokens.accent.glowLow : 'transparent',
                  borderColor: selected ? tokens.borderColors.selected : 'transparent',
                  opacity: disabled ? 0.5 : pressed ? 0.88 : 1,
                },
              ]}
              accessibilityRole="radio"
              accessibilityState={{ selected, disabled }}
              accessibilityLabel={segment.accessibilityLabel}
            >
              <PremiumText
                variant="body"
                style={[
                  styles.segmentLabel,
                  selected && { color: tokens.accent.primary },
                ]}
              >
                {segment.label}
              </PremiumText>
            </Pressable>
          );
        })}
      </View>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: LDS_SPACING.sm + 2,
    paddingVertical: LDS_SPACING.sm,
  },
  cardTitle: {
    fontSize: 16,
    lineHeight: 22,
    marginBottom: LDS_SPACING.xxs,
    letterSpacing: -0.2,
  },
  description: {
    marginBottom: LDS_SPACING.sm,
  },
  segmentTrack: {
    flexDirection: 'row',
    borderRadius: LDS_RADIUS.md,
    borderWidth: StyleSheet.hairlineWidth + 1,
    padding: 3,
    gap: 4,
  },
  segment: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: LDS_RADIUS.sm,
    borderWidth: 2,
  },
  segmentLabel: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
});
