import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  PREMIUM_AUTH_CYAN,
  PREMIUM_BORDER_SLATE,
  PREMIUM_NAVY_CARD,
  PREMIUM_NAVY_DEEP,
  PREMIUM_ROLE_COCKPIT_CYAN_EDGE,
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

type CardDef = {
  id: 'quick' | 'trusted' | 'normal';
  emoji: string;
  title: string;
  subtitle: string;
  enabled: boolean;
};

const CARDS: CardDef[] = [
  {
    id: 'quick',
    emoji: '⚡',
    title: 'Hızlı Eşleşme',
    subtitle: 'Yakında',
    enabled: false,
  },
  {
    id: 'trusted',
    emoji: '🦢',
    title: 'Sürücülerim',
    subtitle: 'Yakında',
    enabled: false,
  },
  {
    id: 'normal',
    emoji: '🌍',
    title: 'Normal Eşleşme',
    subtitle: 'Rota seç, teklif gönder',
    enabled: true,
  },
];

function PassengerMatchModeCards({
  onNormalPress,
  onQuickPress,
  onTrustedPress,
}: PassengerMatchModeCardsProps) {
  const { status, summary } = useTrustedSummary();
  const trustedWired = typeof onTrustedPress === 'function';
  const quickWired = typeof onQuickPress === 'function';

  return (
    <View style={styles.stack} accessibilityRole="list">
      {CARDS.map((card) => {
        const isNormal = card.id === 'normal';
        const isTrusted = card.id === 'trusted';
        const isQuick = card.id === 'quick';
        const isEnabled =
          card.enabled || (isQuick && quickWired) || (isTrusted && trustedWired);
        const trustedReady = isTrusted && status === 'ready' && summary != null;
        const trustedSubtitle =
          trustedReady && summary
            ? formatPassengerTrustedCardSubtitle(summary)
            : null;
        const showSoonPill =
          (isQuick && !quickWired) || (isTrusted && !trustedWired && !trustedReady);
        const onPress = isNormal
          ? onNormalPress
          : isQuick && quickWired
            ? onQuickPress
            : isTrusted && trustedWired
              ? onTrustedPress
              : undefined;

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
                  ? `${card.title}. Rota seç, hızlı eşleş`
                  : isTrusted && trustedSubtitle
                    ? `${card.title}. ${trustedSubtitle}`
                    : isTrusted && trustedWired
                      ? `${card.title}. Güven ağınız`
                      : `${card.title}. Yakında`
            }
            style={({ pressed }) => [
              styles.cardOuter,
              !isEnabled && styles.cardOuterDisabled,
              isEnabled && pressed && styles.cardOuterPressed,
            ]}
          >
            <LinearGradient
              colors={
                isEnabled
                  ? [PREMIUM_NAVY_DEEP, PREMIUM_NAVY_CARD, 'rgba(16, 26, 43, 0.92)']
                  : ['rgba(8, 17, 31, 0.72)', 'rgba(16, 26, 43, 0.58)', 'rgba(8, 17, 31, 0.68)']
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[
                styles.cardGradient,
                isEnabled ? styles.cardGradientActive : styles.cardGradientDisabled,
              ]}
            >
              <View style={[styles.iconOrb, isEnabled && styles.iconOrbActive]}>
                <Text style={styles.emoji}>{card.emoji}</Text>
              </View>
              <View style={styles.textCol}>
                <Text
                  style={[styles.title, !isEnabled && styles.titleDisabled]}
                  numberOfLines={1}
                >
                  {card.title}
                </Text>
                {showSoonPill ? (
                  <View style={styles.soonPill}>
                    <Text style={styles.soonPillText}>Yakında</Text>
                  </View>
                ) : trustedSubtitle ? (
                  <Text style={styles.subtitle} numberOfLines={2}>
                    {trustedSubtitle}
                  </Text>
                ) : isQuick && quickWired ? (
                  <Text style={styles.subtitle} numberOfLines={1}>
                    Rota seç, hızlı eşleş
                  </Text>
                ) : isTrusted && trustedWired ? (
                  <Text style={styles.subtitle} numberOfLines={1}>
                    Güven ağınız
                  </Text>
                ) : (
                  <Text style={styles.subtitle} numberOfLines={1}>
                    {card.subtitle}
                  </Text>
                )}
              </View>
              {isEnabled ? (
                <Ionicons name="chevron-forward" size={20} color={PREMIUM_AUTH_CYAN} />
              ) : (
                <View style={styles.chevronPlaceholder} />
              )}
            </LinearGradient>
          </Pressable>
        );
      })}
    </View>
  );
}

export default memo(PassengerMatchModeCards);

const styles = StyleSheet.create({
  stack: {
    alignSelf: 'stretch',
    marginHorizontal: 8,
    marginBottom: 4,
    gap: 10,
  },
  cardOuter: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth + 1,
    borderColor: PREMIUM_ROLE_COCKPIT_CYAN_EDGE,
    shadowColor: 'rgba(34, 211, 238, 0.14)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 6,
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
  cardGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 14,
    minHeight: 72,
  },
  cardGradientActive: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(34, 211, 238, 0.28)',
  },
  cardGradientDisabled: {
    borderWidth: 0,
  },
  iconOrb: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(30, 58, 95, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PREMIUM_BORDER_SLATE,
  },
  iconOrbActive: {
    backgroundColor: 'rgba(34, 211, 238, 0.12)',
    borderColor: 'rgba(34, 211, 238, 0.32)',
  },
  emoji: {
    fontSize: 22,
    lineHeight: 26,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: PREMIUM_TEXT_SOFT,
    letterSpacing: -0.2,
  },
  titleDisabled: {
    color: PREMIUM_TEXT_MUTED,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(186, 201, 222, 0.82)',
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
