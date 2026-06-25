/**
 * Paylaşılan harita marker görünümü — rota / provider mantığına dokunmaz.
 */
import React from 'react';
import { Image, ImageSourcePropType, Platform, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { MapMarkerChromeTone } from './theme/useMapMarkerTheme';
import { MAP_MARKER_LIGHT_SIZE_SCALE } from './theme/useMapMarkerTheme';

const CYAN = '#22D3EE';
const INK = 'rgba(8, 17, 31, 0.82)';
const TEAL_RIM = 'rgba(0, 212, 170, 0.32)';

function lightDimension(base: number, chromeTone: MapMarkerChromeTone): number {
  return chromeTone === 'light' ? Math.round(base * MAP_MARKER_LIGHT_SIZE_SCALE) : base;
}

export function MapEntityMarkerImage({
  source,
  size,
  scale = 1,
  chromeTone = 'dark',
}: {
  source: ImageSourcePropType;
  size: number;
  scale?: number;
  chromeTone?: MapMarkerChromeTone;
}) {
  const isLight = chromeTone === 'light';
  const glowPad = isLight ? 8 : 12;
  const glow = size + glowPad;
  return (
    <View
      collapsable={false}
      pointerEvents="none"
      style={[styles.entityRoot, scale !== 1 ? { transform: [{ scale }] } : null]}
    >
      <View
        style={[
          styles.entityGlow,
          { width: glow, height: glow, borderRadius: glow / 2 },
          isLight && styles.entityGlowLight,
        ]}
      />
      <Image
        source={source}
        style={{ width: size, height: size, zIndex: 1 }}
        resizeMode="contain"
      />
      <View
        style={[
          styles.entityShadow,
          { width: Math.round(size * 0.7) },
          isLight && styles.entityShadowLight,
        ]}
      />
    </View>
  );
}

/** Varış / hedef — premium bayrak pini */
export function MapDestinationFlagPin({
  compact = false,
  chromeTone = 'dark',
}: {
  compact?: boolean;
  chromeTone?: MapMarkerChromeTone;
}) {
  const isLight = chromeTone === 'light';
  const poleH = lightDimension(compact ? 44 : 50, chromeTone);
  const bodyW = lightDimension(compact ? 34 : 38, chromeTone);
  const bodyH = lightDimension(compact ? 24 : 26, chromeTone);
  return (
    <View style={styles.flagRoot} collapsable={false} pointerEvents="none">
      <View style={[styles.flagPole, isLight && styles.flagPoleLight, { height: poleH }]} />
      <View
        style={[
          styles.flagBody,
          isLight && styles.flagBodyLight,
          { width: bodyW, height: bodyH },
        ]}
      >
        <Ionicons
          name="flag"
          size={compact ? 13 : 14}
          color={isLight ? '#0F766E' : 'rgba(243,248,255,0.94)'}
        />
      </View>
      <View style={[styles.flagBase, isLight && styles.flagBaseLight]} />
    </View>
  );
}

/** Alış / buluşma — cyan navigasyon pini */
export function MapPickupPin({
  compact = false,
  chromeTone = 'dark',
}: {
  compact?: boolean;
  chromeTone?: MapMarkerChromeTone;
}) {
  const isLight = chromeTone === 'light';
  const outer = lightDimension(compact ? 36 : 40, chromeTone);
  const inner = lightDimension(compact ? 26 : 30, chromeTone);
  return (
    <View style={styles.pickupRoot} collapsable={false} pointerEvents="none">
      <View
        style={[
          styles.pickupRing,
          isLight && styles.pickupRingLight,
          { width: outer, height: outer, borderRadius: outer / 2 },
        ]}
      />
      <View
        style={[
          styles.pickupCore,
          isLight && styles.pickupCoreLight,
          { width: inner, height: inner, borderRadius: inner / 2 },
        ]}
      >
        <Ionicons
          name="navigate"
          size={compact ? 15 : 17}
          color={isLight ? '#0F766E' : INK}
        />
      </View>
      <View
        style={[
          styles.entityShadow,
          { width: outer * 0.65, marginTop: 4 },
          isLight && styles.entityShadowLight,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  entityRoot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  entityGlow: {
    position: 'absolute',
    backgroundColor: 'rgba(34, 211, 238, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.28)',
  },
  entityGlowLight: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: TEAL_RIM,
    ...Platform.select({
      ios: {
        shadowColor: 'rgba(15, 23, 42, 0.14)',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 1,
        shadowRadius: 3,
      },
      android: { elevation: 2 },
      default: {},
    }),
  },
  entityShadow: {
    height: 7,
    backgroundColor: 'rgba(0,0,0,0.22)',
    borderRadius: 4,
    marginTop: 3,
  },
  entityShadowLight: {
    height: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.12)',
    marginTop: 4,
  },
  flagRoot: {
    alignItems: 'flex-start',
  },
  flagPole: {
    width: 4,
    backgroundColor: '#101A2B',
    borderRadius: 2,
  },
  flagPoleLight: {
    backgroundColor: '#64748B',
  },
  flagBody: {
    position: 'absolute',
    top: 0,
    left: 4,
    backgroundColor: INK,
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.48)',
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'android'
      ? { elevation: 8 }
      : {
          shadowColor: '#22D3EE',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.35,
          shadowRadius: 6,
        }),
  },
  flagBodyLight: {
    backgroundColor: '#FFFFFF',
    borderColor: TEAL_RIM,
    ...(Platform.OS === 'android'
      ? { elevation: 4 }
      : {
          shadowColor: 'rgba(15, 23, 42, 0.12)',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 1,
          shadowRadius: 5,
        }),
  },
  flagBase: {
    width: 14,
    height: 7,
    backgroundColor: 'rgba(16, 26, 43, 0.95)',
    borderRadius: 4,
    marginLeft: -5,
    marginTop: 2,
  },
  flagBaseLight: {
    backgroundColor: 'rgba(100, 116, 139, 0.35)',
  },
  pickupRoot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickupRing: {
    position: 'absolute',
    backgroundColor: 'rgba(34, 211, 238, 0.14)',
    borderWidth: 1.5,
    borderColor: 'rgba(34, 211, 238, 0.45)',
  },
  pickupRingLight: {
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderColor: TEAL_RIM,
  },
  pickupCore: {
    backgroundColor: CYAN,
    borderWidth: 2,
    borderColor: 'rgba(243, 248, 255, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'android'
      ? { elevation: 6 }
      : {
          shadowColor: CYAN,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.45,
          shadowRadius: 5,
        }),
  },
  pickupCoreLight: {
    backgroundColor: '#FFFFFF',
    borderColor: TEAL_RIM,
    ...(Platform.OS === 'android'
      ? { elevation: 4 }
      : {
          shadowColor: 'rgba(15, 23, 42, 0.10)',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 1,
          shadowRadius: 4,
        }),
  },
});
