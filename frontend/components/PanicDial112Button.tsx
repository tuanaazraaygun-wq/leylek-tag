/**
 * Yerel panik: tel:112 ile çevirici açar. Backend / depolama / SMS yok.
 */
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { appAlert } from '../contexts/AppAlertContext';

const HINT_INTERVAL_MS_MIN = 8000;
const HINT_INTERVAL_MS_MAX = 12000;
const HINT_HOLD_MS = 2600;

type Props = {
  /** Küçük üst şerit harita (teklif beklerken): güvenli alan yok */
  variant?: 'mapStrip' | 'mapOverlay';
};

export default function PanicDial112Button({ variant = 'mapOverlay' }: Props) {
  const fade = useRef(new Animated.Value(0)).current;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clear = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    const runHintCycle = () => {
      Animated.sequence([
        Animated.timing(fade, { toValue: 1, duration: 420, useNativeDriver: true }),
        Animated.delay(HINT_HOLD_MS),
        Animated.timing(fade, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start();
    };

    const scheduleNext = () => {
      const gap =
        HINT_INTERVAL_MS_MIN +
        Math.random() * (HINT_INTERVAL_MS_MAX - HINT_INTERVAL_MS_MIN);
      timeoutRef.current = setTimeout(() => {
        runHintCycle();
        scheduleNext();
      }, gap);
    };

    const firstDelay = 2500 + Math.random() * 2500;
    timeoutRef.current = setTimeout(() => {
      runHintCycle();
      scheduleNext();
    }, firstDelay);

    return () => {
      clear();
      fade.stopAnimation();
    };
  }, [fade]);

  const onPress = async () => {
    const url = 'tel:112';
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        appAlert(
          'Arama açılamadı',
          Platform.OS === 'ios'
            ? '112 için telefon uygulamasını kullanın.'
            : 'Bu cihazda 112 araması başlatılamıyor. Lütfen çeviriciyi elle açın.',
        );
        return;
      }
      await Linking.openURL(url);
    } catch {
      appAlert(
        'Hata',
        '112 araması başlatılamadı. Lütfen telefonunuzdan manuel olarak 112 arayın.',
      );
    }
  };

  const top = variant === 'mapStrip' ? 10 : 12;
  const left = variant === 'mapStrip' ? 10 : 12;

  return (
    <View style={[styles.root, { top, left }]} pointerEvents="box-none">
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Acil yardım hattı 112"
        onPress={onPress}
        activeOpacity={0.88}
        style={styles.fab}
      >
        <Ionicons name="warning" size={19} color="#FFFFFF" />
      </TouchableOpacity>
      <Animated.View style={[styles.hintBubble, { opacity: fade }]} pointerEvents="none">
        <Text style={styles.hintText}>Panik anında basın</Text>
      </Animated.View>
    </View>
  );
}

const FAB = 40;

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    zIndex: 50,
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '88%',
  },
  fab: {
    width: FAB,
    height: FAB,
    borderRadius: FAB / 2,
    backgroundColor: '#B91C1C',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(254,202,202,0.85)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 4,
    elevation: 6,
  },
  hintBubble: {
    marginLeft: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(15,23,42,0.72)',
    maxWidth: 220,
  },
  hintText: {
    color: 'rgba(248,250,252,0.92)',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
