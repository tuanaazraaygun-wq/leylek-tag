import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../hooks/useTheme';
import RoleSelectAmbienceBackground from '../role-select/RoleSelectAmbienceBackground';

export type CockpitBackgroundProps = {
  /** Show subtle grid + horizon (default true) */
  showGrid?: boolean;
};

/**
 * Reusable deep-navy cockpit backdrop — no photo, city, blur, or particles.
 */
function CockpitBackground({ showGrid = true }: CockpitBackgroundProps) {
  const { tokens } = useTheme();
  const g = tokens.gradients;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={[...g.cockpitBase]}
        locations={[...g.cockpitBaseLocations]}
        style={StyleSheet.absoluteFillObject}
      />
      {showGrid ? <RoleSelectAmbienceBackground /> : null}
      <LinearGradient
        colors={[...g.cockpitSideVignette]}
        locations={[...g.cockpitSideVignetteLocations]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFillObject}
      />
      <LinearGradient
        colors={[...g.cockpitTopHaze]}
        locations={[...g.cockpitTopHazeLocations]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
    </View>
  );
}

export default memo(CockpitBackground);
