import { Platform, StyleSheet } from 'react-native';

/** Birincil vurgu — web ile aynı; glow için ayrı düşük opaklık kullanılır */
export const PREMIUM_AUTH_CYAN = '#22D3EE';

/** Site / güvenlik sayfası premium paleti — auth + rol ön yüzü */
export const PREMIUM_NAVY_DEEP = '#08111F';
export const PREMIUM_NAVY_MID = '#0B1220';
export const PREMIUM_NAVY_CARD = '#101A2B';
export const PREMIUM_GLASS_FILL = 'rgba(16,26,43,0.76)';
export const PREMIUM_BORDER_SLATE = '#1E3A5F';
export const PREMIUM_TEXT_SOFT = 'rgba(243,248,255,0.94)';
export const PREMIUM_TEXT_MUTED = 'rgba(186,201,222,0.9)';

/** Login / auth shell — illüstrasyon üstü */
export const PREMIUM_SHELL_OVERLAY = [
  'rgba(8,17,31,0.93)',
  'rgba(11,18,32,0.90)',
  'rgba(16,26,43,0.86)',
] as const;
export const PREMIUM_SHELL_VIGNETTE_TOP = ['rgba(8,17,31,0.52)', 'transparent'] as const;

/** Rol seçim — sinematik overlay (illustration görünür kalır); locations [0,0.5,1] ile üst/orta/alt */
export const PREMIUM_ROLE_OVERLAY = [
  'rgba(8,17,31,0.84)',
  'rgba(11,18,32,0.68)',
  'rgba(8,17,31,0.88)',
] as const;

/** Rol ekranı kart / yüzey — spec glass + okunabilirlik */
export const PREMIUM_ROLE_CARD_BG = 'rgba(16,26,43,0.87)';
export const PREMIUM_ROLE_CARD_BORDER = 'rgba(30,58,95,0.97)';
/** Adım strip — daha koyu kokpit camı */
export const PREMIUM_ROLE_PANEL_GLASS = 'rgba(8,14,26,0.94)';
/** Üst kokpit başlık içi */
export const PREMIUM_ROLE_COCKPIT_FILL = 'rgba(8,13,24,0.97)';

/** CTA: login ile aynı 3 duraklı gradient */
export const PREMIUM_AUTH_CTA_GRADIENT = ['#22D3EE', '#3B82F6', '#1D4ED8'] as const;
/** CTA disabled — düz slate yerine navy cam */
export const PREMIUM_AUTH_CTA_DISABLED_GRADIENT = [
  'rgba(22,36,56,0.98)',
  'rgba(16,26,43,1)',
  'rgba(8,17,31,1)',
] as const;

/** Rol yüzer panel — ambient gölge rengi (neon cyan yerine navy) */
export const PREMIUM_ROLE_AMBIENT_SHADOW = PREMIUM_NAVY_DEEP;
/** İnce üst cephe / kokpit cyan edge (~Mercedes contour) */
export const PREMIUM_ROLE_COCKPIT_CYAN_EDGE = 'rgba(34,211,238,0.22)';

/** Rol ekranı — foreground ambient (üstte hafif cyan sis, altta sinematik navy; illüstrasyon üstü) */
export const PREMIUM_ROLE_FOREGROUND_AMBIENT = [
  'rgba(34,211,238,0.065)',
  'rgba(8,17,31,0.08)',
  'rgba(8,17,31,0.32)',
] as const;

/** Yatay köşe vignette — merkezi önde tutar */
export const PREMIUM_ROLE_FOREGROUND_SIDE_VIGNETTE = [
  'rgba(3,10,22,0.28)',
  'transparent',
  'rgba(3,10,22,0.26)',
] as const;

/** Sürücü teklif / bekleyiş — liste alanı foreground (illüstrasyon üstünde sis) */
export const PREMIUM_DRIVER_OFFER_LIST_AMBIENT = [
  'rgba(34,211,238,0.03)',
  'rgba(8,17,31,0.22)',
  'rgba(8,17,31,0.48)',
] as const;

export const premiumAuthStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PREMIUM_NAVY_DEEP },
  flexOne: { flex: 1 },
  bgImage: {
    ...StyleSheet.absoluteFillObject,
  },
  safe: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  column: { alignSelf: 'center', alignItems: 'stretch' },

  blurFrame: {
    borderRadius: 22,
    overflow: 'hidden',
    alignSelf: 'stretch',
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth + 1,
    borderColor: 'rgba(30, 58, 95, 0.72)',
    ...Platform.select({
      ios: {
        shadowColor: PREMIUM_AUTH_CYAN,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 22,
      },
      web: {
        shadowColor: PREMIUM_AUTH_CYAN,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 18,
      },
      default: {},
    }),
  },
  blurTint: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: PREMIUM_GLASS_FILL,
  },
  androidGlass: {
    borderRadius: 22,
    alignSelf: 'stretch',
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth + 1,
    borderColor: 'rgba(30, 58, 95, 0.75)',
    backgroundColor: PREMIUM_GLASS_FILL,
    elevation: 8,
    ...Platform.select({
      android: {
        shadowColor: PREMIUM_NAVY_MID,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 16,
      },
      default: {},
    }),
  },

  phoneLabel: {
    alignSelf: 'stretch',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.35,
    color: PREMIUM_TEXT_SOFT,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  otpHint: {
    alignSelf: 'stretch',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
    color: PREMIUM_TEXT_MUTED,
    marginBottom: 12,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  /** Telefon girişi */
  inputShell: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: 'rgba(12, 22, 38, 0.82)',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth + 1.25,
    borderColor: 'rgba(30, 58, 95, 0.95)',
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: PREMIUM_NAVY_CARD,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.45,
        shadowRadius: 6,
      },
      android: {},
      default: {},
    }),
  },
  /** OTP: odak güçlendirici */
  inputShellFocused: {
    borderWidth: StyleSheet.hairlineWidth + 2,
    borderColor: 'rgba(34, 211, 238, 0.5)',
    ...Platform.select({
      ios: {
        shadowColor: PREMIUM_AUTH_CYAN,
        shadowOpacity: 0.12,
        shadowRadius: 12,
      },
      android: { elevation: 12 },
      default: {},
    }),
  },
  inputField: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: PREMIUM_TEXT_SOFT,
    letterSpacing: 0.35,
    minHeight: 40,
    paddingVertical: Platform.OS === 'android' ? 4 : 2,
  },
  otpInputField: {
    flex: 1,
    fontSize: Platform.OS === 'ios' ? 26 : 24,
    fontWeight: '800',
    color: PREMIUM_TEXT_SOFT,
    letterSpacing: Platform.OS === 'ios' ? 10 : 8,
    minHeight: 48,
    textAlign: 'center',
    paddingVertical: Platform.OS === 'android' ? 6 : 10,
    ...Platform.select({
      ios: {},
      android: { includeFontPadding: false },
    }),
  },

  kvkkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    alignSelf: 'stretch',
    marginBottom: 16,
    gap: 8,
  },
  checkboxOuter: {
    width: 19,
    height: 19,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: 'rgba(34, 211, 238, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
    backgroundColor: 'transparent',
  },
  checkboxFilled: {
    backgroundColor: PREMIUM_AUTH_CYAN,
    borderColor: PREMIUM_AUTH_CYAN,
  },
  kvkkBlock: { flex: 1, marginRight: 0 },
  kvkkPlain: {
    fontSize: 11,
    lineHeight: 16,
    color: PREMIUM_TEXT_MUTED,
    fontWeight: '500',
  },
  kvkkLink: {
    fontSize: 11,
    lineHeight: 16,
    color: 'rgba(94, 210, 230, 0.95)',
    fontWeight: '700',
    textDecorationLine: 'underline',
  },

  ctaShadow: {
    alignSelf: 'stretch',
    borderRadius: 16,
    ...Platform.select({
      ios: {
        shadowColor: PREMIUM_AUTH_CYAN,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.16,
        shadowRadius: 16,
      },
      android: { elevation: 8 },
      default: {},
    }),
  },
  ctaShadowDisabled: {
    ...Platform.select({
      ios: { shadowOpacity: 0.07, shadowColor: '#000' },
      android: { elevation: 2 },
      default: {},
    }),
  },
  ctaGradient: {
    alignSelf: 'stretch',
    borderRadius: 16,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  /** PremiumGradientCtaButton — disabled görünüm çerçevesi */
  ctaGradientDisabledFrame: {
    borderWidth: StyleSheet.hairlineWidth + 1,
    borderColor: 'rgba(30, 58, 95, 0.5)',
    opacity: 0.94,
  },
  ctaText: {
    color: PREMIUM_TEXT_SOFT,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1.35,
    textAlign: 'center',
    ...Platform.select({
      android: {
        includeFontPadding: false,
        textAlignVertical: 'center' as const,
      },
      default: {},
    }),
  },

  veyaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    marginVertical: 12,
    gap: 10,
    opacity: 0.92,
  },
  veyaLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(148,163,184,0.45)',
  },
  veyaLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(148,163,184,0.95)',
    letterSpacing: 0.35,
    textTransform: 'lowercase',
  },

  outlineGlass: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 16,
    backgroundColor: 'rgba(16,26,43,0.45)',
    borderWidth: StyleSheet.hairlineWidth + 1,
    borderColor: 'rgba(30, 58, 95, 0.85)',
    marginBottom: 4,
  },
  outlineLabel: {
    color: PREMIUM_TEXT_SOFT,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  forgotWrap: {
    alignSelf: 'center',
    marginTop: 10,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  forgotText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(148,163,184,0.95)',
    textDecorationLine: 'underline',
    textDecorationColor: 'rgba(148,163,184,0.55)',
  },
  /** OTP “Geri Dön” minimal */
  otpBackMinimal: {
    alignSelf: 'center',
    marginTop: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    opacity: 0.58,
  },
  otpBackText: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(226,232,240,0.78)',
    letterSpacing: 0.25,
    textAlign: 'center',
    textDecorationLine: 'underline',
    textDecorationColor: 'rgba(148,163,184,0.35)',
  },

  outlineGlassWide: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 16,
    marginBottom: 12,
    backgroundColor: 'rgba(16,26,43,0.42)',
    borderWidth: StyleSheet.hairlineWidth + 1,
    borderColor: 'rgba(30, 58, 95, 0.82)',
    ...Platform.select({
      ios: {
        shadowColor: PREMIUM_NAVY_CARD,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
      },
      default: {},
    }),
  },
  supportLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: PREMIUM_TEXT_SOFT,
    letterSpacing: 0.4,
  },

  trustRow: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 4,
    gap: 2,
  },
  trustDivider: {
    width: StyleSheet.hairlineWidth + 1,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(148,163,184,0.22)',
    marginHorizontal: 2,
    minHeight: 56,
    marginTop: 4,
    opacity: 0.95,
  },
  trustCol: {
    flex: 1,
    alignItems: 'center',
    minWidth: 0,
    paddingHorizontal: 2,
    gap: 4,
  },
  trustTitle: {
    marginTop: 2,
    fontSize: 9.8,
    fontWeight: '900',
    letterSpacing: 0.58,
    color: PREMIUM_TEXT_SOFT,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  trustSub: {
    fontSize: 9,
    fontWeight: '600',
    color: 'rgba(148,163,184,0.95)',
    textAlign: 'center',
    lineHeight: 13,
    marginTop: -1,
    paddingHorizontal: 2,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(8, 17, 31, 0.72)',
    justifyContent: 'center',
    padding: 22,
    paddingHorizontal: 20,
  },
  modalPanelBlur: {
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(30, 58, 95, 0.65)',
    overflow: 'hidden',
    backgroundColor: PREMIUM_GLASS_FILL,
    maxHeight: '86%',
    ...Platform.select({
      ios: {
        shadowColor: PREMIUM_NAVY_DEEP,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 20,
      },
      default: {},
    }),
  },
  modalPanelDark: {
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(30, 58, 95, 0.7)',
    backgroundColor: 'rgba(11,18,32,0.96)',
    maxHeight: '86%',
    elevation: 12,
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: PREMIUM_TEXT_SOFT,
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  modalBody: {
    fontSize: 14,
    color: PREMIUM_TEXT_MUTED,
    lineHeight: 20,
    marginBottom: 12,
    textAlign: 'center',
  },
  modalCompany: {
    fontSize: 12,
    color: 'rgba(148,163,184,0.95)',
    marginBottom: 10,
    textAlign: 'center',
  },
  modalLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    gap: 8,
    flexWrap: 'wrap',
  },
  modalLinkText: {
    color: 'rgba(94, 210, 230, 0.96)',
    fontSize: 14,
    fontWeight: '700',
    textDecorationLine: 'underline',
    textAlign: 'center',
    flexShrink: 1,
  },
  modalLegalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    marginTop: 6,
    marginBottom: 4,
    flexWrap: 'wrap',
    gap: 8,
  },
  modalLegalLink: {
    color: 'rgba(94, 210, 230, 0.94)',
    fontWeight: '700',
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  modalCloseGap: { marginTop: 4 },

  genderRowPremium: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    gap: 10,
    marginBottom: 14,
  },
  genderChipPremium: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: Platform.OS === 'ios' ? 11 : 9,
    borderRadius: 14,
    backgroundColor: 'rgba(16,26,43,0.5)',
    borderWidth: StyleSheet.hairlineWidth + 1.35,
    borderColor: 'rgba(30, 58, 95, 0.9)',
    minHeight: 48,
    ...Platform.select({
      ios: {
        shadowColor: PREMIUM_NAVY_DEEP,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
      },
      default: {},
    }),
  },
  genderChipPremiumActive: {
    backgroundColor: 'rgba(34, 211, 238, 0.12)',
    borderColor: 'rgba(34, 211, 238, 0.45)',
    ...Platform.select({
      ios: {
        shadowColor: PREMIUM_AUTH_CYAN,
        shadowOpacity: 0.14,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 0 },
      },
      default: {},
    }),
  },
  genderChipLabelPremium: {
    fontSize: 14,
    fontWeight: '800',
    color: 'rgba(94, 200, 220, 0.92)',
    letterSpacing: 0.15,
  },
  genderChipLabelPremiumActive: {
    color: PREMIUM_TEXT_SOFT,
  },

  cityPickRowPremium: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: 10,
    backgroundColor: 'rgba(16,26,43,0.68)',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth + 1.25,
    borderColor: 'rgba(30, 58, 95, 0.95)',
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    marginBottom: 14,
    ...Platform.select({
      ios: {
        shadowColor: PREMIUM_NAVY_MID,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      default: {},
    }),
  },
  cityPickIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(34,211,238,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth + 1,
    borderColor: 'rgba(30, 58, 95, 0.7)',
  },
  cityPickTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  cityPickHint: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.45,
    textTransform: 'uppercase',
    color: 'rgba(148,163,184,0.95)',
  },
  cityPickValue: {
    fontSize: 15,
    fontWeight: '800',
    color: PREMIUM_TEXT_SOFT,
    letterSpacing: 0.1,
  },
  cityPickPlaceholder: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(148,163,184,0.78)',
    fontStyle: 'italic',
  },

  authPhonePlusPremium: {
    fontSize: 15,
    fontWeight: '800',
    color: PREMIUM_AUTH_CYAN,
    marginRight: 8,
  },

  hintBelowInput: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(148,163,184,0.92)',
    marginTop: -6,
    marginBottom: 14,
    lineHeight: 15,
    paddingHorizontal: 2,
  },

  pinWarningPremium: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    alignSelf: 'stretch',
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 12,
    marginBottom: 14,
    backgroundColor: 'rgba(251,191,36,0.09)',
    borderWidth: StyleSheet.hairlineWidth + 1,
    borderColor: 'rgba(251,191,36,0.35)',
  },
  pinWarningTextPremium: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
    color: 'rgba(254,240,138,0.95)',
  },

  authBottomSheetBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(8, 17, 31, 0.74)',
  },
  authCitySheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth + 1,
    borderColor: 'rgba(30, 58, 95, 0.62)',
    backgroundColor: 'rgba(11,18,32,0.97)',
    maxHeight: '88%',
    paddingBottom: Platform.OS === 'ios' ? 18 : 12,
    ...Platform.select({
      android: { elevation: 16 },
      default: {},
    }),
  },
  authSheetGrab: {
    alignSelf: 'center',
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(148,163,184,0.35)',
    marginTop: 10,
    marginBottom: 8,
  },
  authSheetTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: PREMIUM_TEXT_SOFT,
    textAlign: 'center',
    marginBottom: 4,
    paddingHorizontal: 16,
    letterSpacing: 0.2,
  },
  authSheetSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(148,163,184,0.95)',
    textAlign: 'center',
    marginBottom: 10,
    paddingHorizontal: 20,
    lineHeight: 17,
  },
  authCitySearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 14,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth + 1,
    borderColor: 'rgba(30, 58, 95, 0.75)',
    backgroundColor: 'rgba(16,26,43,0.72)',
    gap: 8,
  },
  authCitySearchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: PREMIUM_TEXT_SOFT,
    paddingVertical: 0,
  },
  authCityFlat: {
    maxHeight: 320,
    paddingHorizontal: 6,
    marginHorizontal: 8,
    marginBottom: 8,
  },
  authCityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginBottom: 6,
    backgroundColor: 'rgba(148,163,184,0.06)',
    borderWidth: StyleSheet.hairlineWidth + 1,
    borderColor: 'rgba(148,163,184,0.12)',
  },
  authCityItemSelected: {
    borderColor: 'rgba(34, 211, 238, 0.42)',
    backgroundColor: 'rgba(34,211,238,0.08)',
  },
  authCityItemText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#E2E8F0',
  },
  authCityItemTextSelected: {
    color: PREMIUM_AUTH_CYAN,
  },
  authSheetCloseSoft: {
    alignSelf: 'center',
    marginTop: 2,
    marginBottom: Platform.OS === 'ios' ? 8 : 4,
    paddingVertical: 11,
    paddingHorizontal: 24,
    borderRadius: 14,
    backgroundColor: 'rgba(16,26,43,0.55)',
    borderWidth: StyleSheet.hairlineWidth + 1,
    borderColor: 'rgba(30, 58, 95, 0.72)',
    minWidth: 120,
  },
  authSheetCloseSoftText: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '800',
    color: PREMIUM_TEXT_SOFT,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  cityEmptyHintPremium: {
    textAlign: 'center',
    color: 'rgba(148,163,184,0.88)',
    fontSize: 13,
    fontWeight: '600',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },

  /** Rol ekranı — yüzer yüzeylerde navy ambient (spread ile kullan) */
  roleFloatAmbientStrong: Platform.select({
    ios: {
      shadowColor: PREMIUM_NAVY_DEEP,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.52,
      shadowRadius: 28,
    },
    android: { elevation: 13 },
    default: {},
  }),
  roleFloatAmbientMid: Platform.select({
    ios: {
      shadowColor: PREMIUM_NAVY_DEEP,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.4,
      shadowRadius: 18,
    },
    android: { elevation: 8 },
    default: {},
  }),
  roleFloatAmbientLow: Platform.select({
    ios: {
      shadowColor: PREMIUM_NAVY_DEEP,
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.32,
      shadowRadius: 12,
    },
    android: { elevation: 5 },
    default: {},
  }),
  roleFloatAmbientCta: Platform.select({
    ios: {
      shadowColor: PREMIUM_NAVY_DEEP,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.55,
      shadowRadius: 22,
    },
    android: { elevation: 13 },
    default: {},
  }),
  /** Rol “Devam Et” — kontrollü cyan halo (neon değil) */
  roleCtaCyanHalo: Platform.select({
    ios: {
      shadowColor: PREMIUM_AUTH_CYAN,
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.15,
      shadowRadius: 18,
    },
    android: { elevation: 13 },
    default: {},
  }),
});
