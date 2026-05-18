import { Platform, StyleSheet } from 'react-native';
import {
  PREMIUM_NAVY_DEEP,
  PREMIUM_ROLE_COCKPIT_CYAN_EDGE,
  PREMIUM_TEXT_SOFT,
} from '../auth/premiumAuthStyles';

/** Sürücü bekleyiş — üst kokpit şeridi (navigasyon / logic değişmeden görünüm). */
export const driverWaitingShellStyles = StyleSheet.create({
  waitingRoot: {
    flex: 1,
    backgroundColor: PREMIUM_NAVY_DEEP,
  },
  cockpitSafe: {
    backgroundColor: PREMIUM_NAVY_DEEP,
  },
  cockpitHeaderPad: {
    paddingHorizontal: 12,
    paddingTop: 2,
    paddingBottom: 4,
  },
  cockpitHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 17,
    backgroundColor: 'rgba(16,26,43,0.78)',
    borderWidth: StyleSheet.hairlineWidth + 1,
    borderColor: 'rgba(30,58,95,0.88)',
    borderTopColor: PREMIUM_ROLE_COCKPIT_CYAN_EDGE,
    ...Platform.select({
      ios: {
        shadowColor: '#01060e',
        shadowOffset: { width: 0, height: 14 },
        shadowOpacity: 0.42,
        shadowRadius: 24,
      },
      android: { elevation: 14 },
      default: {},
    }),
  },
  cockpitHeaderBtn: {
    minWidth: 44,
    minHeight: 40,
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
  cockpitPanelPad: {
    paddingHorizontal: 4,
    paddingTop: 6,
    paddingBottom: 8,
  },
});
