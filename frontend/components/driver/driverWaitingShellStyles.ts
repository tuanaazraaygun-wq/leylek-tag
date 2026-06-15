import { Platform, StyleSheet } from 'react-native';
import { PREMIUM_NAVY_DEEP } from '../auth/premiumAuthStyles';
import { LDS_BORDER_COLOR, LDS_BORDER_WIDTH } from '../../design-system/tokens/border';
import { LDS_RADIUS } from '../../design-system/tokens/radius';
import { LDS_SPACING } from '../../design-system/tokens/spacing';

/**
 * Sürücü idle kokpit — shell stilleri (P-DRIVER-1..3).
 * Yalnızca presentation; logic / child component API değişmez.
 */
export const driverWaitingShellStyles = StyleSheet.create({
  waitingRoot: {
    flex: 1,
    backgroundColor: PREMIUM_NAVY_DEEP,
    overflow: 'hidden',
  },
  cockpitSafe: {
    backgroundColor: 'transparent',
  },
  /** Üst katman: header + trust + panel — ortak dikey ritim */
  cockpitUpperDeck: {
    paddingBottom: LDS_SPACING.xs,
  },
  cockpitHeaderPad: {
    paddingHorizontal: LDS_SPACING.sm,
    paddingTop: LDS_SPACING.xs,
    paddingBottom: LDS_SPACING.xxs,
  },
  cockpitHeaderGlass: {
    paddingVertical: LDS_SPACING.sm,
    paddingHorizontal: LDS_SPACING.sm,
  },
  cockpitHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LDS_SPACING.sm,
  },
  cockpitHeaderBtnShell: {
    width: 40,
    height: 40,
    borderRadius: LDS_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(8,17,31,0.42)',
    borderWidth: LDS_BORDER_WIDTH.hairline,
    borderColor: LDS_BORDER_COLOR.cockpitPanel,
    flexShrink: 0,
  },
  cockpitHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LDS_SPACING.xs,
    flexShrink: 0,
  },
  cockpitHeaderTitleCol: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: LDS_SPACING.xxs,
    paddingHorizontal: LDS_SPACING.xxs,
  },
  cockpitHeaderBrand: {
    letterSpacing: -0.28,
    textAlign: 'center',
  },
  cockpitHeaderCaption: {
    letterSpacing: 0.15,
    textAlign: 'center',
    lineHeight: 15,
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
  /** Alt saha katmanı — dispatch / harita; üst kokpit ile ince dikiş; zemin CockpitBackground */
  cockpitOfferGround: {
    flex: 1,
    minHeight: 0,
    position: 'relative',
    backgroundColor: 'transparent',
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
