import React, { useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LegalPage } from '../LegalPages';
import { LoginBrandHeader } from './LoginBrandHeader';
import { PREMIUM_AUTH_CYAN, premiumAuthStyles as pa } from './premiumAuthStyles';
import { PremiumAuthScreenShell, PremiumGlassShell, PremiumGradientCtaButton } from './premiumAuthChrome';
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
  const [legalDoc, setLegalDoc] = useState<null | 'kvkk' | 'privacy'>(null);
  const { height: winH, width: winW } = useWindowDimensions();
  const isShort = winH < 560;
  const isCompact = winH < 660;
  const padH = Math.min(22, Math.max(14, Math.round(winW * 0.045)));
  const columnW = Math.min(400, winW - padH * 2);

  const blocked = !kvkkAccepted || phone.replace(/\D/g, '').length < 10;

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
          <Text style={pa.phoneLabel}>Telefon Numaranız</Text>
          <View style={pa.inputShell}>
            <Ionicons name="call-outline" size={18} color={PREMIUM_AUTH_CYAN} style={{ marginRight: 10 }} />
            <TextInput
              style={pa.inputField}
              placeholder="5XX XXX XX XX"
              placeholderTextColor="rgba(148,163,184,0.78)"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              maxLength={11}
              selectionColor={PREMIUM_AUTH_CYAN}
              autoCorrect={false}
            />
          </View>

          <View style={pa.kvkkRow}>
            <TouchableOpacity
              onPress={() => setKvkkAccepted(!kvkkAccepted)}
              activeOpacity={0.85}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: kvkkAccepted }}
            >
              <View style={[pa.checkboxOuter, kvkkAccepted && pa.checkboxFilled]}>
                {kvkkAccepted ? <Ionicons name="checkmark" size={14} color="#0F172A" /> : null}
              </View>
            </TouchableOpacity>
            <Text style={pa.kvkkBlock}>
              <Text onPress={() => setLegalDoc('kvkk')} style={pa.kvkkLink}>
                Aydınlatma Metni
              </Text>
              <Text style={pa.kvkkPlain}> ve </Text>
              <Text onPress={() => setLegalDoc('privacy')} style={pa.kvkkLink}>
                Gizlilik Politikası
              </Text>
              <Text style={pa.kvkkPlain}>{`'nı okudum, anladım ve kabul ediyorum.`}</Text>
            </Text>
          </View>

          <PremiumGradientCtaButton
            label="DEVAM ET →"
            disabled={blocked}
            onPress={() => {
              void tapButtonHaptic();
              onPressContinue();
            }}
            accessibilityLabel="Devam et"
          />

          <View style={pa.veyaRow}>
            <View style={pa.veyaLine} />
            <Text style={pa.veyaLabel}>veya</Text>
            <View style={pa.veyaLine} />
          </View>

          <TouchableOpacity
            style={pa.outlineGlass}
            onPress={() => {
              void tapButtonHaptic();
              onPressRegister();
            }}
            activeOpacity={0.92}
          >
            <Ionicons name="person-add-outline" size={18} color={PREMIUM_AUTH_CYAN} />
            <Text style={pa.outlineLabel}>Kayıt Ol</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={pa.forgotWrap}
            onPress={() => {
              void tapButtonHaptic();
              onPressForgotPassword();
            }}
            activeOpacity={0.85}
          >
            <Text style={pa.forgotText}>Şifremi Unuttum</Text>
          </TouchableOpacity>
        </PremiumGlassShell>

        <TouchableOpacity
          style={pa.outlineGlassWide}
          onPress={() => {
            void tapButtonHaptic();
            onPressSupport();
          }}
          activeOpacity={0.9}
          accessibilityRole="button"
          accessibilityLabel="Destek"
        >
          <Ionicons name="headset-outline" size={20} color={PREMIUM_AUTH_CYAN} style={{ marginRight: 8 }} />
          <Text style={pa.supportLabel}>Destek</Text>
        </TouchableOpacity>

        <PremiumGlassShell compactPadding={isShort}>
          <View style={pa.trustRow}>
            <View style={pa.trustCol}>
              <Ionicons name="shield-checkmark-outline" size={22} color={PREMIUM_AUTH_CYAN} />
              <Text style={pa.trustTitle}>GÜVENLİ</Text>
              <Text style={pa.trustSub}>Korunan yolculuk</Text>
            </View>
            <View style={pa.trustDivider} />
            <View style={pa.trustCol}>
              <Ionicons name="flash-outline" size={22} color={PREMIUM_AUTH_CYAN} />
              <Text style={pa.trustTitle}>HIZLI</Text>
              <Text style={pa.trustSub}>Anında eşleşme</Text>
            </View>
            <View style={pa.trustDivider} />
            <View style={pa.trustCol}>
              <Ionicons name="body-outline" size={22} color={PREMIUM_AUTH_CYAN} />
              <Text style={pa.trustTitle}>KONFORLU</Text>
              <Text style={pa.trustSub}>Premium deneyim</Text>
            </View>
          </View>
        </PremiumGlassShell>
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
  return (
    <View>
      <Text style={pa.modalTitle}>Destek</Text>
      <Text style={pa.modalBody}>Uygulama içi sorunlarınız için lütfen destek kanallarımızdan bize ulaşın.</Text>
      <Text style={pa.modalCompany}>Karekod Teknoloji ve Yazılım A.Ş.</Text>
      <TouchableOpacity style={pa.modalLinkRow} onPress={() => void openExternalLink('mailto:info@karekodteknoloji.com', 'E-posta açılamadı')}>
        <Ionicons name="mail-outline" size={16} color={PREMIUM_AUTH_CYAN} />
        <Text style={pa.modalLinkText}>info@karekodteknoloji.com</Text>
      </TouchableOpacity>
      <TouchableOpacity style={pa.modalLinkRow} onPress={() => void openExternalLink('tel:08503078029', 'Telefon açılamadı')}>
        <Ionicons name="call-outline" size={16} color={PREMIUM_AUTH_CYAN} />
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
