import React, { memo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { LDS_RADIUS } from '../tokens/radius';

export type PremiumCardProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  selected?: boolean;
};

/**
 * Elevated card surface — uses theme card + border tokens.
 */
function PremiumCard({ children, style, selected = false }: PremiumCardProps) {
  const { tokens } = useTheme();
  const borders = tokens.borderColors;
  const borderWidths = tokens.borderWidths;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: tokens.bg.card,
          borderColor: selected ? borders.selected : borders.card,
          borderTopColor: selected ? borders.selectedTop : borders.cardTopCyan,
          borderLeftColor: borders.cardLeftCyan,
          borderWidth: selected ? borderWidths.emphasis : borderWidths.standard,
        },
        tokens.elevation.panel,
        style,
      ]}
    >
      {children}
    </View>
  );
}

export default memo(PremiumCard);

const styles = StyleSheet.create({
  card: {
    borderRadius: LDS_RADIUS.cardPrimary,
    overflow: 'hidden',
  },
});
