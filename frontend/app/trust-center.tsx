import React from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
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
import {
  LEGAL_DOCUMENT_GROUPS,
  TRUST_CENTER_DRAFT_BANNER,
  TRUST_CENTER_SUMMARY,
} from '../lib/legal/documentGroups';
import type { LegalHubLink } from '../lib/legal/legalDocumentTypes';
import { useSettingsTheme } from '../lib/theme/useSettingsTheme';

function TrustCenterDocRow({
  link,
  isFirst,
  onPress,
  accent,
  muted,
}: {
  link: LegalHubLink;
  isFirst: boolean;
  onPress: () => void;
  accent: string;
  muted: string;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.docRow,
        !isFirst && styles.docRowBorder,
        pressed && styles.docRowPressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={link.title}
    >
      <View style={styles.docRowLeft}>
        <View style={styles.docIconWrap}>
          <Ionicons name={link.icon as keyof typeof Ionicons.glyphMap} size={18} color={accent} />
        </View>
        <View style={styles.docTextWrap}>
          <View style={styles.docTitleRow}>
            <PremiumText variant="body" style={styles.docTitle} numberOfLines={2}>
              {link.title}
            </PremiumText>
            {link.isDraft ? (
              <View style={styles.draftPill}>
                <PremiumText variant="caption" style={styles.draftPillText}>
                  Taslak
                </PremiumText>
              </View>
            ) : null}
          </View>
          {link.description ? (
            <PremiumText variant="caption" muted numberOfLines={2}>
              {link.description}
            </PremiumText>
          ) : null}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={muted} />
    </Pressable>
  );
}

export default function TrustCenterScreen() {
  const router = useRouter();
  const { legalRouteSurfaces: lt, legalUi, ui } = useSettingsTheme('legal');

  const openLink = (route: string) => {
    router.push(route as never);
  };

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
            <View style={styles.headerTitleRow}>
              <Ionicons name="shield-checkmark" size={22} color={legalUi.accent} />
              <PremiumText variant="title" style={[styles.headerTitle, lt?.headerTitle]}>
                Yasal ve Güven Merkezi
              </PremiumText>
            </View>
            <PremiumText variant="caption" muted style={styles.headerSubtitle}>
              {TRUST_CENTER_SUMMARY}
            </PremiumText>
          </View>
        </GlassSurface>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <GlassSurface variant="plain" borderRadius={LDS_RADIUS.lg} style={[styles.draftBanner, lt?.disclaimerBox]}>
            <Ionicons name="alert-circle-outline" size={20} color="#F59E0B" />
            <PremiumText variant="caption" style={styles.draftBannerText}>
              {TRUST_CENTER_DRAFT_BANNER}
            </PremiumText>
          </GlassSurface>

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
            <PremiumText variant="caption" muted style={styles.metaLine}>
              {LEGAL_COMPANY_META.address}
            </PremiumText>
            <Pressable onPress={() => void openEmail()} style={styles.contactRow}>
              <Ionicons name="mail-outline" size={16} color={legalUi.accent} />
              <PremiumText variant="caption" style={[styles.contactLink, { color: legalUi.accent }]}>
                {LEGAL_COMPANY_META.email}
              </PremiumText>
            </Pressable>
            <Pressable onPress={() => void openPhone()} style={styles.contactRow}>
              <Ionicons name="call-outline" size={16} color={legalUi.accent} />
              <PremiumText variant="caption" style={[styles.contactLink, { color: legalUi.accent }]}>
                {LEGAL_COMPANY_META.phone}
              </PremiumText>
            </Pressable>
          </GlassSurface>

          {LEGAL_DOCUMENT_GROUPS.map((group) => (
            <GlassSurface
              key={group.id}
              variant="plain"
              borderRadius={LDS_RADIUS.lg}
              style={[styles.groupCard, lt?.companyInfo]}
            >
              <PremiumText variant="step" style={[styles.groupTitle, lt?.sectionTitle]}>
                {group.title}
              </PremiumText>
              {group.description ? (
                <PremiumText variant="caption" muted style={styles.groupDescription}>
                  {group.description}
                </PremiumText>
              ) : null}
              {group.links.map((link, index) => (
                <TrustCenterDocRow
                  key={link.id}
                  link={link}
                  isFirst={index === 0}
                  onPress={() => openLink(link.route)}
                  accent={legalUi.accent}
                  muted={ui.textMuted}
                />
              ))}
            </GlassSurface>
          ))}

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
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LDS_SPACING.xs,
  },
  headerTitle: {
    flex: 1,
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
    gap: LDS_SPACING.sm,
  },
  draftBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: LDS_SPACING.xs,
    padding: LDS_SPACING.md,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  draftBannerText: {
    flex: 1,
    color: '#F59E0B',
    lineHeight: 20,
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
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LDS_SPACING.xxs,
    marginTop: 4,
  },
  contactLink: {
    fontWeight: '600',
  },
  groupCard: {
    padding: LDS_SPACING.md,
  },
  groupTitle: {
    marginBottom: LDS_SPACING.xxs,
    letterSpacing: -0.2,
  },
  groupDescription: {
    marginBottom: LDS_SPACING.sm,
    lineHeight: 18,
  },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: LDS_SPACING.sm,
    gap: LDS_SPACING.sm,
  },
  docRowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: PREMIUM_ROLE_CARD_BORDER,
  },
  docRowPressed: {
    opacity: 0.88,
  },
  docRowLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: LDS_SPACING.sm,
    minWidth: 0,
  },
  docIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(8, 17, 31, 0.45)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PREMIUM_ROLE_CARD_BORDER,
  },
  docTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  docTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 2,
  },
  docTitle: {
    fontWeight: '600',
    flexShrink: 1,
  },
  draftPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: LDS_RADIUS.full,
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  draftPillText: {
    color: '#F59E0B',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  bottomPad: {
    height: LDS_SPACING.xl,
  },
});
