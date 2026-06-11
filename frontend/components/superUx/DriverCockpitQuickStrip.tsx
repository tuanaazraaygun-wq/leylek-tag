import React, { memo } from 'react';
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

const CHIPS = [
  'Aktif yolcular',
  'Bekleyen davetler',
  'Güven ağı',
  'Direkt istek',
] as const;

/** Sürücü idle kokpit — trusted network görsel kabuğu (backend/stub). */
function DriverCockpitQuickStrip() {
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
              Güven ağı ve direkt eşleşme yakında
            </Text>
          </View>
          <View style={styles.headerSoonPill}>
            <Text style={styles.headerSoonText}>Yakında</Text>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
          keyboardShouldPersistTaps="handled"
        >
          {CHIPS.map((label) => (
            <Pressable
              key={label}
              disabled
              accessibilityRole="button"
              accessibilityState={{ disabled: true }}
              accessibilityLabel={`${label}. Yakında`}
              style={styles.chip}
            >
              <Text style={styles.chipLabel} numberOfLines={1}>
                {label}
              </Text>
              <Text style={styles.chipSoon}>Yakında</Text>
            </Pressable>
          ))}
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
});
