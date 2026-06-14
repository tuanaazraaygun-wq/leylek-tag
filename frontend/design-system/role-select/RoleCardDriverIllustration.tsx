import React, { memo } from 'react';
import Svg, { Circle, Defs, Ellipse, Line, Path } from 'react-native-svg';

export type RoleCardIllustrationProps = {
  size?: number;
  active?: boolean;
};

const STROKE_ACTIVE = 'rgba(34,211,238,0.92)';
const STROKE_IDLE = 'rgba(112,180,226,0.65)';
const FILL_ACTIVE = 'rgba(34,211,238,0.12)';
const FILL_IDLE = 'rgba(34,211,238,0.05)';
const GRID = 'rgba(34,211,238,0.11)';

function RoleCardDriverIllustration({
  size = 64,
  active = false,
}: RoleCardIllustrationProps) {
  const stroke = active ? STROKE_ACTIVE : STROKE_IDLE;
  const fill = active ? FILL_ACTIVE : FILL_IDLE;

  return (
    <Svg width={size} height={size} viewBox="0 0 80 80">
      <Defs />

      <Path
        d="M 10 58 Q 40 48 70 58"
        fill="none"
        stroke={GRID}
        strokeWidth="0.8"
        strokeDasharray="3 2"
      />
      <Ellipse
        cx="22"
        cy="58"
        rx="7"
        ry="4"
        fill="none"
        stroke={stroke}
        strokeWidth="0.9"
        opacity={0.55}
      />
      <Ellipse
        cx="58"
        cy="58"
        rx="7"
        ry="4"
        fill="none"
        stroke={stroke}
        strokeWidth="0.9"
        opacity={0.55}
      />

      <Circle
        cx="40"
        cy="36"
        r="22"
        fill={fill}
        stroke={stroke}
        strokeWidth="1.5"
      />
      <Circle cx="40" cy="36" r="14" fill="none" stroke={stroke} strokeWidth="0.85" opacity={0.65} />
      <Path
        d="M 40 16 L 40 56 M 22 36 L 58 36 M 28 24 L 52 48 M 52 24 L 28 48"
        stroke={stroke}
        strokeWidth="1.15"
        strokeLinecap="round"
        opacity={active ? 0.95 : 0.75}
      />
      <Circle
        cx="40"
        cy="36"
        r="5.5"
        fill={active ? 'rgba(8,17,31,0.85)' : 'rgba(8,17,31,0.65)'}
        stroke={stroke}
        strokeWidth="1"
      />
      <Circle cx="40" cy="36" r="1.8" fill={active ? 'rgba(243,248,255,0.88)' : stroke} />

      <Path
        d="M 14 62 L 66 62"
        stroke={GRID}
        strokeWidth="0.45"
      />
      <Line x1="40" y1="58" x2="40" y2="62" stroke={stroke} strokeWidth="0.7" opacity={0.5} />
    </Svg>
  );
}

export default memo(RoleCardDriverIllustration);
