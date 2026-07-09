import { Platform, StyleSheet } from 'react-native';
import { PREMIUM_NAVY_DEEP } from '../auth/premiumAuthStyles';
import { LDS_BORDER_COLOR, LDS_BORDER_WIDTH } from '../../design-system/tokens/border';
import { LDS_RADIUS } from '../../design-system/tokens/radius';
import { LDS_SPACING } from '../../design-system/tokens/spacing';

/**
 * Sürücü idle kokpit — V2 shell stilleri (presentation-only).
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
  /** Üst katman: sade header + online hero + panel */
  cockpitUpperDeck: {
    paddingBottom: 0,
  },
  cockpitHeaderPad: {
    paddingHorizontal: LDS_SPACING.sm,
    paddingTop: LDS_SPACING.xxs,
    paddingBottom: LDS_SPACING.xxs,
  },
  cockpitHeaderGlass: {
    paddingVertical: LDS_SPACING.xxs + 2,
    paddingHorizontal: LDS_SPACING.sm,
    borderWidth: LDS_BORDER_WIDTH.hairline,
    borderColor: LDS_BORDER_COLOR.cockpitPanel,
  },
  cockpitHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LDS_SPACING.xs,
  },
  cockpitHeaderBtnShell: {
    width: 38,
    height: 38,
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
    gap: LDS_SPACING.xxs,
    flexShrink: 0,
  },
  cockpitHeaderTitleCol: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: LDS_SPACING.xxs,
  },
  cockpitHeaderBrand: {
    letterSpacing: -0.12,
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '700',
  },
  cockpitPanelPad: {
    paddingHorizontal: LDS_SPACING.sm,
    paddingTop: LDS_SPACING.xxs,
    paddingBottom: LDS_SPACING.xxs,
  },
  /** Alt saha — harita / teklif; üst deck’ten ince ayırıcı */
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
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.16,
        shadowRadius: 6,
      },
      android: { elevation: 1 },
      default: {},
    }),
  },
});
