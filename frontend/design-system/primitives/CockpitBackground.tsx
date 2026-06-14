import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import RoleSelectAmbienceBackground from '../role-select/RoleSelectAmbienceBackground';
import {
  LDS_GRADIENT_COCKPIT_BASE,
  LDS_GRADIENT_COCKPIT_BASE_LOCATIONS,
  LDS_GRADIENT_COCKPIT_SIDE_VIGNETTE,
  LDS_GRADIENT_COCKPIT_SIDE_VIGNETTE_LOCATIONS,
  LDS_GRADIENT_COCKPIT_TOP_HAZE,
  LDS_GRADIENT_COCKPIT_TOP_HAZE_LOCATIONS,
} from '../tokens/gradient';

export type CockpitBackgroundProps = {
  /** Show subtle grid + horizon (default true) */
  showGrid?: boolean;
};

/**
 * Reusable deep-navy cockpit backdrop — no photo, city, blur, or particles.
 */
function CockpitBackground({ showGrid = true }: CockpitBackgroundProps) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={[...LDS_GRADIENT_COCKPIT_BASE]}
        locations={[...LDS_GRADIENT_COCKPIT_BASE_LOCATIONS]}
        style={StyleSheet.absoluteFillObject}
      />
      {showGrid ? <RoleSelectAmbienceBackground /> : null}
      <LinearGradient
        colors={[...LDS_GRADIENT_COCKPIT_SIDE_VIGNETTE]}
        locations={[...LDS_GRADIENT_COCKPIT_SIDE_VIGNETTE_LOCATIONS]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFillObject}
      />
      <LinearGradient
        colors={[...LDS_GRADIENT_COCKPIT_TOP_HAZE]}
        locations={[...LDS_GRADIENT_COCKPIT_TOP_HAZE_LOCATIONS]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
    </View>
  );
}

export default memo(CockpitBackground);
