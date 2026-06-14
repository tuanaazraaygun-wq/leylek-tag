import React, { memo } from 'react';
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { LDS_BORDER_COLOR, LDS_BORDER_WIDTH } from '../tokens/border';
import { LDS_RADIUS } from '../tokens/radius';
import {
  LDS_GRADIENT_GLASS_SHEEN_HEADER,
  LDS_GRADIENT_GLASS_SHEEN_HEADER_LOCATIONS,
  LDS_GRADIENT_GLASS_SHEEN_PANEL,
  LDS_GRADIENT_GLASS_SHEEN_PANEL_LOCATIONS,
} from '../tokens/gradient';

export type GlassSurfaceVariant = 'panel' | 'header' | 'stage' | 'plain';

export type GlassSurfaceProps = {
  children: React.ReactNode;
  variant?: GlassSurfaceVariant;
  style?: StyleProp<ViewStyle>;
  borderRadius?: number;
  selected?: boolean;
};

const VARIANT_DEFAULTS: Record<
  GlassSurfaceVariant,
  {
    backgroundColor: string;
    borderColor: string;
    borderTopColor: string;
    borderLeftColor?: string;
    borderRadius: number;
    sheen: readonly string[];
    sheenLocations: readonly number[];
    sheenStart: { x: number; y: number };
    sheenEnd: { x: number; y: number };
  }
> = {
  panel: {
    backgroundColor: 'rgba(5,11,24,0.44)',
    borderColor: LDS_BORDER_COLOR.cockpitPanel,
    borderTopColor: LDS_BORDER_COLOR.cockpitPanelTop,
    borderLeftColor: LDS_BORDER_COLOR.cockpitPanelLeft,
    borderRadius: 26,
    sheen: LDS_GRADIENT_GLASS_SHEEN_PANEL,
    sheenLocations: LDS_GRADIENT_GLASS_SHEEN_PANEL_LOCATIONS,
    sheenStart: { x: 0.08, y: 0 },
    sheenEnd: { x: 0.55, y: 0.95 },
  },
  header: {
    backgroundColor: 'rgba(8,13,24,0.97)',
    borderColor: 'rgba(30,58,95,0.78)',
    borderTopColor: LDS_BORDER_COLOR.cockpitEdge,
    borderRadius: LDS_RADIUS.lg,
    sheen: LDS_GRADIENT_GLASS_SHEEN_HEADER,
    sheenLocations: LDS_GRADIENT_GLASS_SHEEN_HEADER_LOCATIONS,
    sheenStart: { x: 0, y: 0 },
    sheenEnd: { x: 1, y: 1 },
  },
  stage: {
    backgroundColor: 'rgba(6,14,26,0.72)',
    borderColor: 'rgba(34,211,238,0.14)',
    borderTopColor: 'rgba(34,211,238,0.22)',
    borderRadius: LDS_RADIUS.lg,
    sheen: LDS_GRADIENT_GLASS_SHEEN_PANEL,
    sheenLocations: LDS_GRADIENT_GLASS_SHEEN_PANEL_LOCATIONS,
    sheenStart: { x: 0.08, y: 0 },
    sheenEnd: { x: 0.55, y: 0.95 },
  },
  plain: {
    backgroundColor: 'rgba(16,26,43,0.87)',
    borderColor: LDS_BORDER_COLOR.card,
    borderTopColor: LDS_BORDER_COLOR.cardTopCyan,
    borderLeftColor: LDS_BORDER_COLOR.cardLeftCyan,
    borderRadius: LDS_RADIUS.cardPrimary,
    sheen: LDS_GRADIENT_GLASS_SHEEN_PANEL,
    sheenLocations: LDS_GRADIENT_GLASS_SHEEN_PANEL_LOCATIONS,
    sheenStart: { x: 0.08, y: 0 },
    sheenEnd: { x: 0.55, y: 0.95 },
  },
};

function GlassSurface({
  children,
  variant = 'plain',
  style,
  borderRadius,
  selected = false,
}: GlassSurfaceProps) {
  const preset = VARIANT_DEFAULTS[variant];
  const radius = borderRadius ?? preset.borderRadius;

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: preset.backgroundColor,
          borderRadius: radius,
          borderWidth: selected ? LDS_BORDER_WIDTH.emphasis : LDS_BORDER_WIDTH.standard,
          borderColor: selected ? LDS_BORDER_COLOR.selected : preset.borderColor,
          borderTopColor: selected ? LDS_BORDER_COLOR.selectedTop : preset.borderTopColor,
          borderLeftColor: preset.borderLeftColor,
        },
        style,
      ]}
    >
      <LinearGradient
        colors={[...preset.sheen] as [string, string, ...string[]]}
        locations={[...preset.sheenLocations] as [number, number, ...number[]]}
        start={preset.sheenStart}
        end={preset.sheenEnd}
        pointerEvents="none"
        style={[StyleSheet.absoluteFillObject, { borderRadius: radius }]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.innerRim,
          {
            borderRadius: Math.max(0, radius - 2),
            borderColor: LDS_BORDER_COLOR.glassInnerRim,
            borderTopColor: LDS_BORDER_COLOR.glassInnerRimTop,
          },
        ]}
      />
      {children}
    </View>
  );
}

export default memo(GlassSurface);

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
    position: 'relative',
  },
  innerRim: {
    ...StyleSheet.absoluteFillObject,
    margin: 2,
    borderWidth: StyleSheet.hairlineWidth,
    pointerEvents: 'none',
  },
});
