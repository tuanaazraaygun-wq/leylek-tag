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
import {
  PREMIUM_AUTH_CYAN,
  PREMIUM_TEXT_SOFT,
  premiumAuthStyles as pap,
} from '../auth/premiumAuthStyles';
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
  onContinue,
  onLogoutPress,
  onSettingsPress,
  onAdminPress,
  onCloseAdminPanel,
}: RoleSelectScreenProps) {
  const styles = stylesProp as Record<string, object>;

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
                style={styles.roleSelectBannerInner}
              >
                <PremiumText
                  variant="body"
                  style={[styles.roleSelectBannerText, { textAlign: 'center' }]}
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
                  { borderRadius: cockpitTitleInnerRadius + 4 },
                ]}
              >
                <View
                  style={[
                    styles.roleCockpitInner,
                    {
                      paddingVertical: roleTitlePadV,
                      paddingHorizontal: roleTitlePadH,
                      borderRadius: cockpitTitleInnerRadius,
                    },
                  ]}
                >
                  <LinearGradient
                    colors={[
                      'rgba(34,211,238,0.12)',
                      'rgba(8,17,31,0)',
                      'rgba(34,211,238,0.07)',
                    ]}
                    locations={[0, 0.52, 1]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    pointerEvents="none"
                    style={StyleSheet.absoluteFillObject}
                  />
                  <Text
                    style={[
                      styles.roleTopTitle,
                      rs.isCompact && !rs.isVeryCompact && styles.roleTopTitleCompact,
                      rs.isVeryCompact && styles.roleTopTitleVery,
                      { fontSize: roleTitleFontSize, lineHeight: roleTitleLineHeight },
                    ]}
                    numberOfLines={2}
                    ellipsizeMode="tail"
                  >
                    Bugün <Text style={styles.roleTopTitleAccent}>nasıl</Text> ilerlemek istersiniz?
                  </Text>
                </View>
              </View>
            </View>
            
            {isAdmin ? (
              <TouchableOpacity
                style={[
                  styles.roleAdminBtn,
                  { width: roleTopButtonSize, height: roleTopButtonSize, borderRadius: roleTopButtonRadius },
                ]}
                onPress={onAdminPress}
              >
                <Ionicons name="settings-outline" size={22} color={PREMIUM_AUTH_CYAN} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[
                  styles.roleAdminBtn,
                  { width: roleTopButtonSize, height: roleTopButtonSize, borderRadius: roleTopButtonRadius },
                ]}
                onPress={onSettingsPress}
              >
                <Ionicons name="person-circle-outline" size={22} color={PREMIUM_AUTH_CYAN} />
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
              style={[styles.roleUnifiedCockpitShell, rs.isVeryCompact && styles.roleUnifiedCockpitShellVery]}
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
                        {
                          width: roleStepCircleSize,
                          height: roleStepCircleSize,
                          borderRadius: roleStepCircleSize / 2,
                          marginBottom: roleStepCircleMarginBottom,
                        },
                        roleActiveStep === 1 && styles.roleStepCircleActive,
                        roleActiveStep === 1 && styles.roleStepCircleActiveRole,
                        roleActiveStep === 1 && roleStepPulseStyle,
                        roleStep1Done && roleActiveStep !== 1 && styles.roleStepCircleDone,
                      ]}
                    >
                      {roleStep1Done ? (
                        <Ionicons name="checkmark" size={rs.isVeryCompact ? 14 : 16} color={PREMIUM_TEXT_SOFT} />
                      ) : (
                        <Text style={[styles.roleStepCircleText, roleActiveStep === 1 && styles.roleStepCircleTextActive]}>1</Text>
                      )}
                    </Animated.View>
                    <Text
                      style={[
                        styles.roleStepLabel,
                        rs.isVeryCompact && styles.roleStepLabelVery,
                        roleActiveStep === 1 && styles.roleStepLabelActive,
                        roleActiveStep === 1 && styles.roleStepLabelActiveRole,
                        roleStep1Done && styles.roleStepLabelDone,
                      ]}
                      numberOfLines={2}
                    >
                      Rolünü seç
                    </Text>
                  </View>
                  <View style={[styles.roleStepDash, rs.isVeryCompact && styles.roleStepDashVery]} />
                  <View style={styles.roleStepSegment}>
                    <Animated.View
                      style={[
                        styles.roleStepCircle,
                        {
                          width: roleStepCircleSize,
                          height: roleStepCircleSize,
                          borderRadius: roleStepCircleSize / 2,
                          marginBottom: roleStepCircleMarginBottom,
                        },
                        roleActiveStep === 2 && styles.roleStepCircleActive,
                        roleActiveStep === 2 && styles.roleStepCircleActiveVehicle,
                        roleActiveStep === 2 && roleStepPulseStyle,
                        roleStep2Done && roleActiveStep !== 2 && styles.roleStepCircleDone,
                        !roleStep1Done && styles.roleStepCircleMuted,
                      ]}
                    >
                      {roleStep2Done ? (
                        <Ionicons name="checkmark" size={rs.isVeryCompact ? 14 : 16} color={PREMIUM_TEXT_SOFT} />
                      ) : (
                        <Text
                          style={[
                            styles.roleStepCircleText,
                            roleActiveStep === 2 && styles.roleStepCircleTextActive,
                            !roleStep1Done && styles.roleStepCircleTextMuted,
                          ]}
                        >
                          2
                        </Text>
                      )}
                    </Animated.View>
                    <Text
                      style={[
                        styles.roleStepLabel,
                        rs.isVeryCompact && styles.roleStepLabelVery,
                        roleActiveStep === 2 && styles.roleStepLabelActive,
                        roleActiveStep === 2 && styles.roleStepLabelActiveVehicle,
                        roleStep2Done && styles.roleStepLabelDone,
                        !roleStep1Done && styles.roleStepLabelMuted,
                      ]}
                      numberOfLines={2}
                    >
                      Araç tipini seç
                    </Text>
                  </View>
                  <View style={[styles.roleStepDash, rs.isVeryCompact && styles.roleStepDashVery]} />
                  <View style={styles.roleStepSegment}>
                    <Animated.View
                      style={[
                        styles.roleStepCircle,
                        {
                          width: roleStepCircleSize,
                          height: roleStepCircleSize,
                          borderRadius: roleStepCircleSize / 2,
                          marginBottom: roleStepCircleMarginBottom,
                        },
                        roleActiveStep === 3 && styles.roleStepCircleActive,
                        roleActiveStep === 3 && styles.roleStepCircleActiveContinue,
                        roleActiveStep === 3 && roleStepPulseStyle,
                        !rideVehicleKind && styles.roleStepCircleMuted,
                      ]}
                    >
                      <Text
                        style={[
                          styles.roleStepCircleText,
                          roleActiveStep === 3 && styles.roleStepCircleTextActive,
                          !rideVehicleKind && styles.roleStepCircleTextMuted,
                        ]}
                      >
                        3
                      </Text>
                    </Animated.View>
                    <Text
                      style={[
                        styles.roleStepLabel,
                        rs.isVeryCompact && styles.roleStepLabelVery,
                        roleActiveStep === 3 && styles.roleStepLabelActive,
                        roleActiveStep === 3 && styles.roleStepLabelActiveContinue,
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
                          { fontSize: roleCardLabelFontSize },
                          selectedRole === 'passenger' && styles.roleCardLabelActive,
                        ]}
                        subtitleStyle={[
                          styles.roleCardDesc,
                          rs.isVeryCompact && styles.roleCardDescVery,
                          selectedRole === 'passenger' && styles.roleCardDescActivePassenger,
                          {
                            fontSize: roleCardSubtitleOneLineFont,
                            lineHeight: roleCardSubtitleOneLineHeight,
                          },
                        ]}
                        checkmark={
                          selectedRole === 'passenger' ? (
                            <View style={[styles.roleCheckBadge, rs.isVeryCompact && styles.roleCheckBadgeVery]}>
                              <Ionicons name="checkmark-circle" size={roleCheckIconSize} color={PREMIUM_TEXT_SOFT} />
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
                          { fontSize: roleCardLabelFontSize },
                          selectedRole === 'driver' && styles.roleCardLabelActive,
                        ]}
                        subtitleStyle={[
                          styles.roleCardDesc,
                          rs.isVeryCompact && styles.roleCardDescVery,
                          selectedRole === 'driver' && styles.roleCardDescActiveDriver,
                          {
                            fontSize: roleCardSubtitleOneLineFont,
                            lineHeight: roleCardSubtitleOneLineHeight,
                          },
                        ]}
                        checkmark={
                          selectedRole === 'driver' ? (
                            <View style={[styles.roleCheckBadge, rs.isVeryCompact && styles.roleCheckBadgeVery]}>
                              <Ionicons name="checkmark-circle" size={roleCheckIconSize} color={PREMIUM_TEXT_SOFT} />
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
                            { fontSize: roleCardLabelFontSize },
                            rideVehicleKind === 'car' && styles.roleCardLabelActive,
                          ]}
                          subtitleStyle={[
                            styles.roleCardDesc,
                            rs.isVeryCompact && styles.roleCardDescVery,
                            rideVehicleKind === 'car' && styles.roleCardDescActivePassenger,
                            {
                              fontSize: roleCardSubtitleOneLineFont,
                              lineHeight: roleCardSubtitleOneLineHeight,
                            },
                          ]}
                          checkmark={
                            rideVehicleKind === 'car' ? (
                              <View style={[styles.roleCheckBadge, rs.isVeryCompact && styles.roleCheckBadgeVery]}>
                                <Ionicons name="checkmark-circle" size={roleCheckIconSize} color={PREMIUM_TEXT_SOFT} />
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
                            { fontSize: roleCardLabelFontSize },
                            rideVehicleKind === 'motorcycle' && styles.roleCardLabelActive,
                          ]}
                          subtitleStyle={[
                            styles.roleCardDesc,
                            rs.isVeryCompact && styles.roleCardDescVery,
                            rideVehicleKind === 'motorcycle' && styles.roleCardDescActivePassenger,
                            {
                              fontSize: roleCardSubtitleOneLineFont,
                              lineHeight: roleCardSubtitleOneLineHeight,
                            },
                          ]}
                          checkmark={
                            rideVehicleKind === 'motorcycle' ? (
                              <View style={[styles.roleCheckBadge, rs.isVeryCompact && styles.roleCheckBadgeVery]}>
                                <Ionicons name="checkmark-circle" size={roleCheckIconSize} color={PREMIUM_TEXT_SOFT} />
                              </View>
                            ) : undefined
                          }
                        />
                      </Animated.View>
                    </View>
                    <View
                      style={[
                        styles.roleStatusStripCompact,
                        rs.isVeryCompact && styles.roleStatusStripCompactVery,
                        rs.isCompact && !rs.isVeryCompact && styles.roleStatusStripCompactTight,
                      ]}
                    >
                      <View
                        style={[
                          styles.roleStatusPill,
                          styles.roleStatusPillCompact,
                          rs.isVeryCompact && styles.roleStatusPillCompactVery,
                        ]}
                      >
                        <Ionicons
                          name="checkmark-circle"
                          size={rs.isVeryCompact ? 16 : rs.isCompact ? 17 : 18}
                          color={PREMIUM_AUTH_CYAN}
                        />
                        <Text
                          style={[
                            styles.roleStatusTitleCompactInline,
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
                          styles.roleChangeRolePillSecondaryCompact,
                          rs.isVeryCompact && styles.roleChangeRolePillSecondaryVery,
                        ]}
                        onPress={onChangeRole}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        activeOpacity={0.75}
                      >
                        <Text style={styles.roleChangeRoleLabelSecondary}>Rolü değiştir</Text>
                        <Ionicons
                          name="chevron-forward"
                          size={rs.isVeryCompact ? 13 : 14}
                          color="rgba(148,189,218,0.85)"
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
              onPress={onContinue}
              accessibilityLabel="Devam et"
              touchableStyleOverrides={
                !selectedRole || !rideVehicleKind
                  ? (pap.roleFloatAmbientLow as Record<string, unknown>)
                  : (pap.roleCtaCyanHalo as Record<string, unknown>)
              }
              labelStyle={{
                fontSize: roleContinueTextSize,
                letterSpacing: 0.42,
                fontWeight: '900',
                textShadowColor: 'rgba(2,10,26,0.55)',
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 3,
              }}
              gradientStyleOverrides={{
                minHeight: roleContinueMinHeight,
                paddingVertical: roleContinuePadV,
                paddingHorizontal: roleHorizontalPad + 6,
                borderRadius: Math.round(Math.max(21, Math.min(27, roleContinueMinHeight * 0.42))),
                gap: Math.round(Math.max(8, Math.min(14, 14 * roleScale))),
                borderWidth: StyleSheet.hairlineWidth + 1,
                borderColor: 'rgba(34,211,238,0.28)',
              }}
              trailing={
                <Ionicons name="arrow-forward-circle" size={continueArrowIconSize} color={PREMIUM_TEXT_SOFT} />
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
