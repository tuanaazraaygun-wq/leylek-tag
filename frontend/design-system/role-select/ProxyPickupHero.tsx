import React, { memo } from 'react';
import { Circle, Line, Path, Rect } from 'react-native-svg';
import BlueprintIllustration from './BlueprintIllustration';
import type { RoleHeroIllustrationProps } from './PassengerSeatHero';

const PROXY_STROKE = 'rgba(251, 191, 36, 0.38)';
const PROXY_STROKE_MUTED = 'rgba(251, 191, 36, 0.22)';
const PROXY_FILL = 'rgba(251, 191, 36, 0.06)';
const PROXY_FILL_DEEP = 'rgba(251, 191, 36, 0.1)';
const PROXY_GRID = 'rgba(251, 191, 36, 0.08)';

function ProxyPickupHero({ stageHeight, isVeryCompact = false }: RoleHeroIllustrationProps) {
  return (
    <BlueprintIllustration
      stageHeight={stageHeight}
      active={false}
      isVeryCompact={isVeryCompact}
      preserveAspectRatio="meet"
    >
      {() => (
        <>
          {[56, 96, 136].map((y) => (
            <Line
              key={`grid-h-${y}`}
              x1="14"
              y1={y}
              x2="106"
              y2={y}
              stroke={PROXY_GRID}
              strokeWidth="0.35"
              strokeDasharray="2 4"
            />
          ))}

          <Circle cx="36" cy="88" r="14" fill={PROXY_FILL} stroke={PROXY_STROKE_MUTED} strokeWidth="0.9" />
          <Path
            d="M 36 78 Q 36 72 40 70 Q 44 68 48 72"
            fill="none"
            stroke={PROXY_STROKE_MUTED}
            strokeWidth="0.8"
            strokeLinecap="round"
          />
          <Line x1="30" y1="92" x2="42" y2="92" stroke={PROXY_STROKE_MUTED} strokeWidth="0.65" />

          <Circle cx="84" cy="88" r="14" fill={PROXY_FILL} stroke={PROXY_STROKE_MUTED} strokeWidth="0.9" />
          <Path
            d="M 84 78 Q 84 72 88 70 Q 92 68 96 72"
            fill="none"
            stroke={PROXY_STROKE_MUTED}
            strokeWidth="0.8"
            strokeLinecap="round"
          />
          <Line x1="78" y1="92" x2="90" y2="92" stroke={PROXY_STROKE_MUTED} strokeWidth="0.65" />

          <Path
            d="M 50 88 L 58 88 L 62 84 L 66 88 L 70 88"
            fill="none"
            stroke={PROXY_STROKE}
            strokeWidth="0.9"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="2 2"
          />

          <Rect
            x="52"
            y="112"
            width="16"
            height="18"
            rx="3"
            fill={PROXY_FILL_DEEP}
            stroke={PROXY_STROKE_MUTED}
            strokeWidth="0.75"
          />
          <Path
            d="M 58 118 L 58 126 M 55 121 L 61 121"
            fill="none"
            stroke={PROXY_STROKE_MUTED}
            strokeWidth="0.75"
            strokeLinecap="round"
          />
        </>
      )}
    </BlueprintIllustration>
  );
}

export default memo(ProxyPickupHero);
