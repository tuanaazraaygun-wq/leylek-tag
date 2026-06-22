import React from 'react';
import { Linking, Pressable, ScrollView, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  CockpitBackground,
  GlassSurface,
  PremiumText,
} from '../design-system/primitives';
import {
  PREMIUM_NAVY_DEEP,
  PREMIUM_ROLE_CARD_BG,
  PREMIUM_ROLE_CARD_BORDER,
} from '../components/auth/premiumAuthStyles';
import { LDS_SPACING } from '../design-system/tokens/spacing';
import { LDS_RADIUS } from '../design-system/tokens/radius';
import { LEGAL_COMPANY_META } from '../lib/legalUxCopy';
import { useSettingsTheme } from '../lib/theme/useSettingsTheme';

export default function SupportScreen() {
  const router = useRouter();
  const { legalRouteSurfaces: lt, legalUi } = useSettingsTheme('legal');

  const openEmail = async () => {
    const url = `mailto:${LEGAL_COMPANY_META.email}`;
    const supported = await Linking.canOpenURL(url);
    if (supported) await Linking.openURL(url);
  };

  const openPhone = async () => {
    const url = 'tel:08503078029';
    const supported = await Linking.canOpenURL(url);
    if (supported) await Linking.openURL(url);
  };

  return (
    <View style={[styles.screen, lt?.container]}>
      <CockpitBackground showGrid={false} />
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <StatusBar barStyle={legalUi.statusBarStyle} backgroundColor={legalUi.statusBarBg} />

        <GlassSurface variant="plain" borderRadius={LDS_RADIUS.lg} style={[styles.headerGlass, lt?.header]}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
            accessibilityRole="button"
            accessibilityLabel="Geri"
          >
            <Ionicons name="arrow-back" size={22} color={legalUi.backIcon} />
          </Pressable>
          <View style={styles.headerBody}>
            <PremiumText variant="title" style={[styles.headerTitle, lt?.headerTitle]}>
              İletişim / Destek
            </PremiumText>
            <PremiumText variant="caption" muted style={styles.headerSubtitle}>
              Hesap, gizlilik ve yol paylaşımı desteği
            </PremiumText>
          </View>
        </GlassSurface>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <GlassSurface variant="plain" borderRadius={LDS_RADIUS.lg} style={[styles.card, lt?.companyInfo]}>
            <PremiumText variant="body" style={[styles.company, lt?.companyName]}>
              {LEGAL_COMPANY_META.companyName}
            </PremiumText>
            <PremiumText variant="caption" muted style={styles.line}>
              {LEGAL_COMPANY_META.address}
            </PremiumText>
            <PremiumText variant="caption" muted style={styles.info}>
              KVKK başvuruları, hesap silme, teknik sorunlar ve güvenlik bildirimleri için aşağıdaki
              kanalları kullanabilirsiniz. Acil güvenlik risklerinde 112 veya yerel acil hatları arayın;
              LeylekTAG acil müdahale birimi değildir.
            </PremiumText>
            <Pressable onPress={() => void openEmail()} style={styles.contactRow}>
              <Ionicons name="mail-outline" size={18} color={legalUi.accent} />
              <PremiumText variant="body" style={[styles.contactLink, { color: legalUi.accent }]}>
                {LEGAL_COMPANY_META.email}
              </PremiumText>
            </Pressable>
            <Pressable onPress={() => void openPhone()} style={styles.contactRow}>
              <Ionicons name="call-outline" size={18} color={legalUi.accent} />
              <PremiumText variant="body" style={[styles.contactLink, { color: legalUi.accent }]}>
                {LEGAL_COMPANY_META.phone}
              </PremiumText>
            </Pressable>
          </GlassSurface>

          <GlassSurface variant="plain" borderRadius={LDS_RADIUS.lg} style={[styles.card, lt?.companyInfo]}>
            <PremiumText variant="step" style={[styles.sectionTitle, lt?.sectionTitle]}>
              İlgili belgeler
            </PremiumText>
            <PremiumText variant="caption" muted style={styles.info}>
              Yasal metinlerin tamamı için Yasal ve Güven Merkezi&apos;ni kullanın.
            </PremiumText>
            <Pressable
              onPress={() => router.push('/trust-center' as never)}
              style={({ pressed }) => [styles.trustLink, pressed && styles.backBtnPressed]}
            >
              <Ionicons name="shield-checkmark-outline" size={18} color={legalUi.accent} />
              <PremiumText variant="body" style={[styles.contactLink, { color: legalUi.accent }]}>
                Yasal ve Güven Merkezi
              </PremiumText>
              <Ionicons name="chevron-forward" size={18} color={legalUi.backIcon} />
            </Pressable>
          </GlassSurface>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: PREMIUM_NAVY_DEEP,
  },
  safe: {
    flex: 1,
  },
  headerGlass: {
    marginHorizontal: LDS_SPACING.md,
    marginTop: LDS_SPACING.xs,
    marginBottom: LDS_SPACING.sm,
    paddingHorizontal: LDS_SPACING.sm,
    paddingVertical: LDS_SPACING.sm,
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: PREMIUM_ROLE_CARD_BG,
    borderWidth: StyleSheet.hairlineWidth + 1,
    borderColor: PREMIUM_ROLE_CARD_BORDER,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(8, 17, 31, 0.45)',
    borderWidth: StyleSheet.hairlineWidth + 1,
    borderColor: PREMIUM_ROLE_CARD_BORDER,
  },
  backBtnPressed: {
    opacity: 0.88,
  },
  headerBody: {
    flex: 1,
    marginLeft: LDS_SPACING.sm,
    minWidth: 0,
  },
  headerTitle: {
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    marginTop: LDS_SPACING.xxs,
    lineHeight: 20,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: LDS_SPACING.md,
    paddingBottom: LDS_SPACING.xl,
    gap: LDS_SPACING.sm,
  },
  card: {
    padding: LDS_SPACING.md,
    gap: LDS_SPACING.xs,
  },
  company: {
    fontWeight: '700',
  },
  line: {
    lineHeight: 20,
  },
  info: {
    lineHeight: 20,
    marginTop: LDS_SPACING.xxs,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LDS_SPACING.xs,
    marginTop: LDS_SPACING.xs,
  },
  contactLink: {
    fontWeight: '600',
  },
  sectionTitle: {
    marginBottom: 2,
  },
  trustLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LDS_SPACING.xs,
    marginTop: LDS_SPACING.sm,
  },
});
