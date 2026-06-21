import React, { memo } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { LDS_RADIUS } from '../tokens/radius';
import { LDS_SPACING } from '../tokens/spacing';

export type PremiumButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  accessibilityLabel?: string;
  trailing?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
};

function PremiumButton({
  label,
  onPress,
  disabled = false,
  busy = false,
  accessibilityLabel,
  trailing,
  style,
  labelStyle,
}: PremiumButtonProps) {
  const { tokens } = useTheme();
  const borders = tokens.borderColors;
  const borderWidths = tokens.borderWidths;
  const buttonTokens = tokens.button;
  const elevation = tokens.elevation;
  const muted = disabled || busy;
  const grayInactive = disabled && !busy;

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      disabled={muted}
      onPress={onPress}
      style={[
        styles.touchable,
        { borderRadius: LDS_RADIUS.md },
        grayInactive ? elevation.flat : elevation.cta,
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: muted }}
    >
      <View
        style={[
          styles.body,
          {
            borderRadius: LDS_RADIUS.md,
            backgroundColor: grayInactive
              ? buttonTokens.bodyDisabledBackground
              : buttonTokens.bodyActiveBackground,
            borderWidth: grayInactive ? borderWidths.standard : borderWidths.emphasis,
            borderColor: grayInactive ? borders.card : borders.selected,
            borderTopColor: grayInactive ? borders.cardTopCyan : borders.selectedTop,
            opacity: grayInactive ? buttonTokens.bodyDisabledOpacity : 1,
          },
        ]}
      >
        {busy ? (
          <ActivityIndicator color={tokens.accent.primary} size="small" />
        ) : (
          <>
            <Text style={[styles.label, { color: buttonTokens.labelColor }, labelStyle]}>{label}</Text>
            {trailing ?? null}
          </>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default memo(PremiumButton);

const styles = StyleSheet.create({
  touchable: {
    alignSelf: 'stretch',
  },
  body: {
    alignSelf: 'stretch',
    paddingVertical: Platform.OS === 'ios' ? LDS_SPACING.sm + 2 : LDS_SPACING.sm,
    paddingHorizontal: LDS_SPACING.md,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: LDS_SPACING.xs,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
