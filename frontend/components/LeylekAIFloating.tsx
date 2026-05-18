import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLeylekZekaChrome } from '../contexts/LeylekZekaChromeContext';
import { BorderRadius, Colors, FontSize, Spacing } from '../constants/Colors';
import {
  PREMIUM_AUTH_CYAN,
  PREMIUM_BORDER_SLATE,
  PREMIUM_GLASS_FILL,
  PREMIUM_NAVY_DEEP,
  PREMIUM_NAVY_MID,
  PREMIUM_TEXT_SOFT,
} from './auth/premiumAuthStyles';

const GREETINGS = [
  'Kararsız kaldın gibi 🙂',
  'İstersen yardımcı olayım',
  'Buradayım, sorabilirsin',
  'Sana en iyi seçeneği bulabilirim',
] as const;

const HINT_ROTATION = [
  "Leylek'e sor, yardımcı olayım",
  'Sana en iyi seçeneği bulabilirim',
  'Kararsızsan birlikte bakalım',
  'Daha hızlı eşleşme ister misin?',
] as const;

/** Rol kokpiti: yazarken vurgulanacak alt string’ler (presentation only) */
const COCKPIT_ACCENT_SNIPPETS = [
  'en iyi seçeneği bulabilirim',
  'en iyi seçeneği',
  'en iyi seçeneği bulmama yardım edeyim',
] as const;

const CHAR_MS = 20;
const FIRST_DELAY_MS = 2000;
const BETWEEN_MS_MIN = 10_000;
const BETWEEN_MS_MAX = 15_000;
const HOLD_AFTER_TYPE_MS = 2800;
const TIP_FADE_MS = 320;

const FAB_SIZE = 54;
const FAB_COCKPIT_SIZE = 62;
const TOOLTIP_MAX_W = 280;
const TOOLTIP_COCKPIT_MAX_W = TOOLTIP_MAX_W + 28;

export type LeylekAIFloatingPosition = 'center-bottom' | 'top-left' | 'driver-waiting';

export type LeylekAIFloatingVisualPreset = 'default' | 'roleCockpit';

export type LeylekAIFloatingProps = {
  position: LeylekAIFloatingPosition;
  message: string;
  /** Rol seçim: premium kokpit / holografik orb */
  visualPreset?: LeylekAIFloatingVisualPreset;
};

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function renderTypedWithCockpitAccent(
  text: string,
  preset: LeylekAIFloatingVisualPreset,
  baseStyle: object,
  accentStyle: object,
) {
  if (preset !== 'roleCockpit' || !text) {
    return <Text style={baseStyle}>{text}</Text>;
  }
  for (const snip of COCKPIT_ACCENT_SNIPPETS) {
    const i = text.indexOf(snip);
    if (i >= 0) {
      return (
        <Text style={baseStyle}>
          {text.slice(0, i)}
          <Text style={accentStyle}>{snip}</Text>
          {text.slice(i + snip.length)}
        </Text>
      );
    }
  }
  return <Text style={baseStyle}>{text}</Text>;
}

export default function LeylekAIFloating({
  position,
  message,
  visualPreset = 'default',
}: LeylekAIFloatingProps) {
  const insets = useSafeAreaInsets();
  const { setLeylekZekaChatOpen } = useLeylekZekaChrome();
  const cockpit = visualPreset === 'roleCockpit';
  const fabSize = cockpit ? FAB_COCKPIT_SIZE : FAB_SIZE;

  const [pickedGreeting] = useState(
    () => GREETINGS[Math.floor(Math.random() * GREETINGS.length)] as string,
  );

  const messages = useMemo(() => {
    const rest = HINT_ROTATION.filter((m) => m !== message && m !== pickedGreeting);
    return [pickedGreeting, message, ...rest];
  }, [message, pickedGreeting]);

  const [typedText, setTypedText] = useState('');
  const [pulseSuspended, setPulseSuspended] = useState(false);

  const tipOpacity = useRef(new Animated.Value(0)).current;
  const tipBubbleScale = useRef(new Animated.Value(1)).current;
  const fabPulse = useRef(new Animated.Value(1)).current;
  const pulseLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const firstTooltipShownRef = useRef(false);

  const stopFabPulse = useCallback(() => {
    pulseLoopRef.current?.stop();
    pulseLoopRef.current = null;
    fabPulse.stopAnimation();
    fabPulse.setValue(1);
  }, [fabPulse]);

  const startFabPulse = useCallback(() => {
    stopFabPulse();
    const toScale = cockpit ? 1.045 : 1.05;
    const dur = cockpit ? 1800 : 1400;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(fabPulse, {
          toValue: toScale,
          duration: dur,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(fabPulse, {
          toValue: 1,
          duration: dur,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    pulseLoopRef.current = loop;
    loop.start();
  }, [cockpit, fabPulse, stopFabPulse]);

  useEffect(() => {
    if (pulseSuspended) {
      stopFabPulse();
      return;
    }
    startFabPulse();
    return () => stopFabPulse();
  }, [pulseSuspended, startFabPulse, stopFabPulse]);

  useEffect(() => {
    let cancelled = false;
    const messagesRef = messages;

    const fadeTip = (to: number) =>
      new Promise<void>((resolve) => {
        Animated.timing(tipOpacity, {
          toValue: to,
          duration: TIP_FADE_MS,
          easing: to > 0 ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
          useNativeDriver: true,
        }).start(() => resolve());
      });

    const run = async () => {
      await sleep(FIRST_DELAY_MS);
      if (cancelled) return;

      let idx = 0;
      while (!cancelled) {
        const full = messagesRef[idx % messagesRef.length];

        setPulseSuspended(true);
        setTypedText('');

        const isFirstEver = !firstTooltipShownRef.current;
        firstTooltipShownRef.current = true;

        if (isFirstEver) {
          tipBubbleScale.setValue(0.9);
          await new Promise<void>((resolve) => {
            Animated.parallel([
              Animated.spring(tipBubbleScale, {
                toValue: 1,
                friction: 7,
                tension: 80,
                useNativeDriver: true,
              }),
              Animated.timing(tipOpacity, {
                toValue: 1,
                duration: TIP_FADE_MS,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
              }),
            ]).start(() => resolve());
          });
        } else {
          tipBubbleScale.setValue(1);
          await fadeTip(1);
        }

        if (cancelled) return;

        for (let i = 0; i <= full.length; i += 1) {
          if (cancelled) return;
          setTypedText(full.slice(0, i));
          if (i < full.length) {
            await sleep(CHAR_MS);
          }
        }

        if (cancelled) return;
        await sleep(HOLD_AFTER_TYPE_MS);
        if (cancelled) return;

        await fadeTip(0);
        if (cancelled) return;

        setTypedText('');
        idx += 1;

        setPulseSuspended(false);

        const gap = BETWEEN_MS_MIN + Math.random() * (BETWEEN_MS_MAX - BETWEEN_MS_MIN);
        await sleep(gap);
      }
    };

    void run();
    return () => {
      cancelled = true;
      stopFabPulse();
    };
  }, [messages, tipOpacity, tipBubbleScale, stopFabPulse]);

  const onOpen = useCallback(() => {
    setLeylekZekaChatOpen(true);
  }, [setLeylekZekaChatOpen]);

  const rootStyle: ViewStyle =
    position === 'top-left'
      ? {
          position: 'absolute',
          top: insets.top + Spacing.sm,
          left: Spacing.md,
          zIndex: 50,
          alignItems: 'flex-start',
        }
      : position === 'driver-waiting'
        ? {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: Math.max(insets.bottom, Spacing.sm) + Spacing.md,
            zIndex: 50,
            alignItems: 'center',
          }
        : {
            width: '100%',
            alignItems: 'center',
            marginBottom: Spacing.sm,
          };

  const st = cockpit ? stylesCockpit : stylesDefault;
  const fabGradColors = cockpit
    ? (['#22D3EE', '#0EA5E9', '#2563EB', '#1D4ED8'] as const)
    : (['#22D3EE', '#3FA9F5', '#6366F1', '#7C3AED'] as const);
  const fabGradLocations = cockpit ? ([0, 0.35, 0.7, 1] as const) : ([0, 0.35, 0.65, 1] as const);

  return (
    <View pointerEvents="box-none" style={rootStyle}>
      <Animated.View
        pointerEvents="none"
        style={[
          st.tooltipWrap,
          (position === 'center-bottom' || position === 'driver-waiting') && { alignSelf: 'center' },
          {
            opacity: tipOpacity,
            transform: [{ scale: tipBubbleScale }],
          },
        ]}
      >
        <View style={st.tooltip}>
          {cockpit ? (
            <>
              <LinearGradient
                pointerEvents="none"
                colors={[
                  'rgba(255,255,255,0.11)',
                  'rgba(255,255,255,0)',
                  'transparent',
                ]}
                locations={[0, 0.22, 1]}
                start={{ x: 0.05, y: 0 }}
                end={{ x: 0.65, y: 0.5 }}
                style={StyleSheet.absoluteFillObject}
              />
              <View style={{ zIndex: 1 }}>
                {renderTypedWithCockpitAccent(
                  typedText,
                  visualPreset,
                  st.tooltipText,
                  st.tooltipAccent,
                )}
              </View>
            </>
          ) : (
            renderTypedWithCockpitAccent(typedText, visualPreset, st.tooltipText, st.tooltipAccent)
          )}
        </View>
        <View style={st.tooltipTail} />
      </Animated.View>

      <Animated.View style={{ transform: [{ scale: fabPulse }] }}>
        <Pressable
          onPress={onOpen}
          accessibilityRole="button"
          accessibilityLabel="Leylek AI asistanı"
          style={({ pressed }) => [
            cockpit ? st.fabPressable : stylesDefault.fabPressable,
            cockpit && {
              width: fabSize,
              height: fabSize,
              borderRadius: fabSize / 2,
            },
            pressed && { opacity: 0.92 },
          ]}
        >
          {cockpit ? (
            <>
              <View
                style={[
                  stylesCockpit.fabOuterRing,
                  { width: fabSize, height: fabSize, borderRadius: fabSize / 2 },
                ]}
              >
                <View
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    left: 4,
                    top: 4,
                    right: 4,
                    bottom: 4,
                    borderRadius: (fabSize - 8) / 2,
                    borderWidth: 1,
                    borderColor: 'rgba(165,243,252,0.14)',
                  }}
                />
                <LinearGradient
                  colors={fabGradColors as unknown as [string, string, ...string[]]}
                  locations={[...fabGradLocations]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[
                    stylesCockpit.fabGradInner,
                    {
                      width: fabSize - 4,
                      height: fabSize - 4,
                      borderRadius: (fabSize - 4) / 2,
                    },
                  ]}
                >
                  <LinearGradient
                    pointerEvents="none"
                    colors={[
                      'rgba(255,255,255,0.2)',
                      'rgba(186,230,253,0.03)',
                      'transparent',
                      'transparent',
                      'rgba(15,118,217,0.16)',
                    ]}
                    locations={[0, 0.15, 0.38, 0.62, 1]}
                    start={{ x: 0.05, y: 0 }}
                    end={{ x: 0.95, y: 0.92 }}
                    style={StyleSheet.absoluteFillObject}
                  />
                  <Ionicons name="sparkles" size={30} color="rgba(243,248,255,0.96)" />
                </LinearGradient>
              </View>
              <View style={stylesCockpit.aiBadge} pointerEvents="none">
                <Text style={stylesCockpit.aiBadgeText}>AI</Text>
              </View>
            </>
          ) : (
            <>
              <LinearGradient
                colors={fabGradColors as unknown as [string, string, ...string[]]}
                locations={[...fabGradLocations]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={stylesDefault.fabGrad}
              >
                <Ionicons name="sparkles" size={26} color="#FFF" />
              </LinearGradient>
              <View style={stylesDefault.aiBadge} pointerEvents="none">
                <Text style={stylesDefault.aiBadgeText}>AI</Text>
              </View>
            </>
          )}
        </Pressable>
      </Animated.View>
    </View>
  );
}

const stylesDefault = StyleSheet.create({
  tooltipWrap: {
    maxWidth: TOOLTIP_MAX_W,
    marginBottom: Spacing.sm,
  },
  tooltip: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(63, 169, 245, 0.22)',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  tooltipText: {
    color: Colors.text,
    fontSize: FontSize.sm,
    fontWeight: '600',
    lineHeight: 20,
  },
  tooltipAccent: {},
  tooltipTail: {
    alignSelf: 'center',
    marginTop: -2,
    width: 10,
    height: 10,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(63, 169, 245, 0.18)',
    transform: [{ rotate: '-45deg' }],
    marginBottom: 2,
  },
  fabPressable: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    shadowColor: '#312e81',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 8,
  },
  fabGrad: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  aiBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 26,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: BorderRadius.md,
    backgroundColor: '#F0ABFC',
    borderWidth: 1.5,
    borderColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#a855f7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 6,
    elevation: 4,
  },
  aiBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#4C1D95',
    letterSpacing: 0.5,
  },
});

const stylesCockpit = StyleSheet.create({
  tooltipWrap: {
    maxWidth: TOOLTIP_COCKPIT_MAX_W,
    marginBottom: Spacing.sm + 2,
  },
  tooltip: {
    overflow: 'hidden',
    backgroundColor: PREMIUM_GLASS_FILL,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: Spacing.md + 4,
    borderWidth: StyleSheet.hairlineWidth + 1,
    borderColor: PREMIUM_BORDER_SLATE,
    borderTopColor: 'rgba(34,211,238,0.18)',
    ...Platform.select({
      ios: {
        shadowColor: PREMIUM_NAVY_DEEP,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.48,
        shadowRadius: 22,
      },
      android: { elevation: 12 },
      default: {},
    }),
  },
  tooltipText: {
    color: PREMIUM_TEXT_SOFT,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 21,
    letterSpacing: -0.15,
  },
  tooltipAccent: {
    color: PREMIUM_AUTH_CYAN,
    fontWeight: '800',
  },
  tooltipTail: {
    alignSelf: 'center',
    marginTop: -2,
    width: 10,
    height: 10,
    backgroundColor: 'rgba(16,26,43,0.92)',
    borderLeftWidth: StyleSheet.hairlineWidth + 1,
    borderBottomWidth: StyleSheet.hairlineWidth + 1,
    borderColor: 'rgba(30,58,95,0.85)',
    transform: [{ rotate: '-45deg' }],
    marginBottom: 2,
  },
  fabPressable: {
    borderRadius: FAB_COCKPIT_SIZE / 2,
    ...Platform.select({
      ios: {
        shadowColor: PREMIUM_AUTH_CYAN,
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.12,
        shadowRadius: 18,
      },
      android: { elevation: 12 },
      default: {},
    }),
  },
  fabOuterRing: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(34,211,238,0.32)',
    backgroundColor: 'rgba(8,17,31,0.4)',
  },
  fabGradInner: {
    borderRadius: FAB_COCKPIT_SIZE / 2 - 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  aiBadge: {
    position: 'absolute',
    top: -1,
    right: -1,
    minWidth: 28,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: PREMIUM_NAVY_MID,
    borderWidth: StyleSheet.hairlineWidth + 1,
    borderColor: 'rgba(34,211,238,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: PREMIUM_NAVY_DEEP,
        shadowOpacity: 0.35,
        shadowRadius: 6,
      },
      android: { elevation: 4 },
      default: {},
    }),
  },
  aiBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: PREMIUM_TEXT_SOFT,
    letterSpacing: 0.6,
  },
});
