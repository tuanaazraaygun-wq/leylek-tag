import React, { memo } from 'react';
import { StyleSheet, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import PremiumText from './PremiumText';
import { LDS_SPACING } from '../tokens/spacing';

export type SectionHeaderProps = {
  title: string;
  subtitle?: string;
  style?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
  subtitleStyle?: StyleProp<TextStyle>;
};

function SectionHeader({ title, subtitle, style, titleStyle, subtitleStyle }: SectionHeaderProps) {
  return (
    <View style={[styles.root, style]} accessibilityRole="header">
      <PremiumText variant="title" style={titleStyle}>
        {title}
      </PremiumText>
      {subtitle ? (
        <PremiumText variant="caption" muted style={[styles.subtitle, subtitleStyle]}>
          {subtitle}
        </PremiumText>
      ) : null}
    </View>
  );
}

export default memo(SectionHeader);

const styles = StyleSheet.create({
  root: {
    gap: LDS_SPACING.xs,
  },
  subtitle: {
    marginTop: 2,
  },
});
