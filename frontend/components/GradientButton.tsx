import React from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const GRAD_PRIMARY = ['#007AFF', '#5AC8FA'] as const;
const GRAD_SECONDARY = ['#FF8A00', '#FFB347'] as const;

export type GradientButtonProps = {
  onPress: () => void;
  label?: string;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary';
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

export function GradientButton({
  onPress,
  label,
  disabled,
  loading,
  variant = 'primary',
  style,
  children,
}: GradientButtonProps) {
  const colors = variant === 'secondary' ? GRAD_SECONDARY : GRAD_PRIMARY;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={[styles.shell, style, (disabled || loading) && styles.dim]}
    >
      <LinearGradient colors={[...colors]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={styles.inner}>
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : children ? (
          children
        ) : (
          <Text style={styles.label}>{label}</Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderRadius: 14,
    overflow: 'hidden',
    minHeight: 48,
    justifyContent: 'center',
  },
  dim: { opacity: 0.5 },
  inner: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
