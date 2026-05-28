/**
 * Paylaşılan harita marker görünümü — rota / provider mantığına dokunmaz.
 */
import React from 'react';
import { Image, ImageSourcePropType, Platform, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const CYAN = '#22D3EE';
const INK = 'rgba(8, 17, 31, 0.82)';

export function MapEntityMarkerImage({
  source,
  size,
  scale = 1,
}: {
  source: ImageSourcePropType;
  size: number;
  scale?: number;
}) {
  const glow = size + 12;
  return (
    <View
      collapsable={false}
      pointerEvents="none"
      style={[styles.entityRoot, scale !== 1 ? { transform: [{ scale }] } : null]}
    >
      <View style={[styles.entityGlow, { width: glow, height: glow, borderRadius: glow / 2 }]} />
      <Image source={source} style={{ width: size, height: size }} resizeMode="contain" />
      <View style={[styles.entityShadow, { width: Math.round(size * 0.7) }]} />
    </View>
  );
}

/** Varış / hedef — premium bayrak pini */
export function MapDestinationFlagPin({ compact = false }: { compact?: boolean }) {
  const poleH = compact ? 44 : 50;
  const bodyW = compact ? 34 : 38;
  const bodyH = compact ? 24 : 26;
  return (
    <View style={styles.flagRoot} collapsable={false} pointerEvents="none">
      <View style={[styles.flagPole, { height: poleH }]} />
      <View style={[styles.flagBody, { width: bodyW, height: bodyH }]}>
        <Ionicons name="flag" size={compact ? 13 : 14} color="rgba(243,248,255,0.94)" />
      </View>
      <View style={styles.flagBase} />
    </View>
  );
}

/** Alış / buluşma — cyan navigasyon pini */
export function MapPickupPin({ compact = false }: { compact?: boolean }) {
  const outer = compact ? 36 : 40;
  const inner = compact ? 26 : 30;
  return (
    <View style={styles.pickupRoot} collapsable={false} pointerEvents="none">
      <View style={[styles.pickupRing, { width: outer, height: outer, borderRadius: outer / 2 }]} />
      <View style={[styles.pickupCore, { width: inner, height: inner, borderRadius: inner / 2 }]}>
        <Ionicons name="navigate" size={compact ? 15 : 17} color={INK} />
      </View>
      <View style={[styles.entityShadow, { width: outer * 0.65, marginTop: 4 }]} />
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
  entityShadow: {
    height: 7,
    backgroundColor: 'rgba(0,0,0,0.22)',
    borderRadius: 4,
    marginTop: 3,
  },
  flagRoot: {
    alignItems: 'flex-start',
  },
  flagPole: {
    width: 4,
    backgroundColor: '#101A2B',
    borderRadius: 2,
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
  flagBase: {
    width: 14,
    height: 7,
    backgroundColor: 'rgba(16, 26, 43, 0.95)',
    borderRadius: 4,
    marginLeft: -5,
    marginTop: 2,
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
});
