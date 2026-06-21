import React, { memo } from 'react';
import LeylekEye, {
  LEYLEK_EYE_HEADER_SIZE,
  type LeylekEyeThemeVariant,
} from '../../design-system/leylek-eye/LeylekEye';
import { useTheme } from '../../hooks/useTheme';

export type LeylekEyeTriggerProps = {
  onPress: () => void;
  themeVariant?: LeylekEyeThemeVariant;
};

/** Sürücü kokpit header — Leylek Zeka chat trigger (canonical SVG göz). */
function LeylekEyeTrigger({ onPress, themeVariant }: LeylekEyeTriggerProps) {
  const { resolvedTheme } = useTheme();
  const variant = themeVariant ?? (resolvedTheme === 'light' ? 'light' : 'dark');

  return (
    <LeylekEye
      size={LEYLEK_EYE_HEADER_SIZE}
      chromeTone="subtle"
      themeVariant={variant}
      motionProfile="guardian"
      onPress={onPress}
      accessibilityLabel="Leylek Zeka"
    />
  );
}

export default memo(LeylekEyeTrigger);
