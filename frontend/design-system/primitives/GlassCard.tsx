import React, { memo } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import GlassSurface, { type GlassSurfaceVariant } from './GlassSurface';

export type GlassCardProps = {
  children: React.ReactNode;
  variant?: GlassSurfaceVariant;
  style?: StyleProp<ViewStyle>;
  borderRadius?: number;
  selected?: boolean;
};

/** Convenience alias — themed glass card built on GlassSurface. */
function GlassCard(props: GlassCardProps) {
  return <GlassSurface {...props} />;
}

export default memo(GlassCard);
