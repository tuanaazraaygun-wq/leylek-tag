import React, { memo, useMemo } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSelectionMotion } from '../hooks/useSelectionMotion';
import {
  LDS_GRADIENT_GLASS_SHEEN_PANEL,
  LDS_GRADIENT_GLASS_SHEEN_PANEL_LOCATIONS,
  LDS_GRADIENT_SELECTION_GLOW_HORIZONTAL,
  LDS_GRADIENT_SELECTION_GLOW_HORIZONTAL_LOCATIONS,
  LDS_GRADIENT_SELECTION_GLOW_VERTICAL,
  LDS_GRADIENT_SELECTION_GLOW_VERTICAL_LOCATIONS,
} from '../tokens/gradient';
import { LDS_BORDER_COLOR, LDS_BORDER_WIDTH } from '../tokens/border';
import { LDS_ILLUSTRATION } from '../tokens/illustration';
import { LDS_RADIUS } from '../tokens/radius';

export type PremiumSelectionCardProps = {
  selected?: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  heroHeight: number;
  illustration: React.ReactNode;
  title: string;
  subtitle: string;
  titleStyle?: StyleProp<TextStyle>;
  subtitleStyle?: StyleProp<TextStyle>;
  checkmark?: React.ReactNode;
  testID?: string;
  /** Tighter copy block on small role cards (LDS-4D-I4) */
  compactCopy?: boolean;
  /** Subtitle line clamp — match-mode cards use 2 lines on compact screens */
  subtitleNumberOfLines?: number;
};

function PremiumSelectionCard({
  selected = false,
  onPress,
  style,
  heroHeight,
  illustration,
  title,
  subtitle,
  titleStyle,
  subtitleStyle,
  checkmark,
  testID,
  compactCopy = false,
  subtitleNumberOfLines = 1,
}: PremiumSelectionCardProps) {
  const motion = useSelectionMotion({ selected });
  const borderRadius = LDS_RADIUS.cardPrimary;

  const cardStyle = useMemo(
    () => [
      styles.card,
      selected && styles.cardSelected,
      style,
    ],
    [selected, style],
  );

  return (
    <Pressable
      onPress={onPress}
      onPressIn={motion.onPressIn}
      onPressOut={motion.onPressOut}
      testID={testID}
      style={styles.pressable}
    >
      <Animated.View
        style={[
          cardStyle,
          {
            transform: [{ translateY: -2 }, { scale: motion.scale }],
          },
        ]}
      >
        <LinearGradient
          colors={[...LDS_GRADIENT_GLASS_SHEEN_PANEL] as [string, string, ...string[]]}
          locations={[...LDS_GRADIENT_GLASS_SHEEN_PANEL_LOCATIONS] as [number, number, ...number[]]}
          start={{ x: 0.08, y: 0 }}
          end={{ x: 0.55, y: 0.95 }}
          pointerEvents="none"
          style={[StyleSheet.absoluteFillObject, { borderRadius }]}
        />

        <Animated.View
          pointerEvents="none"
          style={[
            styles.selectionGlowVertical,
            { borderRadius, opacity: motion.glowOpacity },
          ]}
        >
          <LinearGradient
            colors={[...LDS_GRADIENT_SELECTION_GLOW_VERTICAL] as [string, string, ...string[]]}
            locations={[...LDS_GRADIENT_SELECTION_GLOW_VERTICAL_LOCATIONS] as [number, number, ...number[]]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
        </Animated.View>

        <Animated.View
          pointerEvents="none"
          style={[
            styles.selectionGlowHorizontal,
            { borderRadius, opacity: motion.glowOpacity },
          ]}
        >
          <LinearGradient
            colors={[...LDS_GRADIENT_SELECTION_GLOW_HORIZONTAL] as [string, string, ...string[]]}
            locations={[...LDS_GRADIENT_SELECTION_GLOW_HORIZONTAL_LOCATIONS] as [number, number, ...number[]]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFillObject}
          />
        </Animated.View>

        <Animated.View
          pointerEvents="none"
          style={[
            styles.borderRing,
            {
              borderRadius: borderRadius - 1,
              opacity: motion.borderRingOpacity,
            },
          ]}
        />

        <View
          style={[
            styles.heroSlot,
            selected && styles.heroSlotSelected,
            { height: heroHeight, minHeight: heroHeight },
          ]}
        >
          {illustration}
        </View>

        <View style={[styles.copyBlock, compactCopy && styles.copyBlockCompact]}>
          <Text style={[styles.titleDefault, titleStyle]} numberOfLines={1}>
            {title}
          </Text>
          <Text
            style={[styles.subtitleDefault, subtitleStyle]}
            numberOfLines={subtitleNumberOfLines}
            ellipsizeMode="tail"
            adjustsFontSizeToFit={subtitleNumberOfLines === 1}
            minimumFontScale={0.78}
          >
            {subtitle}
          </Text>
        </View>

        {checkmark ? <View style={styles.checkmarkSlot}>{checkmark}</View> : null}
      </Animated.View>
    </Pressable>
  );
}

export default memo(PremiumSelectionCard);

export function computeRoleCardHeroHeight(
  cardMinHeight: number,
  isVeryCompact: boolean,
  isCompact: boolean,
): number {
  const ratio = isVeryCompact
    ? LDS_ILLUSTRATION.heroHeightRatioVeryCompact
    : isCompact
      ? LDS_ILLUSTRATION.heroHeightRatioCompact
      : LDS_ILLUSTRATION.heroHeightRatio;
  return Math.round(cardMinHeight * ratio);
}

export function computeRoleIllustrationHeroSize(heroHeight: number, isVeryCompact: boolean): number {
  const fill = isVeryCompact ? 0.76 : 0.82;
  return Math.round(heroHeight * fill);
}

const styles = StyleSheet.create({
  pressable: {
    flex: 1,
  },
  card: {
    flex: 1,
    borderRadius: LDS_RADIUS.cardPrimary,
    backgroundColor: 'rgba(16,26,43,0.87)',
    borderWidth: LDS_BORDER_WIDTH.standard,
    borderColor: LDS_BORDER_COLOR.card,
    borderTopColor: LDS_BORDER_COLOR.cardTopCyan,
    borderLeftColor: LDS_BORDER_COLOR.cardLeftCyan,
    overflow: 'hidden',
    position: 'relative',
  },
  cardSelected: {
    backgroundColor: 'rgba(10,22,38,0.98)',
  },
  selectionGlowVertical: {
    ...StyleSheet.absoluteFillObject,
  },
  selectionGlowHorizontal: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.65,
  },
  borderRing: {
    ...StyleSheet.absoluteFillObject,
    margin: 0,
    borderWidth: LDS_BORDER_WIDTH.emphasis,
    borderColor: LDS_BORDER_COLOR.selected,
    borderTopColor: LDS_BORDER_COLOR.selectedTop,
  },
  heroSlot: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(4,10,20,0.55)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(34,211,238,0.1)',
    overflow: 'hidden',
  },
  heroSlotSelected: {
    backgroundColor: 'rgba(34,211,238,0.05)',
  },
  copyBlock: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 11,
    gap: 4,
  },
  copyBlockCompact: {
    paddingTop: 6,
    paddingBottom: 8,
    gap: 3,
  },
  titleDefault: {
    textAlign: 'center',
  },
  subtitleDefault: {
    textAlign: 'center',
    width: '100%',
    opacity: 0.82,
  },
  checkmarkSlot: {
    position: 'absolute',
    top: 4,
    right: 4,
    zIndex: 2,
  },
});
