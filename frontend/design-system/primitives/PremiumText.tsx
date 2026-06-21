import React, { memo } from 'react';
import {
  Text,
  type StyleProp,
  type TextProps,
  type TextStyle,
} from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { LDS_TYPOGRAPHY, type LdsTypographyVariant } from '../tokens/typography';

export type PremiumTextProps = TextProps & {
  variant?: LdsTypographyVariant;
  muted?: boolean;
  style?: StyleProp<TextStyle>;
  children: React.ReactNode;
};

function PremiumText({
  variant = 'body',
  muted = false,
  style,
  children,
  ...rest
}: PremiumTextProps) {
  const { tokens } = useTheme();
  const token = LDS_TYPOGRAPHY[variant];

  return (
    <Text
      {...rest}
      style={[
        token,
        { color: muted ? tokens.text.muted : tokens.text.primary },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export default memo(PremiumText);
