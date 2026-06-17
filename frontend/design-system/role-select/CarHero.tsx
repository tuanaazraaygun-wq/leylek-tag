import React, { memo } from 'react';
import { Circle, Ellipse, Line, Path, Rect } from 'react-native-svg';
import BlueprintIllustration from './BlueprintIllustration';
import type { RoleHeroIllustrationProps } from './PassengerSeatHero';

function CarHero({ stageHeight, active = false, isVeryCompact = false }: RoleHeroIllustrationProps) {
  return (
    <BlueprintIllustration
      stageHeight={stageHeight}
      active={active}
      isVeryCompact={isVeryCompact}
      preserveAspectRatio="meet"
    >
      {(p) => (
        <>
          {[52, 92, 132].map((y) => (
            <Line
              key={`grid-h-${y}`}
              x1="10"
              y1={y}
              x2="110"
              y2={y}
              stroke={p.grid}
              strokeWidth="0.35"
              strokeDasharray="2 4"
            />
          ))}

          <Line
            x1="14"
            y1="118"
            x2="106"
            y2="118"
            stroke={p.strokeMuted}
            strokeWidth="1"
            strokeLinecap="round"
            opacity={0.55}
          />
          <Line
            x1="18"
            y1="122"
            x2="102"
            y2="122"
            stroke={p.grid}
            strokeWidth="0.65"
            strokeDasharray="4 3"
          />

          <Ellipse cx="34" cy="118" rx="11" ry="11" fill={p.fillDeep} stroke={p.stroke} strokeWidth="1.15" />
          <Circle cx="34" cy="118" r="5" fill="none" stroke={p.strokeMuted} strokeWidth="0.75" />
          <Circle cx="34" cy="118" r="2" fill={p.highlight} opacity={active ? 0.9 : 0.55} />

          <Ellipse cx="86" cy="118" rx="11" ry="11" fill={p.fillDeep} stroke={p.stroke} strokeWidth="1.15" />
          <Circle cx="86" cy="118" r="5" fill="none" stroke={p.strokeMuted} strokeWidth="0.75" />
          <Circle cx="86" cy="118" r="2" fill={p.highlight} opacity={active ? 0.9 : 0.55} />

          <Path
            d="M 24 108 L 28 88 Q 30 78 38 74 L 48 70 Q 60 66 72 70 L 82 74 Q 90 78 92 88 L 96 108 Z"
            fill={p.fill}
            stroke={p.stroke}
            strokeWidth="1.35"
            strokeLinejoin="round"
          />

          <Path
            d="M 34 74 L 32 58 Q 32 48 40 44 L 48 42 Q 60 38 72 42 L 80 44 Q 88 48 88 58 L 86 74"
            fill={p.fillDeep}
            stroke={p.stroke}
            strokeWidth="1.25"
            strokeLinejoin="round"
          />

          <Rect
            x="40"
            y="48"
            width="40"
            height="18"
            rx="5"
            fill={p.fillAccent}
            stroke={p.strokeMuted}
            strokeWidth="0.85"
          />
          <Line x1="60" y1="50" x2="60" y2="64" stroke={p.strokeMuted} strokeWidth="0.55" opacity={0.65} />

          <Path
            d="M 28 108 L 92 108"
            stroke={p.strokeMuted}
            strokeWidth="0.7"
            strokeLinecap="round"
          />

          <Ellipse cx="60" cy="88" rx="28" ry="10" fill={p.glow} />
        </>
      )}
    </BlueprintIllustration>
  );
}

export default memo(CarHero);
