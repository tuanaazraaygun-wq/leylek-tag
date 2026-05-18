import React, { useState } from 'react';
import { Platform, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LoginBrandHeader } from './LoginBrandHeader';
import { PREMIUM_AUTH_CYAN, premiumAuthStyles as pa } from './premiumAuthStyles';
import { PremiumAuthScreenShell, PremiumGlassShell, PremiumGradientCtaButton } from './premiumAuthChrome';
import { tapButtonHaptic } from '../../utils/touchHaptics';

export type OtpVerificationScreenProps = {
  otp: string;
  setOtp: (v: string) => void;
  phone: string;
  styles: Record<string, unknown>;
  onVerify: () => void;
  onBack: () => void;
  countdownSlot: React.ReactNode;
  onOtpTypingHaptic?: (nextLongerThanPrev: boolean) => void;
};

export function OtpVerificationScreen({
  otp,
  setOtp,
  phone,
  styles,
  onVerify,
  onBack,
  countdownSlot,
  onOtpTypingHaptic,
}: OtpVerificationScreenProps) {
  const [focused, setFocused] = useState(false);
  const { width: winW, height: winH } = useWindowDimensions();
  const padH = Math.min(22, Math.max(14, Math.round(winW * 0.045)));
  const columnW = Math.min(400, winW - padH * 2);
  const isShort = winH < 560;
  const isCompact = winH < 660;
  /** Görsel bloklama — sunucuya giden doğrulama `onVerify` içinde olduğu gibi kalır */
  const ctaLooksDisabled = otp.replace(/\D/g, '').length < 6;

  return (
    <PremiumAuthScreenShell parentStyles={styles}>
      <LoginBrandHeader usableWidth={columnW} isCompact={isCompact} isShort={isShort} theme="premium" />

      <PremiumGlassShell compactPadding={isShort}>
        <Text style={[pa.phoneLabel, { marginBottom: 8 }]}>Doğrulama kodu</Text>
        <Text style={pa.otpHint}>{`${phone} numarasına SMS ile gönderilen 6 haneli kodu girin.`}</Text>
        <View style={[pa.inputShell, focused ? pa.inputShellFocused : null]}>
          <Ionicons name="keypad-outline" size={Platform.OS === 'ios' ? 20 : 19} color={PREMIUM_AUTH_CYAN} style={{ marginRight: 10 }} />
          <TextInput
            style={[pa.inputField, pa.otpInputField]}
            placeholder="• • • • • •"
            placeholderTextColor="rgba(148,163,184,0.55)"
            keyboardType="number-pad"
            value={otp}
            blurOnSubmit={false}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            selectionColor={PREMIUM_AUTH_CYAN}
            onChangeText={(t) => {
              if (onOtpTypingHaptic) {
                onOtpTypingHaptic(t.length > otp.length);
              }
              setOtp(t);
            }}
            maxLength={6}
            autoCorrect={false}
          />
        </View>

        {countdownSlot}

        <PremiumGradientCtaButton
          label="DOĞRULA"
          disabled={ctaLooksDisabled}
          onPress={() => {
            void tapButtonHaptic();
            onVerify();
          }}
          accessibilityLabel="Doğrula"
        />

        <TouchableOpacity
          style={pa.otpBackMinimal}
          activeOpacity={0.75}
          onPress={() => {
            void tapButtonHaptic();
            onBack();
          }}
        >
          <Text style={pa.otpBackText}>Geri Dön</Text>
        </TouchableOpacity>
      </PremiumGlassShell>
    </PremiumAuthScreenShell>
  );
}
