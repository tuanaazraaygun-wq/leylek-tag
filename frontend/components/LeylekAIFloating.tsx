import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
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

const CHAR_MS = 20;
const FIRST_DELAY_MS = 2000;
const BETWEEN_MS_MIN = 10_000;
const BETWEEN_MS_MAX = 15_000;
const HOLD_AFTER_TYPE_MS = 2800;
const TIP_FADE_MS = 320;

const FAB_SIZE = 54;
const TOOLTIP_MAX_W = 280;

export type LeylekAIFloatingPosition = 'center-bottom' | 'top-left';

export type LeylekAIFloatingProps = {
  position: LeylekAIFloatingPosition;
  message: string;
};

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export default function LeylekAIFloating({ position, message }: LeylekAIFloatingProps) {
  const insets = useSafeAreaInsets();
  const { setLeylekZekaChatOpen } = useLeylekZekaChrome();

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
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(fabPulse, {
          toValue: 1.05,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(fabPulse, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    pulseLoopRef.current = loop;
    loop.start();
  }, [fabPulse, stopFabPulse]);

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
      : {
          width: '100%',
          alignItems: 'center',
          marginBottom: Spacing.sm,
        };

  return (
    <View pointerEvents="box-none" style={rootStyle}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.tooltipWrap,
          position === 'center-bottom' && { alignSelf: 'center' },
          {
            opacity: tipOpacity,
            transform: [{ scale: tipBubbleScale }],
          },
        ]}
      >
        <View style={styles.tooltip}>
          <Text style={styles.tooltipText}>{typedText}</Text>
        </View>
        <View style={styles.tooltipTail} />
      </Animated.View>

      <Animated.View style={{ transform: [{ scale: fabPulse }] }}>
        <Pressable
          onPress={onOpen}
          accessibilityRole="button"
          accessibilityLabel="Leylek AI asistanı"
          style={({ pressed }) => [styles.fabPressable, pressed && { opacity: 0.92 }]}
        >
          <LinearGradient
            colors={['#22D3EE', '#3FA9F5', '#6366F1', '#7C3AED']}
            locations={[0, 0.35, 0.65, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.fabGrad}
          >
            <Ionicons name="sparkles" size={26} color="#FFF" />
          </LinearGradient>
          <View style={styles.aiBadge} pointerEvents="none">
            <Text style={styles.aiBadgeText}>AI</Text>
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
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
