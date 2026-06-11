import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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
const CHEVRON_CYAN = 'rgba(34, 211, 238, 0.72)';
const CHEVRON_MUTED = 'rgba(148, 163, 184, 0.55)';

function PassengerMatchModeCards({
  onNormalPress,
  onQuickPress,
  onTrustedPress,
}: PassengerMatchModeCardsProps) {
  const { status, summary } = useTrustedSummary();
  const trustedWired = typeof onTrustedPress === 'function';
  const quickWired = typeof onQuickPress === 'function';

  const renderCard = (card: CardDef) => {
    const isPrimary = card.tier === 'primary';
    const isNormal = card.id === 'normal';
    const isTrusted = card.id === 'trusted';
    const isQuick = card.id === 'quick';
    const isEnabled =
      card.enabled || (isQuick && quickWired) || (isTrusted && trustedWired);
    const trustedReady = isTrusted && status === 'ready' && summary != null;
    const trustedSubtitle =
      trustedReady && summary ? formatPassengerTrustedCardSubtitle(summary) : null;
    const showSoonPill =
      (isQuick && !quickWired) || (isTrusted && !trustedWired && !trustedReady);
    const onPress = isNormal
      ? onNormalPress
      : isQuick && quickWired
        ? onQuickPress
        : isTrusted && trustedWired
          ? onTrustedPress
          : undefined;

    const displaySubtitle = showSoonPill
      ? null
      : trustedSubtitle
        ? trustedSubtitle
        : isQuick && quickWired
          ? card.subtitle
          : isTrusted && trustedWired
            ? card.subtitle
            : card.subtitle;

    return (
      <Pressable
        key={card.id}
        disabled={!isEnabled}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ disabled: !isEnabled }}
        accessibilityLabel={
          isEnabled && isNormal
            ? `${card.title}. ${card.subtitle}`
            : isQuick && quickWired
              ? `${card.title}. ${card.subtitle}`
              : isTrusted && trustedSubtitle
                ? `${card.title}. ${trustedSubtitle}`
                : isTrusted && trustedWired
                  ? `${card.title}. ${card.subtitle}`
                  : `${card.title}. Yakında`
        }
        style={({ pressed }) => [
          isPrimary ? styles.cardOuterPrimary : styles.cardOuterSecondary,
          !isEnabled && styles.cardOuterDisabled,
          isEnabled && pressed && styles.cardOuterPressed,
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
          style={[
            isPrimary ? styles.cardGradientPrimary : styles.cardGradientSecondary,
            isEnabled
              ? isPrimary
                ? styles.cardGradientActivePrimary
                : styles.cardGradientActiveSecondary
              : styles.cardGradientDisabled,
          ]}
        >
          <View
            style={[
              isPrimary ? styles.iconOrbPrimary : styles.iconOrbSecondary,
              isEnabled && (isPrimary ? styles.iconOrbActivePrimary : styles.iconOrbActiveSecondary),
            ]}
          >
            <Ionicons
              name={card.icon}
              size={isPrimary ? 24 : 20}
              color={isEnabled ? (isPrimary ? ICON_CYAN : ICON_CYAN_MUTED) : PREMIUM_TEXT_MUTED}
            />
          </View>
          <View style={styles.textCol}>
            <Text
              style={[
                isPrimary ? styles.titlePrimary : styles.titleSecondary,
                !isEnabled && styles.titleDisabled,
              ]}
              numberOfLines={1}
            >
              {card.title}
            </Text>
            {showSoonPill ? (
              <View style={styles.soonPill}>
                <Text style={styles.soonPillText}>Yakında</Text>
              </View>
            ) : displaySubtitle ? (
              <Text
                style={[isPrimary ? styles.subtitlePrimary : styles.subtitleSecondary]}
                numberOfLines={isTrusted ? 2 : 2}
              >
                {displaySubtitle}
              </Text>
            ) : null}
          </View>
          {isEnabled ? (
            <Ionicons
              name="chevron-forward"
              size={isPrimary ? 20 : 18}
              color={isPrimary ? CHEVRON_CYAN : CHEVRON_MUTED}
            />
          ) : (
            <View style={styles.chevronPlaceholder} />
          )}
        </LinearGradient>
      </Pressable>
    );
  };

  return (
    <View style={styles.stack} accessibilityRole="list">
      <View style={styles.primaryGroup}>{PRIMARY_CARDS.map(renderCard)}</View>
      <View style={styles.secondaryGroup}>{renderCard(SECONDARY_CARD)}</View>
    </View>
  );
}

export default memo(PassengerMatchModeCards);

const styles = StyleSheet.create({
  stack: {
    alignSelf: 'stretch',
    marginHorizontal: 8,
    marginBottom: 4,
    gap: 12,
  },
  primaryGroup: {
    gap: 10,
  },
  secondaryGroup: {
    marginTop: 2,
  },
  cardOuterPrimary: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth + 1,
    borderColor: 'rgba(30, 58, 95, 0.78)',
    shadowColor: 'rgba(34, 211, 238, 0.08)',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardOuterSecondary: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth + 1,
    borderColor: PREMIUM_BORDER_SLATE,
    shadowOpacity: 0,
    elevation: 0,
  },
  cardOuterDisabled: {
    opacity: 0.58,
    borderColor: PREMIUM_BORDER_SLATE,
    shadowOpacity: 0,
    elevation: 0,
  },
  cardOuterPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.992 }],
  },
  cardGradientPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 17,
    paddingHorizontal: 16,
    gap: 14,
    minHeight: 76,
  },
  cardGradientSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
    minHeight: 56,
  },
  cardGradientActivePrimary: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(34, 211, 238, 0.18)',
  },
  cardGradientActiveSecondary: {
    borderWidth: 0,
  },
  cardGradientDisabled: {
    borderWidth: 0,
  },
  iconOrbPrimary: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(30, 58, 95, 0.42)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PREMIUM_BORDER_SLATE,
  },
  iconOrbSecondary: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(30, 58, 95, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PREMIUM_BORDER_SLATE,
  },
  iconOrbActivePrimary: {
    backgroundColor: 'rgba(34, 211, 238, 0.08)',
    borderColor: 'rgba(34, 211, 238, 0.22)',
  },
  iconOrbActiveSecondary: {
    backgroundColor: 'rgba(30, 58, 95, 0.45)',
    borderColor: 'rgba(30, 58, 95, 0.72)',
  },
  textCol: {
    flex: 1,
    minWidth: 0,
    gap: 5,
  },
  titlePrimary: {
    fontSize: 17,
    fontWeight: '800',
    color: PREMIUM_TEXT_SOFT,
    letterSpacing: -0.2,
  },
  titleSecondary: {
    fontSize: 15,
    fontWeight: '700',
    color: 'rgba(224, 236, 248, 0.9)',
    letterSpacing: -0.1,
  },
  titleDisabled: {
    color: PREMIUM_TEXT_MUTED,
  },
  subtitlePrimary: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(186, 201, 222, 0.78)',
    lineHeight: 18,
  },
  subtitleSecondary: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(148, 163, 184, 0.82)',
    lineHeight: 16,
  },
  soonPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(30, 58, 95, 0.55)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PREMIUM_BORDER_SLATE,
  },
  soonPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(148, 163, 184, 0.92)',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  chevronPlaceholder: {
    width: 20,
    height: 20,
  },
});
