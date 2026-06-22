import React, { useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { GlassSurface, PremiumText } from '../../design-system/primitives';
import { LDS_BORDER_COLOR, LDS_BORDER_WIDTH } from '../../design-system/tokens/border';
import { LDS_ELEVATION } from '../../design-system/tokens/elevation';
import { LDS_RADIUS } from '../../design-system/tokens/radius';
import { LDS_SPACING } from '../../design-system/tokens/spacing';
import { LegalPage } from '../LegalPages';
import { AuthLegalConsentBlock } from './AuthLegalConsentBlock';
import { LoginBrandHeader } from './LoginBrandHeader';
import { premiumAuthStyles as pa } from './premiumAuthStyles';
import { PremiumAuthScreenShell, PremiumGlassShell, PremiumGradientCtaButton, useAuthTheme } from './premiumAuthChrome';
import { tapButtonHaptic } from '../../utils/touchHaptics';

export type LoginScreenProps = {
  phone: string;
  kvkkAccepted: boolean;
  showKVKKModal: boolean;
  showSupportModal: boolean;
  setPhone: (v: string) => void;
  setKvkkAccepted: (v: boolean) => void;
  setShowKVKKModal: (v: boolean) => void;
  setShowSupportModal: (v: boolean) => void;
  onPressContinue: () => void;
  onPressRegister: () => void;
  onPressForgotPassword: () => void;
  onPressSupport: () => void;
  styles: Record<string, unknown>;
};

export function LoginScreen({
  phone,
  kvkkAccepted,
  showKVKKModal,
  showSupportModal,
  setPhone,
  setKvkkAccepted,
  setShowKVKKModal,
  setShowSupportModal,
  onPressContinue,
  onPressRegister,
  onPressForgotPassword,
  onPressSupport,
  styles,
}: LoginScreenProps) {
  const [legalDoc, setLegalDoc] = useState<null | 'kvkk' | 'privacy' | 'terms'>(null);
  const { tokens, lightSurfaces } = useAuthTheme();
  const { height: winH, width: winW } = useWindowDimensions();
  const isShort = winH < 560;
  const isCompact = winH < 660;
  const padH = Math.min(22, Math.max(14, Math.round(winW * 0.045)));
  const columnW = Math.min(400, winW - padH * 2);

  const [loginLegalValid, setLoginLegalValid] = useState(kvkkAccepted);
  const blocked = !loginLegalValid || phone.replace(/\D/g, '').length < 10;

  const trustItems = [
    {
      icon: 'shield-checkmark-outline' as const,
      title: 'Güvenli',
      subtitle: 'Korunan yolculuk',
    },
    {
      icon: 'flash-outline' as const,
      title: 'Hızlı',
      subtitle: 'Anında eşleşme',
    },
    {
      icon: 'body-outline' as const,
      title: 'Konforlu',
      subtitle: 'Rahat yolculuk',
    },
  ];

  const openExternalLink = async (url: string, errorTitle: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert(errorTitle, 'Bu bağlantı bu cihazda açılamıyor.');
        return;
      }
      await Linking.openURL(url);
    } catch (error) {
      console.warn('External link open failed:', error);
      Alert.alert(errorTitle, 'Bağlantı açılamadı. Lütfen tekrar deneyin.');
    }
  };

  return (
    <>
      <PremiumAuthScreenShell parentStyles={styles}>
        <LoginBrandHeader usableWidth={columnW} isCompact={isCompact} isShort={isShort} theme="premium" />

        <PremiumGlassShell compactPadding={isShort}>
          <Text style={[pa.phoneLabel, lightSurfaces?.phoneLabel]}>Telefon numaranız</Text>
          <View style={[pa.inputShell, lightSurfaces?.inputShell]}>
            <Ionicons name="call-outline" size={18} color={tokens.accent.primary} style={{ marginRight: 10 }} />
            <TextInput
              style={[pa.inputField, lightSurfaces?.inputField]}
              placeholder="5XX XXX XX XX"
              placeholderTextColor={lightSurfaces?.placeholder ?? 'rgba(148,163,184,0.78)'}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              maxLength={11}
              selectionColor={lightSurfaces?.selection ?? tokens.accent.primary}
              autoCorrect={false}
            />
          </View>

          <AuthLegalConsentBlock
            seedAccepted={kvkkAccepted}
            lightSurfaces={lightSurfaces}
            onOpenDoc={setLegalDoc}
            onValidityChange={(valid) => {
              setLoginLegalValid(valid);
              setKvkkAccepted(valid);
            }}
          />

          <PremiumGradientCtaButton
            label="Devam et"
            disabled={blocked}
            onPress={() => {
              void tapButtonHaptic();
              onPressContinue();
            }}
            accessibilityLabel="Devam et"
          />

          <View style={pa.veyaRow}>
            <View style={[pa.veyaLine, lightSurfaces?.veyaLine]} />
            <Text style={[pa.veyaLabel, lightSurfaces?.veyaLabel]}>veya</Text>
            <View style={[pa.veyaLine, lightSurfaces?.veyaLine]} />
          </View>

          <TouchableOpacity
            style={[pa.outlineGlass, lightSurfaces?.outlineGlass]}
            onPress={() => {
              void tapButtonHaptic();
              onPressRegister();
            }}
            activeOpacity={0.92}
          >
            <Ionicons name="person-add-outline" size={18} color={tokens.accent.primary} />
            <Text style={[pa.outlineLabel, lightSurfaces?.outlineLabel]}>Kayıt Ol</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={pa.forgotWrap}
            onPress={() => {
              void tapButtonHaptic();
              onPressForgotPassword();
            }}
            activeOpacity={0.85}
          >
            <Text style={[pa.forgotText, lightSurfaces?.forgotText]}>Şifremi Unuttum</Text>
          </TouchableOpacity>
        </PremiumGlassShell>

        <TouchableOpacity
          style={[pa.outlineGlassWide, lightSurfaces?.outlineGlassWide]}
          onPress={() => {
            void tapButtonHaptic();
            onPressSupport();
          }}
          activeOpacity={0.9}
          accessibilityRole="button"
          accessibilityLabel="Destek"
        >
          <Ionicons name="headset-outline" size={20} color={tokens.accent.primary} style={{ marginRight: 8 }} />
          <Text style={[pa.supportLabel, lightSurfaces?.supportLabel]}>Destek</Text>
        </TouchableOpacity>

        <View style={trustStyles.wrap} accessibilityRole="summary">
          <PremiumText variant="caption" muted style={trustStyles.stripLabel}>
            LeylekTAG güven katmanı
          </PremiumText>
          <View style={trustStyles.chipRow}>
            {trustItems.map((item) => (
              <GlassSurface
                key={item.title}
                variant="plain"
                borderRadius={LDS_RADIUS.sm}
                style={[trustStyles.chip, lightSurfaces?.trustChip]}
              >
                <View style={[trustStyles.chipIconWrap, lightSurfaces?.trustChipIconWrap]}>
                  <Ionicons
                    name={item.icon}
                    size={12}
                    color={lightSurfaces?.trustChipIcon ?? 'rgba(148,163,184,0.78)'}
                  />
                </View>
                <View style={trustStyles.chipTextCol}>
                  <PremiumText variant="caption" muted style={trustStyles.chipTitle} numberOfLines={1}>
                    {item.title}
                  </PremiumText>
                  <PremiumText variant="caption" muted style={trustStyles.chipSubtitle} numberOfLines={1}>
                    {item.subtitle}
                  </PremiumText>
                </View>
              </GlassSurface>
            ))}
          </View>
        </View>
      </PremiumAuthScreenShell>

      <LegalPage
        type="kvkk"
        visible={legalDoc === 'kvkk' || showKVKKModal}
        onClose={() => {
          setLegalDoc((d) => (d === 'kvkk' ? null : d));
          setShowKVKKModal(false);
        }}
      />
      <LegalPage type="privacy" visible={legalDoc === 'privacy'} onClose={() => setLegalDoc((d) => (d === 'privacy' ? null : d))} />
      <LegalPage type="terms" visible={legalDoc === 'terms'} onClose={() => setLegalDoc((d) => (d === 'terms' ? null : d))} />

      <Modal visible={showSupportModal} animationType="slide" transparent>
        <View style={pa.modalBackdrop}>
          {Platform.OS === 'android' ? (
            <View style={pa.modalPanelDark}>
              <SupportModalInner onClose={() => setShowSupportModal(false)} openExternalLink={openExternalLink} />
            </View>
          ) : (
            <BlurView intensity={56} tint="dark" style={pa.modalPanelBlur}>
              <SupportModalInner onClose={() => setShowSupportModal(false)} openExternalLink={openExternalLink} />
            </BlurView>
          )}
        </View>
      </Modal>
    </>
  );
}

function SupportModalInner({
  onClose,
  openExternalLink,
}: {
  onClose: () => void;
  openExternalLink: (url: string, title: string) => Promise<void>;
}) {
  const router = useRouter();
  const { tokens } = useAuthTheme();
  return (
    <View>
      <Text style={pa.modalTitle}>Destek</Text>
      <Text style={pa.modalBody}>Uygulama içi sorunlarınız için lütfen destek kanallarımızdan bize ulaşın.</Text>
      <Text style={pa.modalCompany}>Karekod Teknoloji ve Yazılım A.Ş.</Text>
      <TouchableOpacity style={pa.modalLinkRow} onPress={() => void openExternalLink('mailto:info@karekodteknoloji.com', 'E-posta açılamadı')}>
        <Ionicons name="mail-outline" size={16} color={tokens.accent.primary} />
        <Text style={pa.modalLinkText}>info@karekodteknoloji.com</Text>
      </TouchableOpacity>
      <TouchableOpacity style={pa.modalLinkRow} onPress={() => void openExternalLink('tel:08503078029', 'Telefon açılamadı')}>
        <Ionicons name="call-outline" size={16} color={tokens.accent.primary} />
        <Text style={pa.modalLinkText}>0850 307 80 29</Text>
      </TouchableOpacity>
      <View style={pa.modalLegalRow}>
        <TouchableOpacity onPress={() => router.push('/privacy' as never)}>
          <Text style={pa.modalLegalLink}>Gizlilik</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/terms' as never)}>
          <Text style={pa.modalLegalLink}>Şartlar</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/kvkk' as never)}>
          <Text style={pa.modalLegalLink}>KVKK</Text>
        </TouchableOpacity>
      </View>
      <PremiumGradientCtaButton
        label="Kapat"
        onPress={() => {
          void tapButtonHaptic();
          onClose();
        }}
        gradientStyleOverrides={pa.modalCloseGap}
      />
    </View>
  );
}

const trustStyles = StyleSheet.create({
  wrap: {
    alignSelf: 'stretch',
    marginTop: LDS_SPACING.xs,
    opacity: 0.92,
  },
  stripLabel: {
    textAlign: 'center',
    letterSpacing: 0.04,
    fontSize: 10,
    marginBottom: LDS_SPACING.xs,
    opacity: 0.82,
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: LDS_SPACING.xxs,
  },
  chip: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: LDS_SPACING.xxs,
    paddingVertical: LDS_SPACING.xs,
    paddingHorizontal: LDS_SPACING.xs,
    backgroundColor: 'rgba(8,17,31,0.28)',
    ...LDS_ELEVATION.flat,
  },
  chipIconWrap: {
    width: LDS_SPACING.lg,
    height: LDS_SPACING.lg,
    borderRadius: LDS_RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(8,17,31,0.38)',
    borderWidth: LDS_BORDER_WIDTH.hairline,
    borderColor: LDS_BORDER_COLOR.cockpitPanel,
    flexShrink: 0,
  },
  chipTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  chipTitle: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.03,
    opacity: 0.9,
  },
  chipSubtitle: {
    fontSize: 9,
    lineHeight: 12,
    letterSpacing: 0.02,
    opacity: 0.78,
  },
});
