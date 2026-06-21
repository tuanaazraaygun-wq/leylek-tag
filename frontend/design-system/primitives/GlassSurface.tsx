import React, { memo } from 'react';
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../hooks/useTheme';

export type GlassSurfaceVariant = 'panel' | 'header' | 'stage' | 'plain';

export type GlassSurfaceProps = {
  children: React.ReactNode;
  variant?: GlassSurfaceVariant;
  style?: StyleProp<ViewStyle>;
  borderRadius?: number;
  selected?: boolean;
};

function GlassSurface({
  children,
  variant = 'plain',
  style,
  borderRadius,
  selected = false,
}: GlassSurfaceProps) {
  const { tokens } = useTheme();
  const preset = tokens.glassSurface[variant];
  const borders = tokens.borderColors;
  const borderWidths = tokens.borderWidths;
  const radius = borderRadius ?? preset.borderRadius;

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: preset.backgroundColor,
          borderRadius: radius,
          borderWidth: selected ? borderWidths.emphasis : borderWidths.standard,
          borderColor: selected ? borders.selected : preset.borderColor,
          borderTopColor: selected ? borders.selectedTop : preset.borderTopColor,
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
            borderColor: borders.glassInnerRim,
            borderTopColor: borders.glassInnerRimTop,
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
