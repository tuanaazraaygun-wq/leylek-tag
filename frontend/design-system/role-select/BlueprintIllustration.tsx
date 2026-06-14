import React, { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg from 'react-native-svg';
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
  children: (palette: BlueprintPalette) => React.ReactNode;
};

export function getBlueprintPalette(active: boolean): BlueprintPalette {
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
  children,
}: BlueprintIllustrationProps) {
  const palette = useMemo(() => getBlueprintPalette(active), [active]);
  const fillRatio = isVeryCompact
    ? LDS_ILLUSTRATION.stageFillRatioVeryCompact
    : LDS_ILLUSTRATION.stageFillRatio;
  const widthRatio = isVeryCompact
    ? LDS_ILLUSTRATION.stageWidthRatioVeryCompact
    : LDS_ILLUSTRATION.stageWidthRatio;
  const stageRenderHeight = Math.round(stageHeight * fillRatio);

  return (
    <View style={[styles.wrapper, { height: stageRenderHeight }]}>
      <View
        style={[
          styles.frame,
          {
            aspectRatio: viewBoxWidth / viewBoxHeight,
            maxWidth: `${Math.round(widthRatio * 100)}%`,
          },
        ]}
      >
        <Svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
          preserveAspectRatio="xMidYMid meet"
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
});
