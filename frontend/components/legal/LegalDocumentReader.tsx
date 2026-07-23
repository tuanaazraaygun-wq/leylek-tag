import React from 'react';
import { Pressable, ScrollView, StatusBar, StyleSheet, View, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  CockpitBackground,
  GlassSurface,
  PremiumText,
} from '../../design-system/primitives';
import {
  PREMIUM_NAVY_DEEP,
  PREMIUM_ROLE_CARD_BG,
  PREMIUM_ROLE_CARD_BORDER,
} from '../auth/premiumAuthStyles';
import { LDS_SPACING } from '../../design-system/tokens/spacing';
import { LDS_RADIUS } from '../../design-system/tokens/radius';
import { LEGAL_COMPANY_META } from '../../lib/legalUxCopy';
import { useSettingsTheme } from '../../lib/theme/useSettingsTheme';

export type LegalSubsection = {
  subtitle: string;
  body: string;
};

export type LegalSection = {
  title: string;
  body: string;
  subsections?: LegalSubsection[];
};

export type LegalDocumentReaderProps = {
  title: string;
  subtitle?: string;
  sections: LegalSection[];
  showCompanyMeta?: boolean;
  lastUpdated?: string;
};

export function LegalDocumentReader({
  title,
  subtitle,
  sections,
  showCompanyMeta = false,
  lastUpdated,
}: LegalDocumentReaderProps) {
  const router = useRouter();
  const { legalRouteSurfaces: lt, legalUi } = useSettingsTheme('legal');

  return (
    <View style={[styles.screen, lt?.container]}>
      <CockpitBackground showGrid={false} />
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
        <StatusBar
          barStyle={legalUi.statusBarStyle}
          {...(Platform.OS === 'ios' ? { backgroundColor: legalUi.statusBarBg } : {})}
        />

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
              {title}
            </PremiumText>
            {subtitle ? (
              <PremiumText variant="caption" muted style={styles.headerSubtitle}>
                {subtitle}
              </PremiumText>
            ) : null}
          </View>
          {lastUpdated ? (
            <View style={[styles.updatedBadge, lt?.companyInfo]}>
              <Ionicons name="time-outline" size={12} color={legalUi.backIcon} />
              <PremiumText variant="caption" muted style={styles.updatedBadgeText}>
                {lastUpdated}
              </PremiumText>
            </View>
          ) : (
            <View style={styles.headerSpacer} />
          )}
        </GlassSurface>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {showCompanyMeta ? (
            <GlassSurface variant="plain" borderRadius={LDS_RADIUS.lg} style={[styles.metaCard, lt?.companyInfo]}>
              <View style={styles.metaIconRow}>
                <Ionicons name="business-outline" size={18} color={legalUi.backIcon} />
                <PremiumText variant="caption" muted style={styles.metaEyebrow}>
                  Veri sorumlusu
                </PremiumText>
              </View>
              <PremiumText variant="body" style={[styles.metaCompany, lt?.companyName]}>
                {LEGAL_COMPANY_META.companyName}
              </PremiumText>
              <PremiumText variant="caption" muted style={[styles.metaLine, lt?.companyAddress]}>
                {LEGAL_COMPANY_META.address}
              </PremiumText>
              <PremiumText variant="caption" muted style={[styles.metaLine, lt?.companyEmail]}>
                E-posta: {LEGAL_COMPANY_META.email}
              </PremiumText>
              <PremiumText variant="caption" muted style={[styles.metaLine, lt?.companyEmail]}>
                Telefon: {LEGAL_COMPANY_META.phone}
              </PremiumText>
            </GlassSurface>
          ) : null}

          {sections.map((section) => (
            <GlassSurface
              key={section.title}
              variant="plain"
              borderRadius={LDS_RADIUS.lg}
              style={[styles.sectionCard, lt?.companyInfo]}
            >
              <PremiumText variant="step" style={[styles.sectionTitle, lt?.sectionTitle]}>
                {section.title}
              </PremiumText>
              {section.body.trim() ? (
                <PremiumText variant="body" style={[styles.paragraph, lt?.paragraph]}>
                  {section.body}
                </PremiumText>
              ) : null}
              {section.subsections?.map((sub) => (
                <View key={sub.subtitle} style={styles.subsectionBlock}>
                  <PremiumText variant="body" style={[styles.subTitle, lt?.subTitle]}>
                    {sub.subtitle}
                  </PremiumText>
                  <PremiumText variant="body" style={[styles.paragraph, lt?.paragraph]}>
                    {sub.body}
                  </PremiumText>
                </View>
              ))}
            </GlassSurface>
          ))}

          <GlassSurface variant="plain" borderRadius={LDS_RADIUS.lg} style={[styles.footerCard, lt?.footer]}>
            <PremiumText variant="caption" muted style={[styles.footerText, lt?.footerText]}>
              {LEGAL_COMPANY_META.companyName}
            </PremiumText>
            <PremiumText variant="caption" muted style={[styles.footerText, lt?.footerText]}>
              {LEGAL_COMPANY_META.email}
            </PremiumText>
            <PremiumText variant="caption" muted style={[styles.footerText, lt?.footerText]}>
              {LEGAL_COMPANY_META.phone}
            </PremiumText>
          </GlassSurface>

          <View style={styles.bottomPad} />
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
    lineHeight: 18,
  },
  headerSpacer: {
    width: 8,
  },
  updatedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: LDS_RADIUS.full,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  updatedBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: LDS_SPACING.md,
    gap: LDS_SPACING.sm,
  },
  metaCard: {
    padding: LDS_SPACING.md,
    gap: LDS_SPACING.xxs,
  },
  metaIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LDS_SPACING.xxs,
    marginBottom: LDS_SPACING.xxs,
  },
  metaEyebrow: {
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontSize: 10,
    fontWeight: '700',
  },
  metaCompany: {
    fontWeight: '700',
    marginBottom: 2,
  },
  metaLine: {
    lineHeight: 20,
  },
  sectionCard: {
    padding: LDS_SPACING.md,
  },
  sectionTitle: {
    marginBottom: LDS_SPACING.sm,
    letterSpacing: -0.2,
  },
  subTitle: {
    fontWeight: '600',
    marginBottom: LDS_SPACING.xxs,
  },
  subsectionBlock: {
    marginTop: LDS_SPACING.sm,
  },
  paragraph: {
    lineHeight: 24,
  },
  footerCard: {
    padding: LDS_SPACING.md,
    alignItems: 'center',
    gap: 4,
    marginTop: LDS_SPACING.xs,
  },
  footerText: {
    textAlign: 'center',
  },
  bottomPad: {
    height: LDS_SPACING.xl,
  },
});
