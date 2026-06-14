import React, { memo } from 'react';
import Svg, { Circle, Defs, Line, Path, Rect } from 'react-native-svg';

export type RoleCardIllustrationProps = {
  size?: number;
  active?: boolean;
};

const STROKE_ACTIVE = 'rgba(34,211,238,0.92)';
const STROKE_IDLE = 'rgba(94,210,230,0.62)';
const FILL_ACTIVE = 'rgba(34,211,238,0.14)';
const FILL_IDLE = 'rgba(34,211,238,0.06)';
const GRID = 'rgba(34,211,238,0.12)';

function RoleCardPassengerIllustration({
  size = 64,
  active = false,
}: RoleCardIllustrationProps) {
  const stroke = active ? STROKE_ACTIVE : STROKE_IDLE;
  const fill = active ? FILL_ACTIVE : FILL_IDLE;

  return (
    <Svg width={size} height={size} viewBox="0 0 80 80">
      <Defs />

      {[20, 40, 60].map((y) => (
        <Line
          key={`h-${y}`}
          x1="8"
          y1={y}
          x2="72"
          y2={y}
          stroke={GRID}
          strokeWidth="0.35"
          strokeDasharray="2 3"
        />
      ))}
      {[24, 40, 56].map((x) => (
        <Line
          key={`v-${x}`}
          x1={x}
          y1="12"
          x2={x}
          y2="68"
          stroke={GRID}
          strokeWidth="0.35"
          strokeDasharray="2 3"
        />
      ))}

      <Path
        d="M 18 52 L 18 38 Q 18 28 28 26 L 34 24 Q 40 22 46 24 L 52 26 Q 62 28 62 38 L 62 52"
        fill={fill}
        stroke={stroke}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <Rect
        x="26"
        y="14"
        width="28"
        height="14"
        rx="5"
        fill={fill}
        stroke={stroke}
        strokeWidth="1.2"
      />
      <Path
        d="M 22 52 L 58 52 Q 60 54 58 56 L 22 56 Q 20 54 22 52 Z"
        fill={active ? 'rgba(34,211,238,0.22)' : 'rgba(34,211,238,0.1)'}
        stroke={stroke}
        strokeWidth="1.2"
      />
      <Path
        d="M 14 56 L 18 52 M 66 52 L 70 56"
        stroke={stroke}
        strokeWidth="1"
        strokeLinecap="round"
        opacity={0.7}
      />
      <Circle cx="40" cy="40" r="2.2" fill={active ? 'rgba(243,248,255,0.9)' : stroke} />
      <Line x1="8" y1="68" x2="72" y2="68" stroke={GRID} strokeWidth="0.5" />
    </Svg>
  );
}

export default memo(RoleCardPassengerIllustration);
