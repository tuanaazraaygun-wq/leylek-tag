import React, { memo } from 'react';
import { Circle, Ellipse, Line, Path } from 'react-native-svg';
import BlueprintIllustration from './BlueprintIllustration';
import type { RoleHeroIllustrationProps } from './PassengerSeatHero';

function MotorcycleHero({ stageHeight, active = false, isVeryCompact = false }: RoleHeroIllustrationProps) {
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

          <Circle cx="34" cy="112" r="12" fill={p.fillDeep} stroke={p.stroke} strokeWidth="1.15" />
          <Circle cx="34" cy="112" r="5.5" fill="none" stroke={p.strokeMuted} strokeWidth="0.75" />
          <Circle cx="34" cy="112" r="2" fill={p.highlight} opacity={active ? 0.9 : 0.55} />

          <Circle cx="88" cy="112" r="12" fill={p.fillDeep} stroke={p.stroke} strokeWidth="1.15" />
          <Circle cx="88" cy="112" r="5.5" fill="none" stroke={p.strokeMuted} strokeWidth="0.75" />
          <Circle cx="88" cy="112" r="2" fill={p.highlight} opacity={active ? 0.9 : 0.55} />

          <Path
            d="M 34 100 L 46 88 L 58 82 L 72 80 L 84 84 L 88 96"
            fill="none"
            stroke={p.stroke}
            strokeWidth="1.35"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          <Path
            d="M 52 82 L 58 72 Q 62 66 68 64 L 76 62"
            fill="none"
            stroke={p.stroke}
            strokeWidth="1.1"
            strokeLinecap="round"
          />

          <Path
            d="M 76 62 L 82 54 L 88 50"
            fill="none"
            stroke={p.strokeMuted}
            strokeWidth="0.9"
            strokeLinecap="round"
          />
          <Path
            d="M 82 54 L 86 48 L 90 46"
            fill="none"
            stroke={p.strokeMuted}
            strokeWidth="0.75"
            strokeLinecap="round"
          />

          <Ellipse cx="58" cy="78" rx="10" ry="4" fill={p.fillAccent} stroke={p.strokeMuted} strokeWidth="0.75" />

          <Path
            d="M 46 88 L 42 96 L 38 100"
            fill="none"
            stroke={p.strokeMuted}
            strokeWidth="0.85"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          <Path
            d="M 72 80 L 78 74 L 82 70"
            fill="none"
            stroke={p.strokeMuted}
            strokeWidth="0.8"
            strokeLinecap="round"
          />

          <Ellipse cx="62" cy="92" rx="22" ry="8" fill={p.glow} />
        </>
      )}
    </BlueprintIllustration>
  );
}

export default memo(MotorcycleHero);
