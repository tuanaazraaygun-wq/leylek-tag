/**
 * Live map PNG marker scale + chrome tone (light LHS daylight).
 */

import { useMemo } from 'react';

export type MapMarkerChromeTone = 'dark' | 'light';

/** ~20% larger on light — target 25–35% visibility without map clutter. */
export const MAP_MARKER_LIGHT_SIZE_SCALE = 1.2;

export type MapMarkerTheme = {
  chromeTone: MapMarkerChromeTone;
  sizeScale: number;
};

export function scaleMapMarkerPixel(base: number, isLight: boolean): number {
  return isLight ? Math.round(base * MAP_MARKER_LIGHT_SIZE_SCALE) : base;
}

export function useMapMarkerTheme(isScopeLight: boolean): MapMarkerTheme {
  return useMemo(
    () => ({
      chromeTone: isScopeLight ? 'light' : 'dark',
      sizeScale: isScopeLight ? MAP_MARKER_LIGHT_SIZE_SCALE : 1,
    }),
    [isScopeLight],
  );
}
