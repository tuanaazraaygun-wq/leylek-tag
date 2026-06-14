import React, { memo } from 'react';
import { Ellipse, Line, Path, Rect } from 'react-native-svg';
import BlueprintIllustration from './BlueprintIllustration';

export type RoleHeroIllustrationProps = {
  stageHeight: number;
  active?: boolean;
  isVeryCompact?: boolean;
};

function PassengerSeatHero({ stageHeight, active = false, isVeryCompact = false }: RoleHeroIllustrationProps) {
  return (
    <BlueprintIllustration stageHeight={stageHeight} active={active} isVeryCompact={isVeryCompact}>
      {(p) => (
        <>
          {[48, 88, 128].map((y) => (
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
          {[36, 60, 84].map((x) => (
            <Line
              key={`grid-v-${x}`}
              x1={x}
              y1="24"
              x2={x}
              y2="148"
              stroke={p.grid}
              strokeWidth="0.35"
              strokeDasharray="2 4"
            />
          ))}

          <Ellipse cx="60" cy="92" rx="34" ry="28" fill={p.glow} />

          <Path
            d="M 18 134 L 102 134 L 98 142 L 22 142 Z"
            fill={p.fillDeep}
            stroke={p.strokeMuted}
            strokeWidth="0.9"
            strokeLinejoin="round"
          />
          <Line x1="14" y1="144" x2="106" y2="144" stroke={p.strokeMuted} strokeWidth="1" strokeLinecap="round" />

          <Path
            d="M 26 134 L 26 108 Q 26 98 34 94 L 40 92 Q 60 88 80 92 L 86 94 Q 94 98 94 108 L 94 134"
            fill={p.fill}
            stroke={p.stroke}
            strokeWidth="1.35"
            strokeLinejoin="round"
          />
          <Path
            d="M 30 118 Q 60 112 90 118"
            fill="none"
            stroke={p.strokeMuted}
            strokeWidth="0.75"
            strokeLinecap="round"
          />

          <Path
            d="M 34 94 L 30 52 Q 30 38 42 34 L 48 32 Q 60 28 72 32 L 78 34 Q 90 38 90 52 L 86 94"
            fill={p.fillDeep}
            stroke={p.stroke}
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <Path
            d="M 38 72 Q 60 66 82 72"
            fill="none"
            stroke={p.strokeMuted}
            strokeWidth="0.7"
          />

          <Rect
            x="42"
            y="18"
            width="36"
            height="18"
            rx="7"
            fill={p.fillAccent}
            stroke={p.stroke}
            strokeWidth="1.2"
          />
          <Path
            d="M 46 28 Q 60 24 74 28"
            fill="none"
            stroke={p.strokeMuted}
            strokeWidth="0.65"
            strokeLinecap="round"
          />

          <Path
            d="M 22 108 Q 18 96 24 88 L 30 94 Q 28 100 30 108 Z"
            fill={p.fill}
            stroke={p.stroke}
            strokeWidth="1.1"
            strokeLinejoin="round"
          />
          <Path
            d="M 98 108 Q 102 96 96 88 L 90 94 Q 92 100 90 108 Z"
            fill={p.fill}
            stroke={p.stroke}
            strokeWidth="1.1"
            strokeLinejoin="round"
          />

          <Path
            d="M 28 134 L 92 134 Q 96 136 92 138 L 28 138 Q 24 136 28 134 Z"
            fill={p.fillAccent}
            stroke={p.stroke}
            strokeWidth="1.15"
            strokeLinejoin="round"
          />

          <Line x1="60" y1="94" x2="60" y2="132" stroke={p.strokeMuted} strokeWidth="0.55" opacity={0.65} />
          <Ellipse cx="60" cy="104" rx="4" ry="2.2" fill={p.highlight} opacity={active ? 0.9 : 0.55} />
        </>
      )}
    </BlueprintIllustration>
  );
}

export default memo(PassengerSeatHero);
