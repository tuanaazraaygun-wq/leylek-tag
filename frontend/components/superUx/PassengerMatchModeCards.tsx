import React, { memo, useMemo } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import {
  PREMIUM_AUTH_CYAN,
  PREMIUM_BORDER_SLATE,
  PREMIUM_NAVY_DEEP,
  PREMIUM_TEXT_MUTED,
  PREMIUM_TEXT_SOFT,
} from '../auth/premiumAuthStyles';
import {
  PremiumSelectionCard,
  PremiumText,
  computeRoleCardHeroHeight,
} from '../../design-system/primitives';
import NormalMatchOfferHero from '../../design-system/role-select/NormalMatchOfferHero';
import ProxyPickupHero from '../../design-system/role-select/ProxyPickupHero';
import QuickMatchHero from '../../design-system/role-select/QuickMatchHero';
import TrustedNetworkHero from '../../design-system/role-select/TrustedNetworkHero';
import { LDS_BORDER_COLOR } from '../../design-system/tokens/border';
import { LDS_SPACING } from '../../design-system/tokens/spacing';
import { LDS_TYPOGRAPHY } from '../../design-system/tokens/typography';
import { useTrustedSummary } from '../../hooks/useTrustedSummary';
import { formatPassengerTrustedCardSubtitle } from '../../lib/trustedSummaryCopy';
import { usePassengerTheme } from '../../lib/theme/usePassengerTheme';
import type { LhThemeTokens } from '../../lib/theme/types';

export type PassengerMatchModeCardsProps = {
  /** Mevcut rota seçimi — yalnızca setShowDestinationPicker(true) */
  onNormalPress: () => void;
  /** Hızlı Eşleşme — route picker + Quick Match flow */
  onQuickPress?: () => void;
  /** Güvenilir sürücüler hub — /trusted-network?role=passenger */
  onTrustedPress?: () => void;
  /** Onaylı sürücü kaydı — kart «Yolcularım» + sürücü paneli köprüsü */
  hasDriverRegistration?: boolean;
  /** Onaylı sürücü — doğrudan sürücü paneline geçiş (Yolcularım kartı) */
  onDriverPanelPress?: () => void;
  /** v1.1 — role-filtered yolcu sayısı; yoksa statik fallback */
  trustedPassengerCount?: number | null;
};

type CardBadgeTone = 'quick' | 'normal';

type CardDef = {
  id: 'quick' | 'trusted' | 'normal' | 'proxy';
  title: string;
  subtitle: string;
  badge?: string;
  badgeTone?: CardBadgeTone;
  enabled: boolean;
  tier: 'primary' | 'secondary';
};

type MatchCardTheme = {
  heroTitle: TextStyle;
  heroSubtitle: TextStyle;
  quickTitle: TextStyle;
  quickSubtitle: TextStyle;
  normalSubtitle: TextStyle;
  titleDisabled: TextStyle;
  subtitleMuted: TextStyle;
  quickHeroCard: ViewStyle;
  normalHeroCard: ViewStyle;
  normalHeroCardEnabled: ViewStyle;
  proxyHeroCard: ViewStyle;
  trustedHeroCard: ViewStyle;
  heroCardDisabledShell: ViewStyle;
  modeBadgePillQuick: ViewStyle;
  modeBadgePillNormal: ViewStyle;
  modeBadgeTextQuick: TextStyle;
  modeBadgeTextNormal: TextStyle;
  soonPill: ViewStyle;
  soonPillText: TextStyle;
  driverPanelCtaPill: ViewStyle;
  driverPanelCtaPillText: TextStyle;
};

const PRIMARY_CARDS: CardDef[] = [
  {
    id: 'quick',
    title: 'Hemen Eşleş',
    subtitle: 'Yakındaki uygun sürücüler sırayla denenir.',
    badge: 'OTOMATİK',
    badgeTone: 'quick',
    enabled: false,
    tier: 'primary',
  },
  {
    id: 'normal',
    title: 'Normal Eşleşme',
    subtitle: 'Rotanı seç, teklifini gönder.',
    badge: 'TEKLİF PAZARI',
    badgeTone: 'normal',
    enabled: true,
    tier: 'primary',
  },
];

const SECONDARY_CARDS: CardDef[] = [
  {
    id: 'proxy',
    title: 'Yerime Al',
    subtitle: 'Yakınınız için güvenli aldırma',
    enabled: false,
    tier: 'primary',
  },
  {
    id: 'trusted',
    title: 'Sürücülerim',
    subtitle: 'Güvendiğiniz sürücüler',
    enabled: false,
    tier: 'secondary',
  },
];

/** UX-MATCHCARD-2A — Yerime Al placeholder; definition kept, UI hidden until feature ships. */
const RENDER_PROXY_MATCH_CARD = false;

const stylesDark = StyleSheet.create({
  quickHeroCard: {
    borderTopColor: 'rgba(34, 211, 238, 0.42)',
    borderLeftColor: 'rgba(34, 211, 238, 0.2)',
    borderColor: 'rgba(34, 211, 238, 0.3)',
    backgroundColor: 'rgba(34, 211, 238, 0.04)',
    ...Platform.select({
      ios: {
        shadowColor: PREMIUM_AUTH_CYAN,
        shadowOffset: { width: 0, height: LDS_SPACING.xxs },
        shadowOpacity: 0.38,
        shadowRadius: LDS_SPACING.sm,
      },
      android: { elevation: 6 },
    }),
  },
  normalHeroCard: {
    borderTopColor: LDS_BORDER_COLOR.cardTopCyan,
    borderLeftColor: LDS_BORDER_COLOR.cardLeftCyan,
    borderColor: LDS_BORDER_COLOR.card,
    backgroundColor: 'rgba(4, 10, 20, 0.28)',
    ...Platform.select({
      ios: {
        shadowColor: PREMIUM_NAVY_DEEP,
        shadowOffset: { width: 0, height: LDS_SPACING.xxs },
        shadowOpacity: 0.28,
        shadowRadius: LDS_SPACING.sm,
      },
      android: { elevation: 6 },
    }),
  },
  proxyHeroCard: {
    borderTopColor: 'rgba(251, 191, 36, 0.32)',
    borderLeftColor: 'rgba(251, 191, 36, 0.16)',
    borderColor: 'rgba(251, 191, 36, 0.24)',
    backgroundColor: 'rgba(251, 191, 36, 0.04)',
  },
  trustedHeroCard: {
    borderTopColor: 'rgba(129, 140, 248, 0.34)',
    borderLeftColor: 'rgba(129, 140, 248, 0.16)',
    borderColor: 'rgba(129, 140, 248, 0.24)',
    backgroundColor: 'rgba(79, 70, 229, 0.05)',
    ...Platform.select({
      ios: {
        shadowColor: PREMIUM_NAVY_DEEP,
        shadowOffset: { width: 0, height: LDS_SPACING.xxs },
        shadowOpacity: 0.22,
        shadowRadius: LDS_SPACING.sm,
      },
      android: { elevation: 4 },
    }),
  },
  heroCardDisabledShell: {
    opacity: 0.58,
    borderColor: PREMIUM_BORDER_SLATE,
    shadowOpacity: 0,
    elevation: 0,
  },
  modeBadgePillQuick: {
    backgroundColor: 'rgba(34, 211, 238, 0.12)',
    borderColor: 'rgba(34, 211, 238, 0.32)',
  },
  modeBadgePillNormal: {
    backgroundColor: 'rgba(30, 58, 95, 0.55)',
    borderColor: PREMIUM_BORDER_SLATE,
  },
  modeBadgeTextQuick: {
    color: 'rgba(186, 230, 253, 0.96)',
  },
  modeBadgeTextNormal: {
    color: 'rgba(148, 163, 184, 0.92)',
  },
  soonPill: {
    backgroundColor: 'rgba(30, 58, 95, 0.55)',
    borderColor: PREMIUM_BORDER_SLATE,
  },
  soonPillText: {
    color: 'rgba(148, 163, 184, 0.92)',
  },
  driverPanelCtaPill: {
    backgroundColor: 'rgba(79, 70, 229, 0.14)',
    borderColor: 'rgba(129, 140, 248, 0.38)',
  },
  driverPanelCtaPillText: {
    color: 'rgba(196, 181, 253, 0.96)',
  },
});

function buildLightMatchCardTheme(tokens: LhThemeTokens): MatchCardTheme {
  return {
    heroTitle: { color: tokens.text.primary },
    heroSubtitle: { color: tokens.text.muted },
    quickTitle: { color: tokens.text.primary, textShadowColor: 'transparent' },
    quickSubtitle: { color: tokens.text.muted, fontWeight: '600' },
    normalSubtitle: { color: tokens.text.muted, fontWeight: '500' },
    titleDisabled: { color: tokens.text.muted },
    subtitleMuted: { color: tokens.text.muted },
    quickHeroCard: {
      borderTopColor: tokens.accent.glowMid,
      borderLeftColor: tokens.accent.glowLow,
      borderColor: tokens.border.default,
      backgroundColor: tokens.accent.glowLow,
      shadowColor: tokens.shadow.ambient,
    },
    normalHeroCard: {
      borderTopColor: tokens.borderColors.cardTopCyan,
      borderLeftColor: tokens.borderColors.cardLeftCyan,
      borderColor: tokens.borderColors.card,
      backgroundColor: tokens.selectionCard.cardBackground,
      shadowColor: tokens.shadow.ambient,
    },
    normalHeroCardEnabled: {
      borderWidth: 2,
      borderColor: tokens.borderColors.selected,
      borderTopColor: tokens.borderColors.selectedTop,
      borderLeftColor: tokens.borderColors.cardLeftCyan,
      backgroundColor: tokens.selectionCard.cardSelectedBackground,
    },
    proxyHeroCard: {
      borderTopColor: 'rgba(251, 191, 36, 0.38)',
      borderLeftColor: 'rgba(251, 191, 36, 0.18)',
      borderColor: 'rgba(217, 119, 6, 0.22)',
      backgroundColor: 'rgba(251, 191, 36, 0.08)',
    },
    trustedHeroCard: {
      borderTopColor: 'rgba(129, 140, 248, 0.38)',
      borderLeftColor: 'rgba(129, 140, 248, 0.16)',
      borderColor: 'rgba(99, 102, 241, 0.22)',
      backgroundColor: 'rgba(99, 102, 241, 0.06)',
      shadowColor: tokens.shadow.ambient,
    },
    heroCardDisabledShell: {
      opacity: 1,
      borderColor: tokens.border.default,
      backgroundColor: tokens.bg.glassMuted,
      shadowOpacity: 0,
      elevation: 0,
    },
    modeBadgePillQuick: {
      backgroundColor: tokens.accent.glowLow,
      borderColor: tokens.accent.glowMid,
    },
    modeBadgePillNormal: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: tokens.border.default,
    },
    modeBadgeTextQuick: { color: tokens.accent.primary, fontWeight: '800' },
    modeBadgeTextNormal: { color: tokens.text.muted, fontWeight: '800' },
    soonPill: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: tokens.border.default,
    },
    soonPillText: { color: tokens.text.muted, fontWeight: '800' },
    driverPanelCtaPill: {
      backgroundColor: 'rgba(99, 102, 241, 0.10)',
      borderColor: 'rgba(99, 102, 241, 0.28)',
    },
    driverPanelCtaPillText: { color: tokens.accent.primary, fontWeight: '800' },
  };
}

const DARK_MATCH_CARD_THEME: MatchCardTheme = {
  heroTitle: { color: PREMIUM_TEXT_SOFT },
  heroSubtitle: { color: 'rgba(148, 168, 196, 0.72)' },
  quickTitle: {
    color: PREMIUM_TEXT_SOFT,
    textShadowColor: 'rgba(34, 211, 238, 0.28)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: LDS_SPACING.xs,
  },
  quickSubtitle: { color: 'rgba(148, 196, 220, 0.82)', fontWeight: '600' },
  normalSubtitle: { color: 'rgba(148, 168, 196, 0.78)', fontWeight: '500' },
  titleDisabled: { color: PREMIUM_TEXT_MUTED },
  subtitleMuted: { color: PREMIUM_TEXT_MUTED },
  quickHeroCard: stylesDark.quickHeroCard,
  normalHeroCard: stylesDark.normalHeroCard,
  normalHeroCardEnabled: {},
  proxyHeroCard: stylesDark.proxyHeroCard,
  trustedHeroCard: stylesDark.trustedHeroCard,
  heroCardDisabledShell: stylesDark.heroCardDisabledShell,
  modeBadgePillQuick: stylesDark.modeBadgePillQuick,
  modeBadgePillNormal: stylesDark.modeBadgePillNormal,
  modeBadgeTextQuick: stylesDark.modeBadgeTextQuick,
  modeBadgeTextNormal: stylesDark.modeBadgeTextNormal,
  soonPill: stylesDark.soonPill,
  soonPillText: stylesDark.soonPillText,
  driverPanelCtaPill: stylesDark.driverPanelCtaPill,
  driverPanelCtaPillText: stylesDark.driverPanelCtaPillText,
};

function PassengerMatchModeCards({
  onNormalPress,
  onQuickPress,
  onTrustedPress,
  onDriverPanelPress,
  hasDriverRegistration = false,
  trustedPassengerCount = null,
}: PassengerMatchModeCardsProps) {
  const { height: winH, width: winW } = useWindowDimensions();
  const { status, summary } = useTrustedSummary();
  const { isScopeLight, tokens } = usePassengerTheme();
  const trustedWired = typeof onTrustedPress === 'function';
  const driverPanelWired = typeof onDriverPanelPress === 'function';
  const quickWired = typeof onQuickPress === 'function';

  const cardTheme = useMemo(
    () => (isScopeLight ? buildLightMatchCardTheme(tokens) : DARK_MATCH_CARD_THEME),
    [isScopeLight, tokens],
  );

  const visibleSecondaryCards = useMemo(
    () => SECONDARY_CARDS.filter((card) => RENDER_PROXY_MATCH_CARD || card.id !== 'proxy'),
    [],
  );

  const soloSecondaryRow = visibleSecondaryCards.length === 1;

  const layout = useMemo(() => {
    const usableHeight = Math.max(0, winH - 120);
    const isCompact = usableHeight < 720 || winW < 380;
    const isVeryCompact = usableHeight < 650 || winW < 360;
    const soloDeck = visibleSecondaryCards.length === 1;
    const coeff = soloDeck
      ? isVeryCompact
        ? 0.245
        : isCompact
          ? 0.252
          : 0.258
      : isVeryCompact
        ? 0.26
        : isCompact
          ? 0.265
          : 0.275;
    const primaryCardMinHeight = Math.round(
      Math.max(148, Math.min(188, usableHeight * coeff)),
    );
    const primaryHeroHeight = computeRoleCardHeroHeight(
      primaryCardMinHeight,
      isVeryCompact,
      isCompact && !isVeryCompact,
    );
    const titleSize = isVeryCompact ? 15 : isCompact ? 16 : 17;
    const subtitleSize = isVeryCompact ? 10 : 11;
    return {
      isCompact,
      isVeryCompact,
      primaryCardMinHeight,
      primaryHeroHeight,
      titleSize,
      subtitleSize,
    };
  }, [winH, winW, visibleSecondaryCards.length]);

  const renderModeBadge = (
    label: string,
    tone: CardBadgeTone,
    isVeryCompact: boolean,
  ) => (
    <View
      style={[
        styles.modeBadgePill,
        tone === 'quick' ? cardTheme.modeBadgePillQuick : cardTheme.modeBadgePillNormal,
        isVeryCompact && styles.modeBadgePillVeryCompact,
      ]}
    >
      <PremiumText
        variant="step"
        style={[
          styles.modeBadgeText,
          tone === 'quick' ? cardTheme.modeBadgeTextQuick : cardTheme.modeBadgeTextNormal,
          isVeryCompact && styles.modeBadgeTextVeryCompact,
        ]}
        numberOfLines={1}
      >
        {label}
      </PremiumText>
    </View>
  );

  const renderSoonPill = () => (
    <View style={[styles.soonPill, cardTheme.soonPill]}>
      <PremiumText variant="step" style={[styles.soonPillText, cardTheme.soonPillText]}>
        Yakında
      </PremiumText>
    </View>
  );

  const renderDriverPanelCtaPill = (isVeryCompact: boolean) => (
    <View
      style={[
        styles.driverPanelCtaPill,
        cardTheme.driverPanelCtaPill,
        isVeryCompact && styles.driverPanelCtaPillVeryCompact,
      ]}
    >
      <PremiumText
        variant="step"
        style={[
          styles.driverPanelCtaPillText,
          cardTheme.driverPanelCtaPillText,
          isVeryCompact && styles.driverPanelCtaPillTextVeryCompact,
        ]}
        numberOfLines={2}
      >
        Sürücü Paneline Git
      </PremiumText>
    </View>
  );

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
      isQuick ? cardTheme.quickHeroCard : cardTheme.normalHeroCard,
      isNormal && isEnabled ? cardTheme.normalHeroCardEnabled : null,
      !isEnabled && cardTheme.heroCardDisabledShell,
    ];

    const titleStyle = [
      LDS_TYPOGRAPHY.title,
      styles.heroTitle,
      cardTheme.heroTitle,
      { fontSize: layout.titleSize },
      isQuick && isEnabled && cardTheme.quickTitle,
      !isEnabled && cardTheme.titleDisabled,
    ];

    const subtitleStyle = [
      LDS_TYPOGRAPHY.caption,
      styles.heroSubtitle,
      cardTheme.heroSubtitle,
      { fontSize: layout.subtitleSize, lineHeight: layout.subtitleSize + 4 },
      isQuick && isEnabled && cardTheme.quickSubtitle,
      isNormal && isEnabled && cardTheme.normalSubtitle,
    ];

    const cardAccessory = showSoonPill
      ? renderSoonPill()
      : isEnabled && card.badge && card.badgeTone
        ? renderModeBadge(card.badge, card.badgeTone, layout.isVeryCompact)
        : undefined;

    const heroCard = (
      <PremiumSelectionCard
        selected={false}
        onPress={onPress ?? (() => {})}
        heroHeight={layout.primaryHeroHeight}
        compactCopy={layout.isCompact}
        subtitleNumberOfLines={2}
        style={cardShellStyle}
        illustration={
          <View style={!isEnabled && isScopeLight ? styles.disabledHeroIllustration : undefined}>
            {isQuick ? (
              <QuickMatchHero
                stageHeight={layout.primaryHeroHeight}
                active={isEnabled}
                isVeryCompact={layout.isVeryCompact}
              />
            ) : (
              <NormalMatchOfferHero
                stageHeight={layout.primaryHeroHeight}
                active={isEnabled}
                isVeryCompact={layout.isVeryCompact}
              />
            )}
          </View>
        }
        title={card.title}
        subtitle={showSoonPill ? ' ' : card.subtitle}
        titleStyle={titleStyle}
        subtitleStyle={subtitleStyle}
        checkmark={cardAccessory}
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

  const renderSecondaryHero = (card: CardDef) => {
    const isProxy = card.id === 'proxy';
    const isTrusted = card.id === 'trusted';
    const cellStyle = [styles.heroCell, soloSecondaryRow && styles.heroCellSoloCentered];
    const isDriverViewer = isTrusted && hasDriverRegistration;
    const isEnabled = isProxy
      ? false
      : isDriverViewer
        ? driverPanelWired || trustedWired
        : card.enabled || (isTrusted && trustedWired);
    const trustedReady = isTrusted && status === 'ready' && summary != null;
    const trustedSubtitle =
      !isDriverViewer && trustedReady && summary
        ? formatPassengerTrustedCardSubtitle(summary)
        : null;
    const showSoonPill =
      isProxy || (isTrusted && !isDriverViewer && !trustedWired && !trustedReady);

    const displayTitle = isDriverViewer ? 'Yolcularım' : card.title;
    const passengerPeerCount =
      trustedPassengerCount != null && Number.isFinite(trustedPassengerCount)
        ? Math.max(0, Math.floor(trustedPassengerCount))
        : null;
    const driverViewerSubtitle =
      passengerPeerCount != null && passengerPeerCount > 0
        ? `${passengerPeerCount} güvenilir yolcu · Sürücü panelinden yönetin`
        : 'Güvenilir yolcu ağınız · Sürücü paneline geçin';

    const displaySubtitle = showSoonPill
      ? null
      : isDriverViewer
        ? driverViewerSubtitle
        : trustedSubtitle
          ? trustedSubtitle
          : isTrusted && trustedWired
            ? card.subtitle
            : card.subtitle;

    const cardAccessory = showSoonPill
      ? renderSoonPill()
      : isDriverViewer && isEnabled
        ? renderDriverPanelCtaPill(layout.isVeryCompact)
        : undefined;

    const driverPanelHandler = isDriverViewer && driverPanelWired ? onDriverPanelPress : undefined;
    const onPress =
      driverPanelHandler ??
      (isTrusted && trustedWired ? onTrustedPress : undefined);

    const accessibilityLabel = isDriverViewer
      ? `${displayTitle}. ${driverViewerSubtitle}. Sürücü paneline git`
      : `${displayTitle}. ${displaySubtitle ?? card.subtitle}`;

    const cardShellStyle = [
      styles.heroCardShell,
      { minHeight: layout.primaryCardMinHeight, maxHeight: layout.primaryCardMinHeight + 16 },
      isProxy ? cardTheme.proxyHeroCard : cardTheme.trustedHeroCard,
      !isEnabled && cardTheme.heroCardDisabledShell,
    ];

    const titleStyle = [
      LDS_TYPOGRAPHY.title,
      styles.heroTitle,
      cardTheme.heroTitle,
      { fontSize: layout.titleSize },
      !isEnabled && cardTheme.titleDisabled,
    ];

    const subtitleStyle = [
      LDS_TYPOGRAPHY.caption,
      styles.heroSubtitle,
      cardTheme.heroSubtitle,
      { fontSize: layout.subtitleSize, lineHeight: layout.subtitleSize + 4 },
      isEnabled && !isProxy && cardTheme.normalSubtitle,
      !isEnabled && cardTheme.subtitleMuted,
    ];

    const secondaryCard = (
      <PremiumSelectionCard
        selected={false}
        onPress={onPress ?? (() => {})}
        heroHeight={layout.primaryHeroHeight}
        compactCopy={layout.isCompact}
        subtitleNumberOfLines={2}
        style={cardShellStyle}
        illustration={
          <View style={!isEnabled && isScopeLight ? styles.disabledHeroIllustration : undefined}>
            {isProxy ? (
              <ProxyPickupHero
                stageHeight={layout.primaryHeroHeight}
                active={false}
                isVeryCompact={layout.isVeryCompact}
              />
            ) : (
              <TrustedNetworkHero
                stageHeight={layout.primaryHeroHeight}
                active={isEnabled}
                isVeryCompact={layout.isVeryCompact}
              />
            )}
          </View>
        }
        title={displayTitle}
        subtitle={showSoonPill ? ' ' : displaySubtitle ?? card.subtitle}
        titleStyle={titleStyle}
        subtitleStyle={subtitleStyle}
        checkmark={cardAccessory}
      />
    );

    if (!isEnabled) {
      return (
        <Pressable
          key={card.id}
          disabled
          accessibilityRole="button"
          accessibilityState={{ disabled: true }}
          accessibilityLabel={isDriverViewer ? accessibilityLabel : `${card.title}. Yakında`}
          style={cellStyle}
        >
          <View pointerEvents="none">{secondaryCard}</View>
        </Pressable>
      );
    }

    return (
      <View key={card.id} style={cellStyle} accessibilityLabel={accessibilityLabel}>
        {secondaryCard}
      </View>
    );
  };

  return (
    <View style={styles.matchDeck} accessibilityRole="list">
      <View style={styles.heroRow}>
        {PRIMARY_CARDS.map(renderPrimaryHero)}
      </View>
      <View style={[styles.heroRow, soloSecondaryRow && styles.heroRowSolo]}>
        {visibleSecondaryCards.map(renderSecondaryHero)}
      </View>
    </View>
  );
}

export default memo(PassengerMatchModeCards);

/** Role select kokpit kartları ile aynı optik genişlik — yatay merkez hizası */
const MATCH_DECK_MAX_WIDTH = 440;
/** UX-QA-2D — solo Sürücülerim/Yolcularım kartı (proxy gizli) */
const SOLO_SECONDARY_CARD_WIDTH_RATIO = 0.68;

const styles = StyleSheet.create({
  matchDeck: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: MATCH_DECK_MAX_WIDTH,
    gap: LDS_SPACING.sm,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'center',
    width: '100%',
    gap: LDS_SPACING.sm,
  },
  heroRowSolo: {
    justifyContent: 'center',
  },
  heroCell: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    alignSelf: 'stretch',
  },
  heroCellSoloCentered: {
    flex: 0,
    flexGrow: 0,
    flexShrink: 0,
    width: `${Math.round(SOLO_SECONDARY_CARD_WIDTH_RATIO * 100)}%`,
    maxWidth: Math.round(MATCH_DECK_MAX_WIDTH * SOLO_SECONDARY_CARD_WIDTH_RATIO),
    minWidth: 252,
    alignSelf: 'center',
  },
  heroCardShell: {
    flex: 1,
    width: '100%',
    alignSelf: 'stretch',
  },
  heroTitle: {
    textAlign: 'center',
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  heroSubtitle: {
    textAlign: 'center',
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  modeBadgePill: {
    alignSelf: 'flex-end',
    maxWidth: 108,
    paddingHorizontal: LDS_SPACING.xs,
    paddingVertical: LDS_SPACING.xxs - 1,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  modeBadgePillVeryCompact: {
    maxWidth: 96,
    paddingHorizontal: LDS_SPACING.xxs + 1,
  },
  modeBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.35,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  modeBadgeTextVeryCompact: {
    fontSize: 7,
    letterSpacing: 0.2,
  },
  soonPill: {
    alignSelf: 'center',
    paddingHorizontal: LDS_SPACING.sm,
    paddingVertical: LDS_SPACING.xxs - 1,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  soonPillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  driverPanelCtaPill: {
    alignSelf: 'center',
    maxWidth: 136,
    paddingHorizontal: LDS_SPACING.sm,
    paddingVertical: LDS_SPACING.xxs + 1,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  driverPanelCtaPillVeryCompact: {
    maxWidth: 120,
    paddingHorizontal: LDS_SPACING.xs,
  },
  driverPanelCtaPillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.15,
    textAlign: 'center',
    lineHeight: 13,
  },
  driverPanelCtaPillTextVeryCompact: {
    fontSize: 9,
    lineHeight: 12,
  },
  disabledHeroIllustration: {
    opacity: 0.55,
  },
});
