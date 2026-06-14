import React, { memo, useMemo } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import {
  PREMIUM_BORDER_SLATE,
  PREMIUM_NAVY_CARD,
  PREMIUM_NAVY_DEEP,
  PREMIUM_TEXT_MUTED,
  PREMIUM_TEXT_SOFT,
} from '../auth/premiumAuthStyles';
import {
  GlassSurface,
  PremiumSelectionCard,
  PremiumText,
  computeRoleCardHeroHeight,
  computeRoleIllustrationHeroSize,
} from '../../design-system/primitives';
import { LDS_BORDER_COLOR, LDS_BORDER_WIDTH } from '../../design-system/tokens/border';
import { LDS_RADIUS } from '../../design-system/tokens/radius';
import { LDS_TYPOGRAPHY } from '../../design-system/tokens/typography';
import { useTrustedSummary } from '../../hooks/useTrustedSummary';
import { formatPassengerTrustedCardSubtitle } from '../../lib/trustedSummaryCopy';

export type PassengerMatchModeCardsProps = {
  /** Mevcut rota seçimi — yalnızca setShowDestinationPicker(true) */
  onNormalPress: () => void;
  /** Hızlı Eşleşme — route picker + Quick Match flow */
  onQuickPress?: () => void;
  /** Güvenilir sürücüler hub — /trusted-network?role=passenger */
  onTrustedPress?: () => void;
};

type IoniconName = ComponentProps<typeof Ionicons>['name'];

type CardDef = {
  id: 'quick' | 'trusted' | 'normal';
  icon: IoniconName;
  title: string;
  subtitle: string;
  enabled: boolean;
  tier: 'primary' | 'secondary';
};

const PRIMARY_CARDS: CardDef[] = [
  {
    id: 'quick',
    icon: 'flash-outline',
    title: 'Hemen Eşleş',
    subtitle: 'Yakındaki uygun sürücüleri sırayla ara',
    enabled: false,
    tier: 'primary',
  },
  {
    id: 'normal',
    icon: 'globe-outline',
    title: 'Normal Eşleşme',
    subtitle: 'Rota seç, teklif gönder',
    enabled: true,
    tier: 'primary',
  },
];

const SECONDARY_CARD: CardDef = {
  id: 'trusted',
  icon: 'people-outline',
  title: 'Sürücülerim',
  subtitle: 'Güvendiğiniz sürücüler',
  enabled: false,
  tier: 'secondary',
};

const ICON_CYAN = 'rgba(34, 211, 238, 0.82)';
const ICON_CYAN_MUTED = 'rgba(34, 211, 238, 0.52)';
const CHEVRON_MUTED = 'rgba(148, 163, 184, 0.55)';

type MatchHeroIllustrationProps = {
  icon: IoniconName;
  iconSize: number;
  emphasis?: boolean;
  enabled?: boolean;
};

function MatchHeroIllustration({
  icon,
  iconSize,
  emphasis = false,
  enabled = true,
}: MatchHeroIllustrationProps) {
  return (
    <View
      style={[
        styles.heroIllustrationWrap,
        emphasis ? styles.heroIllustrationQuick : styles.heroIllustrationCalm,
        !enabled && styles.heroIllustrationDisabled,
      ]}
    >
      <LinearGradient
        colors={
          emphasis
            ? ['rgba(34,211,238,0.16)', 'rgba(8,17,31,0.62)', 'rgba(4,10,20,0.78)']
            : ['rgba(30,58,95,0.42)', 'rgba(8,17,31,0.62)', 'rgba(4,10,20,0.78)']
        }
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <View
        style={[
          styles.heroIconOrb,
          emphasis ? styles.heroIconOrbQuick : styles.heroIconOrbCalm,
          !enabled && styles.heroIconOrbDisabled,
        ]}
      >
        <Ionicons
          name={icon}
          size={iconSize}
          color={enabled ? (emphasis ? ICON_CYAN : ICON_CYAN_MUTED) : PREMIUM_TEXT_MUTED}
        />
      </View>
    </View>
  );
}

function PassengerMatchModeCards({
  onNormalPress,
  onQuickPress,
  onTrustedPress,
}: PassengerMatchModeCardsProps) {
  const { height: winH, width: winW } = useWindowDimensions();
  const { status, summary } = useTrustedSummary();
  const trustedWired = typeof onTrustedPress === 'function';
  const quickWired = typeof onQuickPress === 'function';

  const layout = useMemo(() => {
    const usableHeight = Math.max(0, winH - 120);
    const isCompact = usableHeight < 720 || winW < 380;
    const isVeryCompact = usableHeight < 650 || winW < 360;
    const coeff = isVeryCompact ? 0.26 : isCompact ? 0.265 : 0.275;
    const primaryCardMinHeight = Math.round(
      Math.max(148, Math.min(188, usableHeight * coeff)),
    );
    const primaryHeroHeight = computeRoleCardHeroHeight(
      primaryCardMinHeight,
      isVeryCompact,
      isCompact && !isVeryCompact,
    );
    const heroIconSize = computeRoleIllustrationHeroSize(primaryHeroHeight, isVeryCompact);
    const titleSize = isVeryCompact ? 15 : isCompact ? 16 : 17;
    const subtitleSize = isVeryCompact ? 10 : 11;
    return {
      isCompact,
      isVeryCompact,
      primaryCardMinHeight,
      primaryHeroHeight,
      heroIconSize,
      titleSize,
      subtitleSize,
    };
  }, [winH, winW]);

  const renderPrimaryHero = (card: CardDef) => {
    const isNormal = card.id === 'normal';
    const isQuick = card.id === 'quick';
    const isEnabled =
      card.enabled || (isQuick && quickWired);
    const showSoonPill = isQuick && !quickWired;
    const onPress = isNormal
      ? onNormalPress
      : isQuick && quickWired
        ? onQuickPress!
        : undefined;

    const cardShellStyle = [
      styles.heroCardShell,
      { minHeight: layout.primaryCardMinHeight, maxHeight: layout.primaryCardMinHeight + 16 },
      isQuick ? styles.quickHeroCard : styles.normalHeroCard,
      !isEnabled && styles.heroCardDisabledShell,
    ];

    const titleStyle = [
      LDS_TYPOGRAPHY.title,
      styles.heroTitle,
      { fontSize: layout.titleSize },
      isQuick && isEnabled && styles.quickTitle,
      !isEnabled && styles.titleDisabled,
    ];

    const subtitleStyle = [
      LDS_TYPOGRAPHY.caption,
      styles.heroSubtitle,
      { fontSize: layout.subtitleSize, lineHeight: layout.subtitleSize + 4 },
      isQuick && isEnabled && styles.quickSubtitle,
    ];

    const heroCard = (
      <PremiumSelectionCard
        selected={false}
        onPress={onPress ?? (() => {})}
        heroHeight={layout.primaryHeroHeight}
        compactCopy={layout.isCompact}
        style={cardShellStyle}
        illustration={
          <MatchHeroIllustration
            icon={card.icon}
            iconSize={layout.heroIconSize}
            emphasis={isQuick}
            enabled={isEnabled}
          />
        }
        title={card.title}
        subtitle={showSoonPill ? ' ' : card.subtitle}
        titleStyle={titleStyle}
        subtitleStyle={subtitleStyle}
        checkmark={
          showSoonPill ? (
            <View style={styles.soonPill}>
              <PremiumText variant="step" style={styles.soonPillText}>
                Yakında
              </PremiumText>
            </View>
          ) : undefined
        }
      />
    );

    if (!isEnabled) {
      return (
        <Pressable
          key={card.id}
          disabled
          accessibilityRole="button"
          accessibilityState={{ disabled: true }}
          accessibilityLabel={`${card.title}. Yakında`}
          style={styles.heroCell}
        >
          <View pointerEvents="none">{heroCard}</View>
        </Pressable>
      );
    }

    return (
      <View key={card.id} style={styles.heroCell}>
        {heroCard}
      </View>
    );
  };

  const renderTrustedCompact = (card: CardDef) => {
    const isTrusted = card.id === 'trusted';
    const isEnabled = card.enabled || (isTrusted && trustedWired);
    const trustedReady = isTrusted && status === 'ready' && summary != null;
    const trustedSubtitle =
      trustedReady && summary ? formatPassengerTrustedCardSubtitle(summary) : null;
    const showSoonPill =
      (isTrusted && !trustedWired && !trustedReady);
    const onPress =
      isTrusted && trustedWired ? onTrustedPress : undefined;

    const displaySubtitle = showSoonPill
      ? null
      : trustedSubtitle
        ? trustedSubtitle
        : isTrusted && trustedWired
          ? card.subtitle
          : card.subtitle;

    return (
      <GlassSurface variant="plain" style={styles.trustGlass}>
        <Pressable
          disabled={!isEnabled}
          onPress={onPress}
          accessibilityRole="button"
          accessibilityState={{ disabled: !isEnabled }}
          accessibilityLabel={
            isTrusted && trustedSubtitle
              ? `${card.title}. ${trustedSubtitle}`
              : isTrusted && trustedWired
                ? `${card.title}. ${card.subtitle}`
                : `${card.title}. Yakında`
          }
          style={({ pressed }) => [
            styles.trustRow,
            !isEnabled && styles.trustRowDisabled,
            isEnabled && pressed && styles.trustRowPressed,
          ]}
        >
          <LinearGradient
            colors={
              isEnabled
                ? [PREMIUM_NAVY_DEEP, PREMIUM_NAVY_CARD, 'rgba(16, 26, 43, 0.94)']
                : ['rgba(8, 17, 31, 0.72)', 'rgba(16, 26, 43, 0.58)', 'rgba(8, 17, 31, 0.68)']
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.trustGradient}
          >
            <View
              style={[
                styles.trustIconOrb,
                isEnabled && styles.trustIconOrbActive,
              ]}
            >
              <Ionicons
                name={card.icon}
                size={20}
                color={isEnabled ? ICON_CYAN_MUTED : PREMIUM_TEXT_MUTED}
              />
            </View>
            <View style={styles.trustTextCol}>
              <PremiumText
                variant="body"
                style={[styles.trustTitle, !isEnabled && styles.titleDisabled]}
                numberOfLines={1}
              >
                {card.title}
              </PremiumText>
              {showSoonPill ? (
                <View style={styles.soonPill}>
                  <PremiumText variant="step" style={styles.soonPillText}>
                    Yakında
                  </PremiumText>
                </View>
              ) : displaySubtitle ? (
                <PremiumText
                  variant="caption"
                  muted
                  style={styles.trustSubtitle}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {displaySubtitle}
                </PremiumText>
              ) : null}
            </View>
            {isEnabled ? (
              <Ionicons name="chevron-forward" size={18} color={CHEVRON_MUTED} />
            ) : (
              <View style={styles.chevronPlaceholder} />
            )}
          </LinearGradient>
        </Pressable>
      </GlassSurface>
    );
  };

  return (
    <View style={styles.matchDeck} accessibilityRole="list">
      <View style={styles.heroRow}>
        {PRIMARY_CARDS.map(renderPrimaryHero)}
      </View>
      <View style={styles.trustSlot}>{renderTrustedCompact(SECONDARY_CARD)}</View>
    </View>
  );
}

export default memo(PassengerMatchModeCards);

const styles = StyleSheet.create({
  matchDeck: {
    alignSelf: 'stretch',
    gap: 10,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
  },
  heroCell: {
    flex: 1,
    minWidth: 0,
  },
  heroCardShell: {
    flex: 1,
  },
  quickHeroCard: {
    borderTopColor: 'rgba(34, 211, 238, 0.38)',
    borderLeftColor: 'rgba(34, 211, 238, 0.16)',
    borderColor: 'rgba(34, 211, 238, 0.26)',
    ...Platform.select({
      ios: {
        shadowColor: 'rgba(34, 211, 238, 0.35)',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.42,
        shadowRadius: 10,
      },
      android: { elevation: 5 },
    }),
  },
  normalHeroCard: {
    borderTopColor: LDS_BORDER_COLOR.cardTopCyan,
    borderLeftColor: LDS_BORDER_COLOR.cardLeftCyan,
    borderColor: LDS_BORDER_COLOR.card,
    opacity: 0.96,
  },
  heroCardDisabledShell: {
    opacity: 0.58,
    borderColor: PREMIUM_BORDER_SLATE,
    shadowOpacity: 0,
    elevation: 0,
  },
  heroIllustrationWrap: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  heroIllustrationQuick: {
    backgroundColor: 'rgba(34, 211, 238, 0.04)',
  },
  heroIllustrationCalm: {
    backgroundColor: 'rgba(4, 10, 20, 0.35)',
  },
  heroIllustrationDisabled: {
    opacity: 0.72,
  },
  heroIconOrb: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: LDS_BORDER_WIDTH.standard,
    borderRadius: LDS_RADIUS.cardPrimary * 0.55,
  },
  heroIconOrbQuick: {
    width: 72,
    height: 72,
    backgroundColor: 'rgba(34, 211, 238, 0.1)',
    borderColor: 'rgba(34, 211, 238, 0.28)',
  },
  heroIconOrbCalm: {
    width: 64,
    height: 64,
    backgroundColor: 'rgba(30, 58, 95, 0.42)',
    borderColor: PREMIUM_BORDER_SLATE,
  },
  heroIconOrbDisabled: {
    backgroundColor: 'rgba(30, 58, 95, 0.35)',
    borderColor: PREMIUM_BORDER_SLATE,
  },
  heroTitle: {
    textAlign: 'center',
    fontWeight: '800',
    color: PREMIUM_TEXT_SOFT,
    letterSpacing: -0.25,
  },
  quickTitle: {
    color: 'rgba(240, 252, 255, 0.98)',
  },
  heroSubtitle: {
    textAlign: 'center',
    fontWeight: '600',
    opacity: 0.82,
  },
  quickSubtitle: {
    color: 'rgba(186, 230, 245, 0.88)',
    opacity: 0.9,
  },
  titleDisabled: {
    color: PREMIUM_TEXT_MUTED,
  },
  trustSlot: {
    marginTop: 2,
  },
  trustGlass: {
    borderRadius: LDS_RADIUS.cardPrimary - 4,
    overflow: 'hidden',
  },
  trustRow: {
    borderRadius: LDS_RADIUS.cardPrimary - 4,
    overflow: 'hidden',
    borderWidth: LDS_BORDER_WIDTH.standard,
    borderColor: PREMIUM_BORDER_SLATE,
  },
  trustRowDisabled: {
    opacity: 0.58,
  },
  trustRowPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.992 }],
  },
  trustGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
    minHeight: 56,
  },
  trustIconOrb: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(30, 58, 95, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PREMIUM_BORDER_SLATE,
  },
  trustIconOrbActive: {
    backgroundColor: 'rgba(30, 58, 95, 0.45)',
    borderColor: 'rgba(30, 58, 95, 0.72)',
  },
  trustTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  trustTitle: {
    fontWeight: '700',
    color: 'rgba(224, 236, 248, 0.9)',
    letterSpacing: -0.1,
  },
  trustSubtitle: {
    fontWeight: '600',
  },
  soonPill: {
    alignSelf: 'center',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(30, 58, 95, 0.55)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PREMIUM_BORDER_SLATE,
  },
  soonPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(148, 163, 184, 0.92)',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  chevronPlaceholder: {
    width: 18,
    height: 18,
  },
});
