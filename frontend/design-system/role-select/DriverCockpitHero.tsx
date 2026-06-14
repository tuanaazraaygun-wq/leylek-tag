import React, { memo } from 'react';
import { Circle, Ellipse, Line, Path } from 'react-native-svg';
import BlueprintIllustration from './BlueprintIllustration';
import type { RoleHeroIllustrationProps } from './PassengerSeatHero';

function DriverCockpitHero({ stageHeight, active = false, isVeryCompact = false }: RoleHeroIllustrationProps) {
  return (
    <BlueprintIllustration
      stageHeight={stageHeight}
      active={active}
      isVeryCompact={isVeryCompact}
      preserveAspectRatio="meet"
    >
      {(p) => (
        <>
          {[40, 80, 120].map((y) => (
            <Line
              key={`grid-h-${y}`}
              x1="8"
              y1={y}
              x2="112"
              y2={y}
              stroke={p.grid}
              strokeWidth="0.35"
              strokeDasharray="2 4"
            />
          ))}

          <Path
            d="M 12 52 Q 60 18 108 52"
            fill="none"
            stroke={p.strokeMuted}
            strokeWidth="1.1"
            strokeLinecap="round"
          />
          <Path
            d="M 18 48 Q 60 22 102 48"
            fill={p.fillDeep}
            stroke={p.stroke}
            strokeWidth="1.2"
            strokeLinejoin="round"
          />

          <Line x1="24" y1="40" x2="52" y2="40" stroke={p.strokeMuted} strokeWidth="0.7" strokeLinecap="round" />
          <Line x1="68" y1="40" x2="96" y2="40" stroke={p.strokeMuted} strokeWidth="0.7" strokeLinecap="round" />
          <Line x1="34" y1="46" x2="86" y2="46" stroke={p.grid} strokeWidth="0.55" strokeDasharray="3 2" />

          <Circle cx="32" cy="34" r="9" fill={p.fill} stroke={p.stroke} strokeWidth="1" />
          <Circle cx="32" cy="34" r="5" fill="none" stroke={p.strokeMuted} strokeWidth="0.65" />
          <Line x1="32" y1="29" x2="32" y2="39" stroke={p.strokeMuted} strokeWidth="0.55" />
          <Line x1="27" y1="34" x2="37" y2="34" stroke={p.strokeMuted} strokeWidth="0.55" />

          <Circle cx="88" cy="34" r="9" fill={p.fill} stroke={p.stroke} strokeWidth="1" />
          <Circle cx="88" cy="34" r="5" fill="none" stroke={p.strokeMuted} strokeWidth="0.65" />
          <Path
            d="M 88 29 L 90 36 L 86 36 Z"
            fill="none"
            stroke={p.strokeMuted}
            strokeWidth="0.55"
            strokeLinejoin="round"
          />

          <Ellipse cx="60" cy="98" rx="36" ry="30" fill={p.glow} />

          <Circle cx="60" cy="98" r="30" fill={p.fillDeep} stroke={p.stroke} strokeWidth="1.5" />
          <Circle cx="60" cy="98" r="22" fill="none" stroke={p.strokeMuted} strokeWidth="0.85" />
          <Circle cx="60" cy="98" r="14" fill={p.fill} stroke={p.stroke} strokeWidth="1.05" />

          <Line x1="60" y1="70" x2="60" y2="126" stroke={p.stroke} strokeWidth="1.2" strokeLinecap="round" />
          <Line x1="34" y1="98" x2="86" y2="98" stroke={p.stroke} strokeWidth="1.2" strokeLinecap="round" />
          <Line x1="42" y1="80" x2="78" y2="116" stroke={p.strokeMuted} strokeWidth="0.95" strokeLinecap="round" />
          <Line x1="78" y1="80" x2="42" y2="116" stroke={p.strokeMuted} strokeWidth="0.95" strokeLinecap="round" />

          <Circle
            cx="60"
            cy="98"
            r="6.5"
            fill={active ? 'rgba(8,17,31,0.88)' : 'rgba(8,17,31,0.72)'}
            stroke={p.stroke}
            strokeWidth="1"
          />
          <Circle cx="60" cy="98" r="2" fill={p.highlight} opacity={active ? 0.95 : 0.6} />

          <Path
            d="M 22 132 Q 60 124 98 132"
            fill="none"
            stroke={p.strokeMuted}
            strokeWidth="0.9"
            strokeLinecap="round"
          />
          <Line x1="60" y1="128" x2="60" y2="136" stroke={p.strokeMuted} strokeWidth="0.65" opacity={0.55} />

          <Path
            d="M 16 58 L 24 56 M 96 56 L 104 58"
            stroke={p.strokeMuted}
            strokeWidth="0.75"
            strokeLinecap="round"
          />
        </>
      )}
    </BlueprintIllustration>
  );
}

export default memo(DriverCockpitHero);
