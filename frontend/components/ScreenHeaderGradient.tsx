import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const GRAD = ['#007AFF', '#5AC8FA'] as const;

type Props = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  backIcon?: keyof typeof Ionicons.glyphMap;
  right?: React.ReactNode;
  /** Varsayılan: Leylek mavi gradient */
  gradientColors?: readonly [string, string];
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
  return (
    <LinearGradient
      colors={[gradientColors[0], gradientColors[1]]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={[styles.grad, { paddingTop: insets.top }]}
    >
      <View style={styles.row}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={styles.iconHit} hitSlop={10} accessibilityRole="button">
            <Ionicons name={backIcon} size={26} color="#FFFFFF" />
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
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
      },
      android: { elevation: 3 },
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
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    marginTop: 2,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.88)',
    fontSize: 12,
    fontWeight: '500',
  },
  rightSlot: { minWidth: 44, alignItems: 'flex-end' },
});
