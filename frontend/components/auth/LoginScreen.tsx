import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  Platform,
  Dimensions,
  KeyboardAvoidingView,
  ScrollView,
  StatusBar,
  Modal,
  StyleSheet,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AnimatedClouds from './AnimatedClouds';
import { LoginBrandHeader } from './LoginBrandHeader';
import { LegalPage } from '../LegalPages';
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
  styles: Record<string, any>;
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
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = Dimensions.get('window');
  const padH = 16;
  const colMax = 400;
  const columnW = Math.min(colMax, winW - padH * 2);
  const isCompact = winH < 640;
  const isShort = winH < 560;

  return (
    <View style={{ flex: 1, width: '100%', height: '100%' }}>
      {Platform.OS !== 'web' && (
        <Image
          source={require('../../assets/images/login-background.png')}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: winW,
            height: winH,
          }}
          resizeMode="cover"
        />
      )}
      {Platform.OS !== 'web' && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(255,255,255,0.03)',
          }}
        />
      )}
      <SafeAreaView style={[styles.container, { backgroundColor: Platform.OS === 'web' ? '#FFFFFF' : 'transparent' }]}>
        <AnimatedClouds />
        <View style={styles.loginLayerAboveClouds}>
          <KeyboardAvoidingView
            style={styles.loginKavFlex}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            enabled
            keyboardVerticalOffset={
              Platform.OS === 'ios' ? insets.top + 4 : (StatusBar.currentHeight ?? 0) + insets.top
            }
          >
            <ScrollView
              style={styles.loginAuthScroll}
              contentContainerStyle={styles.loginAuthScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View
                style={[
                  styles.loginPageShell,
                  {
                    paddingTop: isCompact ? 6 : 12,
                    paddingBottom: Math.max(insets.bottom, 8),
                  },
                ]}
              >
                <View style={[styles.loginPageColumn, { width: columnW }]}>
                  <LoginBrandHeader usableWidth={columnW} isCompact={isCompact} isShort={isShort} />

                  <View
                    style={[
                      styles.loginV2Card,
                      styles.loginV2CardTight,
                      {
                        paddingTop: isShort ? 10 : 14,
                        paddingBottom: isShort ? 10 : 14,
                        paddingHorizontal: isShort ? 12 : 14,
                      },
                    ]}
                  >
                    <Text style={[styles.modernLabel, styles.loginV2Label, localStyles.phoneLabel]}>
                      Telefon Numaranız
                    </Text>
                    <View style={[styles.modernInputContainer, styles.loginV2InputWrap, localStyles.phoneInputWrap]}>
                      <Ionicons name="call-outline" size={18} color="#2196F3" style={styles.inputIcon} />
                      <TextInput
                        style={[styles.modernInput, styles.loginV2Input]}
                        placeholder="5XX XXX XX XX"
                        placeholderTextColor="#A0A0A0"
                        keyboardType="phone-pad"
                        value={phone}
                        onChangeText={setPhone}
                        maxLength={11}
                      />
                    </View>

                    <View style={[styles.loginV2Kvkk, { marginBottom: 12, flexDirection: 'row', alignItems: 'flex-start' }]}>
                      <TouchableOpacity
                        onPress={() => setKvkkAccepted(!kvkkAccepted)}
                        activeOpacity={0.85}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <View style={[styles.checkbox, styles.loginCheckboxSm, kvkkAccepted && styles.checkboxChecked]}>
                          {kvkkAccepted ? <Ionicons name="checkmark" size={14} color="#FFF" /> : null}
                        </View>
                      </TouchableOpacity>
                      <Text style={[styles.loginV2KvkkText, styles.loginKvkkTextMicro, localStyles.kvkkBlock]}>
                        <Text onPress={() => setLegalDoc('kvkk')} style={styles.loginV2KvkkLink}>
                          Aydınlatma Metni
                        </Text>
                        <Text style={localStyles.kvkkPlain}> ve </Text>
                        <Text onPress={() => setLegalDoc('privacy')} style={styles.loginV2KvkkLink}>
                          Gizlilik Politikası
                        </Text>
                        <Text style={localStyles.kvkkPlain}>
                          {`'nı okudum, anladım ve kabul ediyorum.`}
                        </Text>
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={[
                        styles.modernPrimaryButton,
                        styles.loginPrimaryTight,
                        (!kvkkAccepted || phone.replace(/\D/g, '').length < 10) && styles.buttonDisabled,
                      ]}
                      onPress={() => {
                        void tapButtonHaptic();
                        onPressContinue();
                      }}
                      disabled={!kvkkAccepted || phone.replace(/\D/g, '').length < 10}
                    >
                      <Text style={styles.modernPrimaryButtonText}>DEVAM ET →</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.modernSecondaryButton, styles.loginV2RegisterBtn]}
                      onPress={() => {
                        void tapButtonHaptic();
                        onPressRegister();
                      }}
                    >
                      <Ionicons name="person-add-outline" size={18} color="#2196F3" />
                      <Text style={styles.loginV2RegisterTxt}>Kayıt Ol</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={localStyles.forgotWrap}
                      onPress={() => {
                        void tapButtonHaptic();
                        onPressForgotPassword();
                      }}
                    >
                      <Text style={localStyles.forgotText}>Şifremi Unuttum</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={localStyles.supportBtn}
                      onPress={() => {
                        void tapButtonHaptic();
                        onPressSupport();
                      }}
                      activeOpacity={0.9}
                    >
                      <Ionicons name="headset-outline" size={20} color="#2196F3" style={{ marginRight: 8 }} />
                      <Text style={localStyles.supportBtnText}>Destek</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </SafeAreaView>

      <LegalPage type="kvkk" visible={legalDoc === 'kvkk' || showKVKKModal} onClose={() => {
        setLegalDoc((d) => (d === 'kvkk' ? null : d));
        setShowKVKKModal(false);
      }} />
      <LegalPage type="privacy" visible={legalDoc === 'privacy'} onClose={() => setLegalDoc((d) => (d === 'privacy' ? null : d))} />

      <Modal visible={showSupportModal} animationType="slide" transparent>
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(15,23,42,0.55)',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <View
            style={{
              backgroundColor: '#fff',
              borderRadius: 16,
              padding: 18,
              maxHeight: '80%',
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#0F172A', marginBottom: 8 }}>Destek</Text>
            <Text style={{ fontSize: 14, color: '#334155', lineHeight: 20, marginBottom: 16 }}>
              Uygulama içi sorunlarınız için lütfen destek kanallarımızdan bize ulaşın. Telefon numaranızı ve kısa
              açıklamanızı eklemeniz yardımcı olur.
            </Text>
            <TouchableOpacity
              style={[styles.modernPrimaryButton, { marginTop: 4 }]}
              onPress={() => {
                void tapButtonHaptic();
                setShowSupportModal(false);
              }}
            >
              <Text style={styles.modernPrimaryButtonText}>Kapat</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const localStyles = StyleSheet.create({
  phoneLabel: {
    textAlign: 'left',
    alignSelf: 'stretch',
    marginBottom: 4,
  },
  phoneInputWrap: {
    borderWidth: 1.5,
    borderColor: '#2196F3',
  },
  kvkkBlock: {
    flex: 1,
    marginLeft: 4,
    marginTop: 0,
  },
  kvkkPlain: {
    color: '#37474F',
    fontSize: 11,
    lineHeight: 15,
  },
  forgotWrap: {
    alignSelf: 'center',
    marginTop: 10,
    paddingVertical: 4,
  },
  forgotText: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  supportBtn: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1.5,
    borderColor: '#2196F3',
    alignSelf: 'stretch',
  },
  supportBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1565C0',
  },
});
