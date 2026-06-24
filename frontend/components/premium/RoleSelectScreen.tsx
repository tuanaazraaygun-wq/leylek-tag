import React from 'react';
import {
  Animated,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AdminPanel from '../AdminPanel';
import { PremiumGradientCtaButton } from '../auth/premiumAuthChrome';
import { premiumAuthStyles as pap } from '../auth/premiumAuthStyles';
import { useRoleTheme } from '../../lib/theme/useRoleTheme';
import CarHero from '../../design-system/role-select/CarHero';
import MotorcycleHero from '../../design-system/role-select/MotorcycleHero';
import PassengerSeatHero from '../../design-system/role-select/PassengerSeatHero';
import DriverCockpitHero from '../../design-system/role-select/DriverCockpitHero';
import {
  CockpitBackground,
  GlassSurface,
  PremiumSelectionCard,
  PremiumText,
  computeRoleCardHeroHeight,
} from '../../design-system/primitives';
import { LDS_RADIUS } from '../../design-system/tokens/radius';
import { LDS_SPACING } from '../../design-system/tokens/spacing';

export type RoleSelectBreakpoints = {
  usableHeight: number;
  isCompact: boolean;
  isVeryCompact: boolean;
};

export type RoleSelectScreenProps = {
  styles: Record<string, unknown>;
  selectedRole: 'passenger' | 'driver' | null;
  rideVehicleKind: 'car' | 'motorcycle' | null;
  roleSelectTripExitBanner: string | null;
  isAdmin: boolean;
  showAdminPanel: boolean;
  adminPhone: string;
  rs: RoleSelectBreakpoints;
  roleSelectContentWide: boolean;
  roleScale: number;
  roleHorizontalPad: number;
  roleTopButtonSize: number;
  roleTopButtonRadius: number;
  roleTopPaddingV: number;
  roleTitleFontSize: number;
  roleTitleLineHeight: number;
  roleTitlePadV: number;
  roleTitlePadH: number;
  roleMainPadTop: number;
  roleMainPadBottom: number;
  roleStepMarginBottom: number;
  roleStepCircleSize: number;
  roleStepCircleMarginBottom: number;
  roleStepHelperMarginTop: number;
  roleCardsGap: number;
  roleCardsMarginBottom: number;
  roleCardPadV: number;
  roleCardMaxHeight: number;
  roleCardMinHeight: number;
  vehicleCardMinHeight: number;
  vehicleCardMaxHeight: number;
  vehicleHeroIconSize: number;
  roleIconCircleSize: number;
  roleIconMarginBottom: number;
  roleCardLabelFontSize: number;
  roleCardDescFontSize: number;
  roleCardSubtitleOneLineFont: number;
  roleCardSubtitleOneLineHeight: number;
  roleContinueMinHeight: number;
  roleContinuePadV: number;
  roleContinueTextSize: number;
  roleFooterBottomPad: number;
  roleActiveStep: number;
  roleStep1Done: boolean;
  roleStep2Done: boolean;
  roleStepPulseStyle: { transform: { scale: Animated.Value }[] };
  roleIllustrationSize: number;
  passengerIconSize: number;
  driverCarIconSize: number;
  driverBikeIconSize: number;
  roleCheckIconSize: number;
  vehicleChipIconSize: number;
  vehicleDeckBoost: number;
  vchPadV: number;
  vchPadH: number;
  vchBorderRadius: number;
  vchRowGap: number;
  vchIconSize: number;
  vchLabelFontSize: number;
  vchCallFontSize: number;
  showPassengerVehicleCall: boolean;
  vchLabelFontSizeDriver: number;
  continueArrowIconSize: number;
  cockpitTitleInnerRadius: number;
  roleSelectBannerShimmer: Animated.Value;
  roleCardPassengerOpacity: Animated.Value;
  roleCardPassengerTranslateX: Animated.Value;
  roleCardDriverOpacity: Animated.Value;
  roleCardDriverTranslateX: Animated.Value;
  vehicleCarOpacity: Animated.Value;
  vehicleCarScale: Animated.Value;
  vehicleMotoOpacity: Animated.Value;
  vehicleMotoScale: Animated.Value;
  roleSelectCardSubtitlePulse: Animated.Value;
  roleSelectUiPulse: Animated.Value;
  onSelectRole: (role: 'passenger' | 'driver') => void;
  onSelectVehicle: (kind: 'car' | 'motorcycle') => void;
  onChangeRole: () => void;
  /** Devam Et API beklerken CTA spinner (RC-P0-1B) */
  continueBusy?: boolean;
  onContinue: () => void;
  onLogoutPress: () => void;
  onSettingsPress: () => void;
  onAdminPress: () => void;
  onCloseAdminPanel: () => void;
};

export function RoleSelectScreen({
  styles: stylesProp,
  selectedRole,
  rideVehicleKind,
  roleSelectTripExitBanner,
  isAdmin,
  showAdminPanel,
  adminPhone,
  rs,
  roleSelectContentWide,
  roleScale,
  roleHorizontalPad,
  roleTopButtonSize,
  roleTopButtonRadius,
  roleTopPaddingV,
  roleTitleFontSize,
  roleTitleLineHeight,
  roleTitlePadV,
  roleTitlePadH,
  roleMainPadTop,
  roleMainPadBottom,
  roleStepMarginBottom,
  roleStepCircleSize,
  roleStepCircleMarginBottom,
  roleStepHelperMarginTop,
  roleCardsGap,
  roleCardsMarginBottom,
  roleCardPadV,
  roleCardMaxHeight,
  roleCardMinHeight,
  vehicleCardMinHeight,
  vehicleCardMaxHeight,
  vehicleHeroIconSize,
  roleIconCircleSize,
  roleIconMarginBottom,
  roleCardLabelFontSize,
  roleCardDescFontSize,
  roleCardSubtitleOneLineFont,
  roleCardSubtitleOneLineHeight,
  roleContinueMinHeight,
  roleContinuePadV,
  roleContinueTextSize,
  roleFooterBottomPad,
  roleActiveStep,
  roleStep1Done,
  roleStep2Done,
  roleStepPulseStyle,
  roleCheckIconSize,
  showPassengerVehicleCall,
  continueArrowIconSize,
  cockpitTitleInnerRadius,
  roleSelectBannerShimmer,
  roleCardPassengerOpacity,
  roleCardPassengerTranslateX,
  roleCardDriverOpacity,
  roleCardDriverTranslateX,
  vehicleCarOpacity,
  vehicleCarScale,
  vehicleMotoOpacity,
  vehicleMotoScale,
  roleSelectCardSubtitlePulse,
  onSelectRole,
  onSelectVehicle,
  onChangeRole,
  continueBusy = false,
  onContinue,
  onLogoutPress,
  onSettingsPress,
  onAdminPress,
  onCloseAdminPanel,
}: RoleSelectScreenProps) {
  const styles = stylesProp as Record<string, object>;
  const { lightSurfaces: roleLt, roleInput: roleIn } = useRoleTheme();
  const titleGradient = roleLt?.cockpitTitleGradient ?? [
    'rgba(34,211,238,0.12)',
    'rgba(8,17,31,0)',
    'rgba(34,211,238,0.07)',
  ] as const;

  const tripExitBannerNewline = roleSelectTripExitBanner?.indexOf('\n') ?? -1;
  const tripExitBannerTitle =
    roleSelectTripExitBanner == null
      ? null
      : tripExitBannerNewline >= 0
        ? roleSelectTripExitBanner.slice(0, tripExitBannerNewline)
        : roleSelectTripExitBanner;
  const tripExitBannerBody =
    roleSelectTripExitBanner != null && tripExitBannerNewline >= 0
      ? roleSelectTripExitBanner.slice(tripExitBannerNewline + 1)
      : null;

  const roleCardHeroHeight = computeRoleCardHeroHeight(
    roleCardMinHeight,
    rs.isVeryCompact,
    rs.isCompact && !rs.isVeryCompact,
  );
  const vehicleCardHeroHeight = computeRoleCardHeroHeight(
    vehicleCardMinHeight,
    rs.isVeryCompact,
    rs.isCompact && !rs.isVeryCompact,
  );

  const renderVehicleBlueprintHero = (
    kind: 'car' | 'motorcycle',
    selected: boolean,
  ) => {
    const heroProps = {
      stageHeight: vehicleCardHeroHeight,
      active: selected,
      isVeryCompact: rs.isVeryCompact,
    };

    return kind === 'car' ? <CarHero {...heroProps} /> : <MotorcycleHero {...heroProps} />;
  };

  return (
    <View style={styles.roleSelectionContainer}>
      <CockpitBackground />
        <SafeAreaView style={styles.roleSelectionSafe}>
          {roleSelectTripExitBanner ? (
            <Animated.View
              style={[styles.roleSelectBannerWrap, { opacity: roleSelectBannerShimmer }]}
              pointerEvents="none"
            >
              <GlassSurface
                variant="plain"
                borderRadius={LDS_RADIUS.sm}
                style={[styles.roleSelectBannerInner, roleLt?.roleSelectBannerInner]}
              >
                <PremiumText
                  variant="body"
                  style={[styles.roleSelectBannerText, roleLt?.roleSelectBannerText, { textAlign: 'center' }]}
                >
                  {tripExitBannerTitle}
                </PremiumText>
                {tripExitBannerBody ? (
                  <PremiumText
                    variant="caption"
                    muted
                    style={{ textAlign: 'center', marginTop: LDS_SPACING.xxs }}
                  >
                    {tripExitBannerBody}
                  </PremiumText>
                ) : null}
              </GlassSurface>
            </Animated.View>
          ) : null}
          {/* Üst Bar */}
          <View
            style={[
              styles.roleTopBarCompact,
              { paddingHorizontal: roleHorizontalPad, paddingVertical: roleTopPaddingV },
            ]}
          >
            <TouchableOpacity 
              style={[
                styles.roleExitBtn,
                roleLt?.roleExitBtn,
                { width: roleTopButtonSize, height: roleTopButtonSize, borderRadius: roleTopButtonRadius },
              ]}
              onPress={onLogoutPress}
            >
              <Ionicons name="log-out-outline" size={22} color="#EF4444" />
            </TouchableOpacity>
            
            <View style={styles.roleTopTitleWrap}>
              <View
                style={[
                  styles.roleCockpitFrame,
                  roleLt?.roleCockpitFrame,
                  { borderRadius: cockpitTitleInnerRadius + 4 },
                ]}
              >
                <View
                  style={[
                    styles.roleCockpitInner,
                    roleLt?.roleCockpitInner,
                    {
                      paddingVertical: roleTitlePadV,
                      paddingHorizontal: roleTitlePadH,
                      borderRadius: cockpitTitleInnerRadius,
                    },
                  ]}
                >
                  <LinearGradient
                    colors={[...titleGradient]}
                    locations={[0, 0.52, 1]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    pointerEvents="none"
                    style={StyleSheet.absoluteFillObject}
                  />
                  <Text
                    style={[
                      styles.roleTopTitle,
                      roleLt?.roleTopTitle,
                      rs.isCompact && !rs.isVeryCompact && styles.roleTopTitleCompact,
                      rs.isVeryCompact && styles.roleTopTitleVery,
                      { fontSize: roleTitleFontSize, lineHeight: roleTitleLineHeight },
                    ]}
                    numberOfLines={2}
                    ellipsizeMode="tail"
                  >
                    Bugün <Text style={[styles.roleTopTitleAccent, roleLt?.roleTopTitleAccent]}>nasıl</Text> ilerlemek istersiniz?
                  </Text>
                </View>
              </View>
            </View>
            
            {isAdmin ? (
              <TouchableOpacity
                style={[
                  styles.roleAdminBtn,
                  roleLt?.roleAdminBtn,
                  { width: roleTopButtonSize, height: roleTopButtonSize, borderRadius: roleTopButtonRadius },
                ]}
                onPress={onAdminPress}
              >
                <Ionicons name="settings-outline" size={22} color={roleIn.accent} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[
                  styles.roleAdminBtn,
                  roleLt?.roleAdminBtn,
                  { width: roleTopButtonSize, height: roleTopButtonSize, borderRadius: roleTopButtonRadius },
                ]}
                onPress={onSettingsPress}
              >
                <Ionicons name="person-circle-outline" size={22} color={roleIn.accent} />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView
            style={styles.roleSelectScroll}
            contentContainerStyle={[
              styles.roleSelectScrollContent,
              rs.isVeryCompact && styles.roleSelectScrollContentVery,
              rs.isCompact && !rs.isVeryCompact && styles.roleSelectScrollContentCompact,
              styles.roleSelectScrollContentSteps,
              rs.isVeryCompact && styles.roleSelectScrollContentVeryFooter,
              { paddingBottom: Math.round(Math.max(10, Math.min(20, rs.usableHeight * 0.02))) },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
          >
            <View
              style={[
                styles.roleMainContent,
                styles.roleMainContentInScroll,
                rs.isVeryCompact && styles.roleMainContentVery,
                rs.isCompact && !rs.isVeryCompact && styles.roleMainContentCompact,
                roleSelectContentWide && styles.roleMainContentMaxWidth,
                {
                  paddingHorizontal: roleHorizontalPad,
                  paddingTop: roleMainPadTop,
                  paddingBottom: roleMainPadBottom,
                },
              ]}
            >
            <GlassSurface
              variant="panel"
              style={[
                styles.roleUnifiedCockpitShell,
                roleLt?.roleUnifiedCockpitShell,
                rs.isVeryCompact && styles.roleUnifiedCockpitShellVery,
              ]}
            >
              <View style={[styles.roleStepIndicatorGlass, { marginBottom: roleStepMarginBottom }]}>
              <View
                style={[
                  styles.roleStepIndicatorWrap,
                  rs.isVeryCompact && styles.roleStepIndicatorWrapVery,
                  rs.isCompact && !rs.isVeryCompact && styles.roleStepIndicatorWrapCompact,
                  { marginBottom: 0 },
                ]}
              >
                <View style={styles.roleStepIndicatorRow}>
                  <View style={styles.roleStepSegment}>
                    <Animated.View
                      style={[
                        styles.roleStepCircle,
                        roleLt?.roleStepCircle,
                        {
                          width: roleStepCircleSize,
                          height: roleStepCircleSize,
                          borderRadius: roleStepCircleSize / 2,
                          marginBottom: roleStepCircleMarginBottom,
                        },
                        roleActiveStep === 1 && styles.roleStepCircleActive,
                        roleActiveStep === 1 && roleLt?.roleStepCircleActive,
                        roleActiveStep === 1 && styles.roleStepCircleActiveRole,
                        roleActiveStep === 1 && roleStepPulseStyle,
                        roleStep1Done && roleActiveStep !== 1 && styles.roleStepCircleDone,
                        roleStep1Done && roleActiveStep !== 1 && roleLt?.roleStepCircleDone,
                      ]}
                    >
                      {roleStep1Done ? (
                        <Ionicons name="checkmark" size={rs.isVeryCompact ? 14 : 16} color={roleLt ? roleIn.accent : roleIn.textPrimary} />
                      ) : (
                        <Text style={[styles.roleStepCircleText, roleLt?.roleStepCircleText, roleActiveStep === 1 && styles.roleStepCircleTextActive, roleActiveStep === 1 && roleLt?.roleStepCircleTextActive]}>1</Text>
                      )}
                    </Animated.View>
                    <Text
                      style={[
                        styles.roleStepLabel,
                        roleLt?.roleStepLabel,
                        rs.isVeryCompact && styles.roleStepLabelVery,
                        roleActiveStep === 1 && styles.roleStepLabelActive,
                        roleActiveStep === 1 && roleLt?.roleStepLabelActive,
                        roleActiveStep === 1 && !roleLt && styles.roleStepLabelActiveRole,
                        roleStep1Done && styles.roleStepLabelDone,
                        roleStep1Done && roleLt?.roleStepLabelDone,
                      ]}
                      numberOfLines={2}
                    >
                      Rolünü seç
                    </Text>
                  </View>
                  <View style={[styles.roleStepDash, roleLt?.roleStepDash, rs.isVeryCompact && styles.roleStepDashVery]} />
                  <View style={styles.roleStepSegment}>
                    <Animated.View
                      style={[
                        styles.roleStepCircle,
                        roleLt?.roleStepCircle,
                        {
                          width: roleStepCircleSize,
                          height: roleStepCircleSize,
                          borderRadius: roleStepCircleSize / 2,
                          marginBottom: roleStepCircleMarginBottom,
                        },
                        roleActiveStep === 2 && styles.roleStepCircleActive,
                        roleActiveStep === 2 && roleLt?.roleStepCircleActive,
                        roleActiveStep === 2 && styles.roleStepCircleActiveVehicle,
                        roleActiveStep === 2 && roleStepPulseStyle,
                        roleStep2Done && roleActiveStep !== 2 && styles.roleStepCircleDone,
                        roleStep2Done && roleActiveStep !== 2 && roleLt?.roleStepCircleDone,
                        !roleStep1Done && styles.roleStepCircleMuted,
                        !roleStep1Done && roleLt?.roleStepCircleMuted,
                      ]}
                    >
                      {roleStep2Done ? (
                        <Ionicons name="checkmark" size={rs.isVeryCompact ? 14 : 16} color={roleLt ? roleIn.accent : roleIn.textPrimary} />
                      ) : (
                        <Text
                          style={[
                            styles.roleStepCircleText,
                            roleLt?.roleStepCircleText,
                            roleActiveStep === 2 && styles.roleStepCircleTextActive,
                            roleActiveStep === 2 && roleLt?.roleStepCircleTextActive,
                            !roleStep1Done && styles.roleStepCircleTextMuted,
                            !roleStep1Done && roleLt?.roleStepCircleTextMuted,
                          ]}
                        >
                          2
                        </Text>
                      )}
                    </Animated.View>
                    <Text
                      style={[
                        styles.roleStepLabel,
                        roleLt?.roleStepLabel,
                        rs.isVeryCompact && styles.roleStepLabelVery,
                        roleActiveStep === 2 && styles.roleStepLabelActive,
                        roleActiveStep === 2 && roleLt?.roleStepLabelActive,
                        roleActiveStep === 2 && !roleLt && styles.roleStepLabelActiveVehicle,
                        roleStep2Done && styles.roleStepLabelDone,
                        roleStep2Done && roleLt?.roleStepLabelDone,
                        !roleStep1Done && styles.roleStepLabelMuted,
                        !roleStep1Done && roleLt?.roleStepLabelMuted,
                      ]}
                      numberOfLines={2}
                    >
                      Araç tipini seç
                    </Text>
                  </View>
                  <View style={[styles.roleStepDash, roleLt?.roleStepDash, rs.isVeryCompact && styles.roleStepDashVery]} />
                  <View style={styles.roleStepSegment}>
                    <Animated.View
                      style={[
                        styles.roleStepCircle,
                        roleLt?.roleStepCircle,
                        {
                          width: roleStepCircleSize,
                          height: roleStepCircleSize,
                          borderRadius: roleStepCircleSize / 2,
                          marginBottom: roleStepCircleMarginBottom,
                        },
                        roleActiveStep === 3 && styles.roleStepCircleActive,
                        roleActiveStep === 3 && roleLt?.roleStepCircleActive,
                        roleActiveStep === 3 && styles.roleStepCircleActiveContinue,
                        roleActiveStep === 3 && roleStepPulseStyle,
                        !rideVehicleKind && styles.roleStepCircleMuted,
                        !rideVehicleKind && roleLt?.roleStepCircleMuted,
                      ]}
                    >
                      <Text
                        style={[
                          styles.roleStepCircleText,
                          roleLt?.roleStepCircleText,
                          roleActiveStep === 3 && styles.roleStepCircleTextActive,
                          roleActiveStep === 3 && roleLt?.roleStepCircleTextActive,
                          !rideVehicleKind && styles.roleStepCircleTextMuted,
                          !rideVehicleKind && roleLt?.roleStepCircleTextMuted,
                        ]}
                      >
                        3
                      </Text>
                    </Animated.View>
                    <Text
                      style={[
                        styles.roleStepLabel,
                        roleLt?.roleStepLabel,
                        rs.isVeryCompact && styles.roleStepLabelVery,
                        roleActiveStep === 3 && styles.roleStepLabelActive,
                        roleActiveStep === 3 && roleLt?.roleStepLabelActive,
                        roleActiveStep === 3 && !roleLt && styles.roleStepLabelActiveContinue,
                        !rideVehicleKind && roleActiveStep !== 3 && styles.roleStepLabelMuted,
                        !rideVehicleKind && roleActiveStep !== 3 && roleLt?.roleStepLabelMuted,
                      ]}
                      numberOfLines={2}
                    >
                      Devam Et
                    </Text>
                  </View>
                </View>
                <PremiumText
                  variant="caption"
                  muted
                  style={[
                    styles.roleStepHelper,
                    roleLt?.roleStepHelper,
                    rs.isVeryCompact && styles.roleStepHelperVery,
                    rs.isCompact && !rs.isVeryCompact && styles.roleStepHelperCompact,
                    { marginTop: roleStepHelperMarginTop },
                  ]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  Önce rolünü, sonra araç tipini seç.
                </PremiumText>
              </View>
              </View>

              <View style={styles.roleDeckSlot}>
                {!selectedRole ? (
                  <View
                    style={[
                      styles.roleCardsRow,
                      rs.isVeryCompact && styles.roleCardsRowVery,
                      rs.isCompact && !rs.isVeryCompact && styles.roleCardsRowCompact,
                      roleSelectContentWide && styles.roleCardsRowWide,
                      { gap: roleCardsGap, marginBottom: roleCardsMarginBottom },
                    ]}
                  >
                    <Animated.View
                      style={[
                        styles.roleCardAnimatedWrap,
                        {
                          opacity: roleCardPassengerOpacity,
                          transform: [{ translateX: roleCardPassengerTranslateX }],
                        },
                      ]}
                    >
                      <PremiumSelectionCard
                        selected={selectedRole === 'passenger'}
                        onPress={() => onSelectRole('passenger')}
                        heroHeight={roleCardHeroHeight}
                        compactCopy={rs.isVeryCompact || rs.isCompact}
                        style={[
                          styles.roleCardCompact,
                          roleLt?.roleCardCompact,
                          rs.isVeryCompact && styles.roleCardCompactVery,
                          rs.isCompact && !rs.isVeryCompact && styles.roleCardCompactTight,
                          {
                            maxHeight: roleCardMaxHeight,
                            minHeight: roleCardMinHeight,
                          },
                        ]}
                        illustration={
                          <PassengerSeatHero
                            stageHeight={roleCardHeroHeight}
                            active={selectedRole === 'passenger'}
                            isVeryCompact={rs.isVeryCompact}
                          />
                        }
                        title="Yolcu"
                        subtitle="Sürücülere teklif gönder"
                        titleStyle={[
                          styles.roleCardLabel,
                          roleLt?.roleCardLabel,
                          { fontSize: roleCardLabelFontSize },
                          selectedRole === 'passenger' && styles.roleCardLabelActive,
                          selectedRole === 'passenger' && roleLt?.roleCardLabelActive,
                        ]}
                        subtitleStyle={[
                          styles.roleCardDesc,
                          roleLt?.roleCardDesc,
                          rs.isVeryCompact && styles.roleCardDescVery,
                          selectedRole === 'passenger' && styles.roleCardDescActivePassenger,
                          selectedRole === 'passenger' && roleLt?.roleCardDescActivePassenger,
                          {
                            fontSize: roleCardSubtitleOneLineFont,
                            lineHeight: roleCardSubtitleOneLineHeight,
                          },
                        ]}
                        checkmark={
                          selectedRole === 'passenger' ? (
                            <View style={[styles.roleCheckBadge, roleLt?.roleCheckBadge, rs.isVeryCompact && styles.roleCheckBadgeVery]}>
                              <Ionicons name="checkmark-circle" size={roleCheckIconSize} color={roleLt ? roleIn.accent : roleIn.textPrimary} />
                            </View>
                          ) : undefined
                        }
                      />
                    </Animated.View>

                    <Animated.View
                      style={[
                        styles.roleCardAnimatedWrap,
                        {
                          opacity: roleCardDriverOpacity,
                          transform: [{ translateX: roleCardDriverTranslateX }],
                        },
                      ]}
                    >
                      <PremiumSelectionCard
                        selected={selectedRole === 'driver'}
                        onPress={() => onSelectRole('driver')}
                        heroHeight={roleCardHeroHeight}
                        compactCopy={rs.isVeryCompact || rs.isCompact}
                        style={[
                          styles.roleCardCompact,
                          roleLt?.roleCardCompact,
                          rs.isVeryCompact && styles.roleCardCompactVery,
                          rs.isCompact && !rs.isVeryCompact && styles.roleCardCompactTight,
                          {
                            maxHeight: roleCardMaxHeight,
                            minHeight: roleCardMinHeight,
                          },
                        ]}
                        illustration={
                          <DriverCockpitHero
                            stageHeight={roleCardHeroHeight}
                            active={selectedRole === 'driver'}
                            isVeryCompact={rs.isVeryCompact}
                          />
                        }
                        title="Sürücü"
                        subtitle="Yolculardan teklif al"
                        titleStyle={[
                          styles.roleCardLabel,
                          roleLt?.roleCardLabel,
                          { fontSize: roleCardLabelFontSize },
                          selectedRole === 'driver' && styles.roleCardLabelActive,
                          selectedRole === 'driver' && roleLt?.roleCardLabelActive,
                        ]}
                        subtitleStyle={[
                          styles.roleCardDesc,
                          roleLt?.roleCardDesc,
                          rs.isVeryCompact && styles.roleCardDescVery,
                          selectedRole === 'driver' && styles.roleCardDescActiveDriver,
                          selectedRole === 'driver' && roleLt?.roleCardDescActiveDriver,
                          {
                            fontSize: roleCardSubtitleOneLineFont,
                            lineHeight: roleCardSubtitleOneLineHeight,
                          },
                        ]}
                        checkmark={
                          selectedRole === 'driver' ? (
                            <View style={[styles.roleCheckBadge, roleLt?.roleCheckBadge, rs.isVeryCompact && styles.roleCheckBadgeVery]}>
                              <Ionicons name="checkmark-circle" size={roleCheckIconSize} color={roleLt ? roleIn.accent : roleIn.textPrimary} />
                            </View>
                          ) : undefined
                        }
                      />
                    </Animated.View>
                  </View>
                ) : (
                  <View style={styles.roleDeckVehicleStack}>
                    <View
                      style={[
                        styles.roleCardsRow,
                        styles.roleVehicleCardsRow,
                        rs.isVeryCompact && styles.roleCardsRowVery,
                        rs.isCompact && !rs.isVeryCompact && styles.roleCardsRowCompact,
                        roleSelectContentWide && styles.roleCardsRowWide,
                        {
                          gap: roleCardsGap,
                          marginBottom: Math.round(Math.max(8, roleCardsMarginBottom * 0.55)),
                        },
                      ]}
                    >
                      <Animated.View
                        style={[
                          styles.roleCardAnimatedWrap,
                          {
                            opacity: vehicleCarOpacity,
                            transform: [{ scale: vehicleCarScale }],
                          },
                        ]}
                      >
                        <PremiumSelectionCard
                          selected={rideVehicleKind === 'car'}
                          onPress={() => onSelectVehicle('car')}
                          heroHeight={vehicleCardHeroHeight}
                          compactCopy={rs.isVeryCompact || rs.isCompact}
                          style={[
                            styles.roleCardCompact,
                            roleLt?.roleCardCompact,
                            rs.isVeryCompact && styles.roleCardCompactVery,
                            rs.isCompact && !rs.isVeryCompact && styles.roleCardCompactTight,
                            {
                              maxHeight: vehicleCardMaxHeight,
                              minHeight: vehicleCardMinHeight,
                            },
                          ]}
                          illustration={renderVehicleBlueprintHero('car', rideVehicleKind === 'car')}
                          title="Araba"
                          subtitle={showPassengerVehicleCall ? 'Eşleşmesi' : 'Yolculuk modu'}
                          titleStyle={[
                            styles.roleCardLabel,
                            roleLt?.roleCardLabel,
                            { fontSize: roleCardLabelFontSize },
                            rideVehicleKind === 'car' && styles.roleCardLabelActive,
                            rideVehicleKind === 'car' && roleLt?.roleCardLabelActive,
                          ]}
                          subtitleStyle={[
                            styles.roleCardDesc,
                            roleLt?.roleCardDesc,
                            rs.isVeryCompact && styles.roleCardDescVery,
                            rideVehicleKind === 'car' && styles.roleCardDescActivePassenger,
                            rideVehicleKind === 'car' && roleLt?.roleCardDescActivePassenger,
                            {
                              fontSize: roleCardSubtitleOneLineFont,
                              lineHeight: roleCardSubtitleOneLineHeight,
                            },
                          ]}
                          checkmark={
                            rideVehicleKind === 'car' ? (
                              <View style={[styles.roleCheckBadge, roleLt?.roleCheckBadge, rs.isVeryCompact && styles.roleCheckBadgeVery]}>
                                <Ionicons name="checkmark-circle" size={roleCheckIconSize} color={roleLt ? roleIn.accent : roleIn.textPrimary} />
                              </View>
                            ) : undefined
                          }
                        />
                      </Animated.View>
                      <Animated.View
                        style={[
                          styles.roleCardAnimatedWrap,
                          {
                            opacity: vehicleMotoOpacity,
                            transform: [{ scale: vehicleMotoScale }],
                          },
                        ]}
                      >
                        <PremiumSelectionCard
                          selected={rideVehicleKind === 'motorcycle'}
                          onPress={() => onSelectVehicle('motorcycle')}
                          heroHeight={vehicleCardHeroHeight}
                          compactCopy={rs.isVeryCompact || rs.isCompact}
                          style={[
                            styles.roleCardCompact,
                            roleLt?.roleCardCompact,
                            rs.isVeryCompact && styles.roleCardCompactVery,
                            rs.isCompact && !rs.isVeryCompact && styles.roleCardCompactTight,
                            {
                              maxHeight: vehicleCardMaxHeight,
                              minHeight: vehicleCardMinHeight,
                            },
                          ]}
                          illustration={renderVehicleBlueprintHero('motorcycle', rideVehicleKind === 'motorcycle')}
                          title="Motor"
                          subtitle={showPassengerVehicleCall ? 'Eşleşmesi' : 'Yolculuk modu'}
                          titleStyle={[
                            styles.roleCardLabel,
                            roleLt?.roleCardLabel,
                            { fontSize: roleCardLabelFontSize },
                            rideVehicleKind === 'motorcycle' && styles.roleCardLabelActive,
                            rideVehicleKind === 'motorcycle' && roleLt?.roleCardLabelActive,
                          ]}
                          subtitleStyle={[
                            styles.roleCardDesc,
                            roleLt?.roleCardDesc,
                            rs.isVeryCompact && styles.roleCardDescVery,
                            rideVehicleKind === 'motorcycle' && styles.roleCardDescActivePassenger,
                            rideVehicleKind === 'motorcycle' && roleLt?.roleCardDescActivePassenger,
                            {
                              fontSize: roleCardSubtitleOneLineFont,
                              lineHeight: roleCardSubtitleOneLineHeight,
                            },
                          ]}
                          checkmark={
                            rideVehicleKind === 'motorcycle' ? (
                              <View style={[styles.roleCheckBadge, roleLt?.roleCheckBadge, rs.isVeryCompact && styles.roleCheckBadgeVery]}>
                                <Ionicons name="checkmark-circle" size={roleCheckIconSize} color={roleLt ? roleIn.accent : roleIn.textPrimary} />
                              </View>
                            ) : undefined
                          }
                        />
                      </Animated.View>
                    </View>
                    <View
                      style={[
                        styles.roleStatusStripCompact,
                        roleLt?.roleStatusStripCompact,
                        rs.isVeryCompact && styles.roleStatusStripCompactVery,
                        rs.isCompact && !rs.isVeryCompact && styles.roleStatusStripCompactTight,
                      ]}
                    >
                      <View
                        style={[
                          styles.roleStatusPill,
                          styles.roleStatusPillCompact,
                          roleLt?.roleStatusPill,
                          roleLt?.roleStatusPillCompact,
                          rs.isVeryCompact && styles.roleStatusPillCompactVery,
                        ]}
                      >
                        <Ionicons
                          name="checkmark-circle"
                          size={rs.isVeryCompact ? 16 : rs.isCompact ? 17 : 18}
                          color={roleIn.accent}
                        />
                        <Text
                          style={[
                            styles.roleStatusTitleCompactInline,
                            roleLt?.roleStatusTitleCompactInline,
                            rs.isVeryCompact && styles.roleStatusTitleCompactInlineVery,
                          ]}
                          numberOfLines={1}
                        >
                          {selectedRole === 'passenger' ? 'Yolcu' : 'Sürücü'}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={[
                          styles.roleChangeRolePillSecondary,
                          roleLt?.roleChangeRolePillSecondary,
                          styles.roleChangeRolePillSecondaryCompact,
                          rs.isVeryCompact && styles.roleChangeRolePillSecondaryVery,
                        ]}
                        onPress={onChangeRole}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        activeOpacity={0.75}
                      >
                        <Text style={[styles.roleChangeRoleLabelSecondary, roleLt?.roleChangeRoleLabelSecondary]}>Rolü değiştir</Text>
                        <Ionicons
                          name="chevron-forward"
                          size={rs.isVeryCompact ? 13 : 14}
                          color={roleLt?.iconChevron ?? 'rgba(148,189,218,0.85)'}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
              </GlassSurface>
            </View>
          </ScrollView>

          <View
            style={[
              styles.roleBottomFooterColumn,
              rs.isVeryCompact && styles.roleBottomFooterColumnVery,
              rs.isCompact && !rs.isVeryCompact && styles.roleBottomFooterColumnCompact,
              roleSelectContentWide && styles.roleBottomFooterColumnWide,
              {
                paddingHorizontal: roleHorizontalPad,
                paddingTop: Math.round(Math.max(8, Math.min(14, rs.usableHeight * 0.012))),
                paddingBottom: roleFooterBottomPad,
              },
            ]}
          >
            <PremiumGradientCtaButton
              label="Devam Et"
              disabled={!selectedRole || !rideVehicleKind}
              busy={continueBusy}
              onPress={onContinue}
              accessibilityLabel="Devam et"
              touchableStyleOverrides={
                roleLt
                  ? ((!selectedRole || !rideVehicleKind
                      ? roleLt.ctaTouchableDisabled
                      : roleLt.ctaTouchableEnabled) as Record<string, unknown>)
                  : ((!selectedRole || !rideVehicleKind
                      ? pap.roleFloatAmbientLow
                      : pap.roleCtaCyanHalo) as Record<string, unknown>)
              }
              labelStyle={{
                fontSize: roleContinueTextSize,
                letterSpacing: 0.42,
                fontWeight: '900',
                textShadowColor: roleLt?.ctaTextShadow ?? 'rgba(2,10,26,0.55)',
                textShadowOffset: roleLt ? { width: 0, height: 0 } : { width: 0, height: 1 },
                textShadowRadius: roleLt ? 0 : 3,
              }}
              gradientStyleOverrides={{
                minHeight: roleContinueMinHeight,
                paddingVertical: roleContinuePadV,
                paddingHorizontal: roleHorizontalPad + 6,
                borderRadius: Math.round(Math.max(21, Math.min(27, roleContinueMinHeight * 0.42))),
                gap: Math.round(Math.max(8, Math.min(14, 14 * roleScale))),
                borderWidth: StyleSheet.hairlineWidth + 1,
                borderColor: roleLt?.ctaBorder ?? 'rgba(34,211,238,0.28)',
                ...(!selectedRole || !rideVehicleKind
                  ? roleLt?.ctaBodyDisabled
                  : roleLt?.ctaBodyEnabled),
              }}
              trailing={
                <Ionicons name="arrow-forward-circle" size={continueArrowIconSize} color={roleIn.textPrimary} />
              }
            />
          </View>
        </SafeAreaView>
        
        {/* Admin Panel Modal */}
        {isAdmin && (
          <Modal
            visible={showAdminPanel}
            animationType="slide"
            presentationStyle="fullScreen"
            onRequestClose={onCloseAdminPanel}
          >
            <AdminPanel 
              adminPhone={adminPhone} 
              onClose={onCloseAdminPanel} 
            />
          </Modal>
        )}
      </View>
    );
}
