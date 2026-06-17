import React, { memo } from 'react';
import { Circle, Line, Path } from 'react-native-svg';
import BlueprintIllustration from './BlueprintIllustration';
import type { RoleHeroIllustrationProps } from './PassengerSeatHero';

function TrustedNetworkHero({ stageHeight, active = false, isVeryCompact = false }: RoleHeroIllustrationProps) {
  return (
    <BlueprintIllustration
      stageHeight={stageHeight}
      active={active}
      isVeryCompact={isVeryCompact}
      preserveAspectRatio="meet"
    >
      {(p) => (
        <>
          {[48, 88, 128].map((y) => (
            <Line
              key={`grid-h-${y}`}
              x1="12"
              y1={y}
              x2="108"
              y2={y}
              stroke={p.grid}
              strokeWidth="0.35"
              strokeDasharray="2 4"
            />
          ))}

          <Path
            d="M 60 38 L 66 52 L 82 54 L 70 64 L 74 80 L 60 72 L 46 80 L 50 64 L 38 54 L 54 52 Z"
            fill={p.fillAccent}
            stroke={p.stroke}
            strokeWidth="1.05"
            strokeLinejoin="round"
            opacity={active ? 1 : 0.82}
          />

          {[
            { cx: 28, cy: 72 },
            { cx: 92, cy: 72 },
            { cx: 24, cy: 118 },
            { cx: 96, cy: 118 },
          ].map(({ cx, cy }) => (
            <Circle
              key={`node-${cx}-${cy}`}
              cx={cx}
              cy={cy}
              r="6"
              fill={p.fill}
              stroke={p.strokeMuted}
              strokeWidth="0.85"
            />
          ))}

          <Line x1="60" y1="72" x2="28" y2="72" stroke={p.strokeMuted} strokeWidth="0.75" />
          <Line x1="60" y1="72" x2="92" y2="72" stroke={p.strokeMuted} strokeWidth="0.75" />
          <Line x1="60" y1="72" x2="24" y2="118" stroke={p.strokeMuted} strokeWidth="0.75" />
          <Line x1="60" y1="72" x2="96" y2="118" stroke={p.strokeMuted} strokeWidth="0.75" />

          <Circle cx="60" cy="72" r="8" fill={p.fillDeep} stroke={p.stroke} strokeWidth="1.05" />
          <Circle cx="60" cy="72" r="3" fill={p.highlight} opacity={active ? 0.9 : 0.6} />
        </>
      )}
    </BlueprintIllustration>
  );
}

export default memo(TrustedNetworkHero);
