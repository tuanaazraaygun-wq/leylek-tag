import React, { memo } from 'react';
import { Circle, Ellipse, Line, Path } from 'react-native-svg';
import BlueprintIllustration from './BlueprintIllustration';
import type { RoleHeroIllustrationProps } from './PassengerSeatHero';

function QuickMatchHero({ stageHeight, active = false, isVeryCompact = false }: RoleHeroIllustrationProps) {
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

          <Ellipse cx="60" cy="82" rx="38" ry="32" fill={p.glow} />

          <Circle cx="60" cy="82" r="30" fill="none" stroke={p.strokeMuted} strokeWidth="0.85" opacity={0.55} />
          <Circle cx="60" cy="82" r="22" fill="none" stroke={p.strokeMuted} strokeWidth="0.75" opacity={0.7} />
          <Circle cx="60" cy="82" r="14" fill="none" stroke={p.stroke} strokeWidth="1" opacity={0.85} />

          <Line
            x1="60"
            y1="52"
            x2="60"
            y2="112"
            stroke={p.strokeMuted}
            strokeWidth="0.55"
            strokeDasharray="2 3"
            opacity={0.45}
          />
          <Line
            x1="30"
            y1="82"
            x2="90"
            y2="82"
            stroke={p.strokeMuted}
            strokeWidth="0.55"
            strokeDasharray="2 3"
            opacity={0.45}
          />

          <Path
            d="M 60 58 L 52 78 L 58 78 L 54 98 L 68 74 L 62 74 L 66 58 Z"
            fill={p.fillAccent}
            stroke={p.stroke}
            strokeWidth="1.25"
            strokeLinejoin="round"
          />

          {[24, 60, 96].map((cx, index) => (
            <Circle
              key={`seq-${cx}`}
              cx={cx}
              cy="124"
              r={index === 1 ? 4.2 : 3.4}
              fill={index === 1 ? p.fillAccent : p.fill}
              stroke={p.stroke}
              strokeWidth={index === 1 ? 1.1 : 0.9}
              opacity={active || index <= 1 ? 1 : 0.55}
            />
          ))}
          <Line
            x1="27"
            y1="124"
            x2="93"
            y2="124"
            stroke={p.strokeMuted}
            strokeWidth="0.8"
            strokeDasharray="3 2"
            strokeLinecap="round"
          />

          <Circle cx="60" cy="82" r="3.5" fill={p.highlight} opacity={active ? 0.95 : 0.65} />
        </>
      )}
    </BlueprintIllustration>
  );
}

export default memo(QuickMatchHero);
