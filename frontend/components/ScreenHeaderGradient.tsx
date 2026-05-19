import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

/** Premium cockpit — deep navy → cam kart; cyan edge hissi (logik / layout aynı) */
const GRAD = ['#08111F', '#0B1220', '#101A2B'] as const;

type Props = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  backIcon?: keyof typeof Ionicons.glyphMap;
  right?: React.ReactNode;
  /** Varsayılan: premium dark HUD gradient (>2 renk için locations otomatik) */
  gradientColors?: readonly string[];
};

export function ScreenHeaderGradient({
  title,
  subtitle,
  onBack,
  backIcon = 'arrow-back',
  right,
  gradientColors = GRAD,
}: Props) {
  const insets = useSafeAreaInsets();
  const colorsArr = gradientColors.length ? [...gradientColors] : [...GRAD];
  return (
    <LinearGradient
      colors={colorsArr as [string, string, ...string[]]}
      locations={colorsArr.length === 3 ? [0, 0.55, 1] : undefined}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.grad, { paddingTop: insets.top }]}
    >
      <View style={styles.row}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={styles.iconHit} hitSlop={10} accessibilityRole="button">
            <Ionicons name={backIcon} size={26} color="rgba(243,248,255,0.94)" />
          </TouchableOpacity>
        ) : (
          <View style={styles.iconHit} />
        )}
        <View style={styles.centerBlock}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <View style={styles.rightSlot}>{right || <View style={{ width: 44 }} />}</View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  grad: {
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth + 1,
    borderBottomColor: 'rgba(34,211,238,0.14)',
    ...Platform.select({
      ios: {
        shadowColor: 'rgba(34,211,238,0.22)',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 1,
        shadowRadius: 14,
      },
      android: { elevation: 4 },
      default: {},
    }),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    minHeight: 44,
  },
  centerBlock: { flex: 1, marginHorizontal: 4, alignItems: 'center' },
  iconHit: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    textAlign: 'center',
    color: 'rgba(243,248,255,0.94)',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    marginTop: 2,
    textAlign: 'center',
    color: 'rgba(186,201,222,0.82)',
    fontSize: 12,
    fontWeight: '500',
  },
  rightSlot: { minWidth: 44, alignItems: 'flex-end' },
});
