import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassSurface, PremiumText } from '../../design-system/primitives';
import { LDS_SPACING } from '../../design-system/tokens/spacing';

export type TrustedRadarBriefingStripProps = {
  text: string;
};

function TrustedRadarBriefingStrip({ text }: TrustedRadarBriefingStripProps) {
  const line = (text || '').trim();
  if (!line) return null;

  return (
    <GlassSurface variant="plain" borderRadius={14} style={styles.surface}>
      <View style={styles.row}>
        <Ionicons name="pulse-outline" size={14} color="rgba(148, 163, 184, 0.72)" />
        <PremiumText variant="caption" muted style={styles.text} numberOfLines={2}>
          {line}
        </PremiumText>
      </View>
    </GlassSurface>
  );
}

export default memo(TrustedRadarBriefingStrip);

const styles = StyleSheet.create({
  surface: {
    paddingVertical: LDS_SPACING.xs,
    paddingHorizontal: LDS_SPACING.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LDS_SPACING.xs,
  },
  text: {
    flex: 1,
    lineHeight: 16,
  },
});
