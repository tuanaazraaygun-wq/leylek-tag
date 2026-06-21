import React, { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg from 'react-native-svg';
import { useTheme } from '../../hooks/useTheme';
import type { ResolvedTheme } from '../../lib/theme/types';
import { LDS_ILLUSTRATION } from '../tokens/illustration';

export type BlueprintPalette = {
  stroke: string;
  strokeMuted: string;
  fill: string;
  fillDeep: string;
  fillAccent: string;
  grid: string;
  glow: string;
  highlight: string;
};

export type BlueprintIllustrationProps = {
  stageHeight: number;
  active?: boolean;
  isVeryCompact?: boolean;
  viewBoxWidth?: number;
  viewBoxHeight?: number;
  /** LDS-4G-A — slice fills wide hero slots; meet preserves full illustration */
  preserveAspectRatio?: 'meet' | 'slice';
  children: (palette: BlueprintPalette) => React.ReactNode;
};

export function getBlueprintPalette(active: boolean, theme: ResolvedTheme = 'dark'): BlueprintPalette {
  if (theme === 'light') {
    return {
      stroke: active ? 'rgba(13,148,136,0.92)' : 'rgba(15,118,110,0.72)',
      strokeMuted: active ? 'rgba(13,148,136,0.58)' : 'rgba(71,85,105,0.58)',
      fill: active ? 'rgba(0,212,170,0.16)' : 'rgba(0,212,170,0.10)',
      fillDeep: active ? 'rgba(0,212,170,0.22)' : 'rgba(0,212,170,0.14)',
      fillAccent: active ? 'rgba(14,165,233,0.18)' : 'rgba(14,165,233,0.12)',
      grid: 'rgba(15,23,42,0.12)',
      glow: active ? 'rgba(0,212,170,0.14)' : 'rgba(0,212,170,0.08)',
      highlight: active ? 'rgba(13,17,23,0.88)' : 'rgba(51,65,85,0.82)',
    };
  }

  return {
    stroke: active ? 'rgba(34,211,238,0.88)' : 'rgba(94,210,230,0.56)',
    strokeMuted: active ? 'rgba(34,211,238,0.42)' : 'rgba(94,210,230,0.32)',
    fill: active ? 'rgba(34,211,238,0.11)' : 'rgba(34,211,238,0.045)',
    fillDeep: active ? 'rgba(34,211,238,0.17)' : 'rgba(34,211,238,0.075)',
    fillAccent: active ? 'rgba(34,211,238,0.22)' : 'rgba(34,211,238,0.1)',
    grid: 'rgba(34,211,238,0.07)',
    glow: active ? 'rgba(34,211,238,0.14)' : 'rgba(34,211,238,0.05)',
    highlight: active ? 'rgba(243,248,255,0.82)' : 'rgba(180,220,235,0.55)',
  };
}

function BlueprintIllustration({
  stageHeight,
  active = false,
  isVeryCompact = false,
  viewBoxWidth = LDS_ILLUSTRATION.heroViewBoxWidth,
  viewBoxHeight = LDS_ILLUSTRATION.heroViewBoxHeight,
  preserveAspectRatio = 'meet',
  children,
}: BlueprintIllustrationProps) {
  const { resolvedTheme } = useTheme();
  const palette = useMemo(
    () => getBlueprintPalette(active, resolvedTheme),
    [active, resolvedTheme],
  );
  const fillRatio = isVeryCompact
    ? LDS_ILLUSTRATION.stageFillRatioVeryCompact
    : LDS_ILLUSTRATION.stageFillRatio;
  const widthRatio = isVeryCompact
    ? LDS_ILLUSTRATION.stageWidthRatioVeryCompact
    : LDS_ILLUSTRATION.stageWidthRatio;
  const stageRenderHeight = Math.round(stageHeight * fillRatio);

  const svgPreserveAspectRatio =
    preserveAspectRatio === 'slice'
      ? LDS_ILLUSTRATION.stagePreserveAspectRatioRoleCard
      : 'xMidYMid meet';
  const fillSlotWidth = preserveAspectRatio === 'slice';

  return (
    <View style={[styles.wrapper, { height: stageRenderHeight }]}>
      <View
        style={[
          styles.frame,
          fillSlotWidth
            ? styles.frameFillWidth
            : {
                aspectRatio: viewBoxWidth / viewBoxHeight,
                maxWidth: `${Math.round(widthRatio * 100)}%`,
              },
        ]}
      >
        <Svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
          preserveAspectRatio={svgPreserveAspectRatio}
        >
          {children(palette)}
        </Svg>
      </View>
    </View>
  );
}

export default memo(BlueprintIllustration);

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    height: '100%',
  },
  frameFillWidth: {
    width: '100%',
    height: '100%',
  },
});
