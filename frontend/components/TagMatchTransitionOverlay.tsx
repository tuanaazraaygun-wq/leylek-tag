import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  StyleSheet,
  View,
} from 'react-native';
import LeylekEye, { LEYLEK_EYE_HERO_SIZE } from '../design-system/leylek-eye/LeylekEye';
import { CockpitBackground, GlassSurface, PremiumText } from '../design-system/primitives';
import { LDS_BORDER_COLOR, LDS_BORDER_WIDTH } from '../design-system/tokens/border';
import { LDS_ELEVATION } from '../design-system/tokens/elevation';
import {
  LDS_MOTION_DURATION,
  LDS_MOTION_EASING,
  LDS_MOTION_SPRING,
} from '../design-system/tokens/motion';
import { LDS_RADIUS } from '../design-system/tokens/radius';
import { LDS_SPACING } from '../design-system/tokens/spacing';

const { width: SCREEN_W } = Dimensions.get('window');
const MATCH_COCKPIT_MAX_WIDTH = Math.min(SCREEN_W - LDS_SPACING.xl * 2, 360);

/** Normal TAG eşleşme — gösterim süresi (fade-out başlamadan önce tam opaklık). */
export const TAG_MATCH_TRANSITION_HOLD_MS = 3000;

const FADE_IN_MS = LDS_MOTION_DURATION.enter;
const FADE_OUT_MS = 440;

type Props = {
  /** false olduğunda içerik fade-out ile kapanır; iş mantığı üzerinde touch için pointerEvents kapatılır. */
  active: boolean;
};

/** LHIS Journey milestone — eşleşme tamamlandı, buluşma ekranına güvenli geçiş (yalnızca görsel). */
export default function TagMatchTransitionOverlay({ active }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.94)).current;
  const [renderLayer, setRenderLayer] = useState(active);

  useEffect(() => {
    if (active) {
      setRenderLayer(true);
      opacity.setValue(0);
      scale.setValue(0.94);
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: FADE_IN_MS,
          easing: LDS_MOTION_EASING.enter,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          friction: LDS_MOTION_SPRING.default.friction,
          tension: LDS_MOTION_SPRING.default.tension,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (renderLayer) {
      Animated.timing(opacity, {
        toValue: 0,
        duration: FADE_OUT_MS,
        easing: LDS_MOTION_EASING.exit,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setRenderLayer(false);
      });
    }
  }, [active, opacity, scale, renderLayer]);

  if (!renderLayer) return null;

  const touchBlock = active;
  return (
    <Animated.View
      pointerEvents={touchBlock ? 'auto' : 'none'}
      style={[styles.root, { opacity, transform: [{ scale }] }]}
    >
      <CockpitBackground />

      <View style={styles.content}>
        <GlassSurface variant="panel" style={styles.cockpitShell} borderRadius={LDS_RADIUS.xl}>
          <View style={styles.phaseBlock}>
            <PremiumText variant="step" style={styles.phaseStep}>
              Eşleşme tamam
            </PremiumText>
            <PremiumText variant="caption" muted style={styles.phaseCaption}>
              Güvenli geçiş · Sürücünle eşleştin
            </PremiumText>
          </View>

          <View style={styles.heroBlock}>
            <View style={styles.guardianOrb}>
              <LeylekEye
                size={LEYLEK_EYE_HERO_SIZE + LDS_SPACING.sm}
                motionProfile="guardian"
                chromeTone="subtle"
                accessibilityLabel="Eşleşme tamamlandı. Sürücünle eşleştin. Buluşma ekranı hazırlanıyor."
              />
            </View>
          </View>

          <PremiumText variant="caption" muted style={styles.helperText}>
            Buluşma ekranı hazırlanıyor
          </PremiumText>
        </GlassSurface>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10000,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: LDS_SPACING.lg,
    maxWidth: SCREEN_W,
    width: '100%',
  },
  cockpitShell: {
    width: '100%',
    maxWidth: MATCH_COCKPIT_MAX_WIDTH,
    paddingTop: LDS_SPACING.lg,
    paddingBottom: LDS_SPACING.lg,
    paddingHorizontal: LDS_SPACING.md,
    alignItems: 'center',
    ...LDS_ELEVATION.cockpit,
  },
  phaseBlock: {
    alignItems: 'center',
    gap: LDS_SPACING.xxs,
    marginBottom: LDS_SPACING.md,
    paddingHorizontal: LDS_SPACING.xxs,
  },
  phaseStep: {
    textAlign: 'center',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  phaseCaption: {
    textAlign: 'center',
  },
  heroBlock: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: LDS_SPACING.sm,
  },
  guardianOrb: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: LDS_SPACING.sm,
    borderRadius: LDS_RADIUS.full,
    borderWidth: LDS_BORDER_WIDTH.standard,
    borderColor: LDS_BORDER_COLOR.cockpitPanelTop,
  },
  helperText: {
    textAlign: 'center',
    letterSpacing: 0.2,
  },
});
