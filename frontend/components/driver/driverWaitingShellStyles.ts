import { Platform, StyleSheet } from 'react-native';
import {
  PREMIUM_NAVY_DEEP,
  PREMIUM_ROLE_CARD_BG,
  PREMIUM_TEXT_SOFT,
} from '../auth/premiumAuthStyles';
import { LDS_BORDER_COLOR, LDS_BORDER_WIDTH } from '../../design-system/tokens/border';
import { LDS_ELEVATION } from '../../design-system/tokens/elevation';
import { LDS_RADIUS } from '../../design-system/tokens/radius';
import { LDS_SPACING } from '../../design-system/tokens/spacing';

/**
 * Sürücü idle kokpit — üst operasyon şeridi (P-DRIVER-1 ground rhythm).
 * Yalnızca presentation; logic / child component API değişmez.
 */
export const driverWaitingShellStyles = StyleSheet.create({
  waitingRoot: {
    flex: 1,
    backgroundColor: PREMIUM_NAVY_DEEP,
  },
  cockpitSafe: {
    backgroundColor: PREMIUM_NAVY_DEEP,
  },
  /** Üst katman: header + trust + panel — ortak dikey ritim */
  cockpitUpperDeck: {
    paddingBottom: LDS_SPACING.xs,
  },
  cockpitHeaderPad: {
    paddingHorizontal: LDS_SPACING.sm,
    paddingTop: LDS_SPACING.xs,
    paddingBottom: LDS_SPACING.xs,
  },
  cockpitHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LDS_SPACING.xs,
    paddingVertical: LDS_SPACING.sm,
    paddingHorizontal: LDS_SPACING.sm,
    borderRadius: LDS_RADIUS.lg,
    backgroundColor: PREMIUM_ROLE_CARD_BG,
    borderWidth: LDS_BORDER_WIDTH.standard,
    borderColor: LDS_BORDER_COLOR.cockpitPanel,
    borderTopColor: LDS_BORDER_COLOR.cockpitPanelTop,
    borderLeftColor: LDS_BORDER_COLOR.cockpitPanelLeft,
    ...LDS_ELEVATION.panel,
  },
  cockpitHeaderBtn: {
    minWidth: LDS_SPACING.xxl + LDS_SPACING.sm,
    minHeight: LDS_SPACING.xl + LDS_SPACING.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cockpitHeaderTitle: {
    flex: 1,
    flexShrink: 1,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '800',
    color: PREMIUM_TEXT_SOFT,
    letterSpacing: -0.15,
  },
  cockpitTrustPad: {
    paddingTop: LDS_SPACING.xxs,
    paddingBottom: LDS_SPACING.xxs,
  },
  cockpitPanelPad: {
    paddingHorizontal: LDS_SPACING.xxs,
    paddingTop: LDS_SPACING.xs,
    paddingBottom: LDS_SPACING.sm,
  },
  /** Alt saha katmanı — dispatch / harita; üst kokpit ile ince dikiş */
  cockpitOfferGround: {
    flex: 1,
    minHeight: 0,
    position: 'relative',
    backgroundColor: PREMIUM_NAVY_DEEP,
    borderTopWidth: LDS_BORDER_WIDTH.hairline,
    borderTopColor: LDS_BORDER_COLOR.cockpitPanel,
    paddingTop: LDS_SPACING.xxs,
    ...Platform.select({
      ios: {
        shadowColor: PREMIUM_NAVY_DEEP,
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
      },
      android: { elevation: 2 },
      default: {},
    }),
  },
});
