/**
 * First-run theme choice — B3-3.
 * Preview is component-local; app theme unchanged until CTA (lightThemeEnabled may still force dark resolve).
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
  useWindowDimensions,
  type ColorSchemeName,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { PremiumGradientCtaButton } from '../auth/premiumAuthChrome';
import { useTheme } from '../../hooks/useTheme';
import { buildThemeTokens } from '../../lib/theme/buildTheme';
import { completeThemeChoice } from '../../lib/theme/themeChoiceGate';
import type { LhThemeTokens, ResolvedTheme, ThemeMode } from '../../lib/theme/types';
import { tapButtonHaptic } from '../../utils/touchHaptics';
import * as Haptics from 'expo-haptics';

const LOGO = require('../../assets/images/leylek-logo-premium.png');

type ThemeChoiceOption = {
  mode: ThemeMode;
  label: string;
  caption: string;
  accessibilityLabel: string;
};

const OPTIONS: ThemeChoiceOption[] = [
  { mode: 'dark', label: 'Karanlık Tema', caption: 'Koyu kokpit görünümü', accessibilityLabel: 'Karanlık tema' },
  { mode: 'light', label: 'Aydınlık Tema', caption: 'Aydınlık görünüm', accessibilityLabel: 'Aydınlık tema' },
  { mode: 'system', label: 'Sistem temasını kullan', caption: 'Cihazınla aynı', accessibilityLabel: 'Sistem teması' },
];

function previewResolved(mode: ThemeMode, systemScheme: ColorSchemeName | null | undefined): ResolvedTheme {
  if (mode === 'light') return 'light';
  if (mode === 'dark') return 'dark';
  return systemScheme === 'light' ? 'light' : 'dark';
}

async function themeCardHaptic(): Promise<void> {
  try {
    await Haptics.selectionAsync();
  } catch {
    /* ignore */
  }
}

export type ThemeChoiceScreenProps = {
  userId?: string | null;
  onComplete: () => void;
};

export default function ThemeChoiceScreen({ userId, onComplete }: ThemeChoiceScreenProps) {
  const insets = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();
  const deviceScheme = useColorScheme();
  const { setTheme } = useTheme();

  const [selectedMode, setSelectedMode] = useState<ThemeMode>('dark');
  const [busy, setBusy] = useState(false);

  const previewTheme = useMemo(
    () => previewResolved(selectedMode, deviceScheme),
    [selectedMode, deviceScheme],
  );
  const tokens = useMemo(() => buildThemeTokens(previewTheme), [previewTheme]);

  const padH = Math.min(22, Math.max(14, Math.round(winW * 0.045)));
  const columnW = Math.min(400, winW - padH * 2);

  const handleSelect = useCallback((mode: ThemeMode) => {
    void themeCardHaptic();
    setSelectedMode(mode);
  }, []);

  const handleContinue = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      void tapButtonHaptic();
      await completeThemeChoice(userId, selectedMode, setTheme);
      onComplete();
    } finally {
      setBusy(false);
    }
  }, [busy, onComplete, selectedMode, setTheme, userId]);

  return (
    <View style={[styles.root, { backgroundColor: tokens.bg.canvas }]}>
      <LinearGradient colors={[...tokens.gradient.cockpitBase]} style={StyleSheet.absoluteFillObject} />
      <LinearGradient
        colors={[tokens.gradient.cockpitTopHaze, 'transparent']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.45 }}
      />

      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
        <View
          style={[
            styles.column,
            {
              width: columnW,
              paddingHorizontal: padH,
              paddingBottom: Math.max(insets.bottom, 12),
            },
          ]}
        >
          <Image source={LOGO} style={styles.logo} resizeMode="contain" accessibilityIgnoresInvertColors />

          <View style={styles.header} accessibilityRole="header">
            <ThemedText tokens={tokens} variant="title">
              LeylekTAG görünümünü seç
            </ThemedText>
            <ThemedText tokens={tokens} variant="subtitle">
              İstersen daha sonra ayarlardan değiştirebilirsin
            </ThemedText>
          </View>

          <View style={styles.cardList} accessibilityRole="radiogroup" accessibilityLabel="Tema seçenekleri">
            {OPTIONS.map((option) => {
              const selected = selectedMode === option.mode;
              const optionPreview = buildThemeTokens(previewResolved(option.mode, deviceScheme));
              return (
                <Pressable
                  key={option.mode}
                  onPress={() => handleSelect(option.mode)}
                  style={[
                    styles.card,
                    {
                      backgroundColor: optionPreview.bg.glass,
                      borderColor: selected ? optionPreview.border.emphasis : optionPreview.border.default,
                      shadowColor: selected ? optionPreview.accent.primary : 'transparent',
                    },
                    selected ? styles.cardSelected : null,
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected, checked: selected }}
                  accessibilityLabel={option.accessibilityLabel}
                >
                  <View style={styles.cardRow}>
                    <View
                      style={[
                        styles.previewSwatch,
                        {
                          backgroundColor: optionPreview.bg.canvas,
                          borderColor: optionPreview.border.default,
                        },
                      ]}
                    >
                      <View style={[styles.previewDot, { backgroundColor: optionPreview.accent.primary }]} />
                    </View>
                    <View style={styles.cardCopy}>
                      <ThemedText tokens={optionPreview} variant="title" style={styles.cardTitle}>
                        {option.label}
                      </ThemedText>
                      <ThemedText tokens={optionPreview} variant="subtitle">
                        {option.caption}
                      </ThemedText>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.ctaWrap}>
            <PremiumGradientCtaButton
              label="Bu temayla devam et"
              busy={busy}
              onPress={() => void handleContinue()}
              accessibilityLabel="Bu temayla devam et"
            />
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

function ThemedText({
  tokens,
  variant,
  children,
  style,
}: {
  tokens: LhThemeTokens;
  variant: 'title' | 'subtitle';
  children: React.ReactNode;
  style?: object;
}) {
  const isTitle = variant === 'title';
  return (
    <Text
      style={[
        isTitle ? styles.titleText : styles.subtitleText,
        { color: isTitle ? tokens.text.primary : tokens.text.muted },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  column: { flex: 1, alignSelf: 'center', alignItems: 'stretch' },
  logo: { width: 80, height: 80, alignSelf: 'center', marginTop: 8, marginBottom: 16 },
  header: { marginBottom: 20, alignItems: 'center' },
  titleText: { fontSize: 22, fontWeight: '700', textAlign: 'center', letterSpacing: 0.2 },
  subtitleText: { fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  cardList: { gap: 12, flexGrow: 1 },
  card: {
    borderRadius: 18,
    borderWidth: 2,
    paddingVertical: 14,
    paddingHorizontal: 14,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 3,
  },
  cardSelected: { transform: [{ scale: 1.02 }] },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  previewSwatch: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth + 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  previewDot: { width: 10, height: 10, borderRadius: 5 },
  cardCopy: { flex: 1 },
  cardTitle: { textAlign: 'left', fontSize: 17 },
  ctaWrap: { marginTop: 20 },
});
