import React, { memo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { LDS_OPACITY } from '../tokens/opacity';

/**
 * Statik rol ekranı ambience — derin cockpit grid, animasyon yok.
 * Şehir silueti / pencere / cyan blok yok.
 */
function RoleSelectAmbienceBackground() {
  const { width, height } = useWindowDimensions();
  const gridStroke = `rgba(34,211,238,${LDS_OPACITY.gridLine})`;
  const perspectiveStroke = `rgba(34,211,238,${LDS_OPACITY.gridPerspective})`;
  const horizonStroke = `rgba(34,211,238,${LDS_OPACITY.horizonLine})`;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg
        width={width}
        height={height}
        viewBox="0 0 390 844"
        preserveAspectRatio="xMidYMid slice"
      >
        {[0.28, 0.44, 0.6, 0.76].map((yRatio) => (
          <Line
            key={`grid-${yRatio}`}
            x1="0"
            y1={844 * yRatio}
            x2="390"
            y2={844 * yRatio}
            stroke={gridStroke}
            strokeWidth="0.5"
          />
        ))}

        <Line
          x1="52"
          y1="140"
          x2="24"
          y2="844"
          stroke={perspectiveStroke}
          strokeWidth="0.45"
        />
        <Line
          x1="338"
          y1="140"
          x2="366"
          y2="844"
          stroke={perspectiveStroke}
          strokeWidth="0.45"
        />

        <Line
          x1="0"
          y1="748"
          x2="390"
          y2="748"
          stroke={horizonStroke}
          strokeWidth="0.55"
        />
      </Svg>
    </View>
  );
}

export default memo(RoleSelectAmbienceBackground);
