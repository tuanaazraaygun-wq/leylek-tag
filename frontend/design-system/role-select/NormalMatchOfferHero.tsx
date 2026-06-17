import React, { memo } from 'react';
import { Circle, Line, Path, Rect } from 'react-native-svg';
import BlueprintIllustration from './BlueprintIllustration';
import type { RoleHeroIllustrationProps } from './PassengerSeatHero';

function NormalMatchOfferHero({
  stageHeight,
  active = false,
  isVeryCompact = false,
}: RoleHeroIllustrationProps) {
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

          <Path
            d="M 28 108 Q 44 72 60 78 Q 76 84 92 96"
            fill="none"
            stroke={p.strokeMuted}
            strokeWidth="1.1"
            strokeDasharray="4 3"
            strokeLinecap="round"
          />
          <Path
            d="M 28 108 Q 44 72 60 78 Q 76 84 92 96"
            fill="none"
            stroke={p.stroke}
            strokeWidth="1.35"
            strokeLinecap="round"
          />

          <Circle cx="28" cy="108" r="7" fill={p.fillDeep} stroke={p.stroke} strokeWidth="1.1" />
          <Circle cx="28" cy="108" r="2.8" fill={p.highlight} opacity={0.85} />
          <Path
            d="M 28 101 L 28 115"
            stroke={p.strokeMuted}
            strokeWidth="0.75"
            strokeLinecap="round"
          />

          <Circle cx="92" cy="96" r="7" fill={p.fillDeep} stroke={p.stroke} strokeWidth="1.1" />
          <Circle cx="92" cy="96" r="2.8" fill={p.highlight} opacity={0.85} />
          <Path
            d="M 92 89 L 92 103"
            stroke={p.strokeMuted}
            strokeWidth="0.75"
            strokeLinecap="round"
          />

          <Rect
            x="46"
            y="118"
            width="28"
            height="18"
            rx="4"
            fill={p.fill}
            stroke={p.strokeMuted}
            strokeWidth="0.85"
          />
          <Line x1="50" y1="124" x2="70" y2="124" stroke={p.strokeMuted} strokeWidth="0.65" />
          <Line x1="50" y1="128" x2="64" y2="128" stroke={p.strokeMuted} strokeWidth="0.55" />

          <Path
            d="M 74 44 L 88 52 L 74 60 L 78 52 Z"
            fill={p.fillAccent}
            stroke={p.stroke}
            strokeWidth="1.05"
            strokeLinejoin="round"
          />
          <Line
            x1="62"
            y1="52"
            x2="74"
            y2="52"
            stroke={p.stroke}
            strokeWidth="1"
            strokeLinecap="round"
          />
          <Path
            d="M 58 48 L 62 52 L 58 56"
            fill="none"
            stroke={p.strokeMuted}
            strokeWidth="0.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
    </BlueprintIllustration>
  );
}

export default memo(NormalMatchOfferHero);
