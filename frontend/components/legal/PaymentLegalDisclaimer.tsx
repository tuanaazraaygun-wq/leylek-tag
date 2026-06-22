import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GlassSurface, PremiumText } from '../../design-system/primitives';
import { LDS_RADIUS } from '../../design-system/tokens/radius';
import { LDS_SPACING } from '../../design-system/tokens/spacing';
import { PAYMENT_LEGAL_DISCLAIMER_LINES } from '../../lib/legalUxCopy';
import { LEGAL_ROUTES } from '../../lib/legal/routes';

export type PaymentLegalDisclaimerProps = {
  /** Tighter layout for modals and sheets */
  compact?: boolean;
  accentColor?: string;
  /** Link to Katkı Payı ve IBAN Bilgilendirmesi */
  showDetailLink?: boolean;
};

export function PaymentLegalDisclaimer({
  compact = false,
  accentColor = 'rgba(34, 211, 238, 0.88)',
  showDetailLink = false,
}: PaymentLegalDisclaimerProps) {
  const router = useRouter();

  return (
    <GlassSurface
      variant="plain"
      borderRadius={LDS_RADIUS.md}
      style={[styles.wrap, compact && styles.wrapCompact]}
    >
      <View style={styles.headerRow}>
        <Ionicons name="shield-checkmark-outline" size={compact ? 14 : 16} color={accentColor} />
        <PremiumText variant="caption" muted style={styles.headerLabel}>
          Katkı payı bilgilendirmesi
        </PremiumText>
      </View>
      {PAYMENT_LEGAL_DISCLAIMER_LINES.map((line) => (
        <View key={line} style={styles.lineRow}>
          <PremiumText variant="caption" muted style={styles.bullet}>
            •
          </PremiumText>
          <PremiumText variant="caption" muted style={[styles.line, compact && styles.lineCompact]}>
            {line}
          </PremiumText>
        </View>
      ))}
      {showDetailLink ? (
        <Pressable
          style={({ pressed }) => [styles.detailLinkRow, pressed && styles.detailLinkPressed]}
          onPress={() => router.push(LEGAL_ROUTES.contributionIban as never)}
          accessibilityRole="link"
          accessibilityLabel="Katkı payı ve IBAN bilgilendirmesi detaylı bilgi"
        >
          <PremiumText variant="caption" style={[styles.detailLinkText, { color: accentColor }]}>
            Detaylı bilgi
          </PremiumText>
          <Ionicons name="chevron-forward" size={14} color={accentColor} />
        </Pressable>
      ) : null}
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  wrap: {
    padding: LDS_SPACING.sm,
    gap: LDS_SPACING.xxs,
    backgroundColor: 'rgba(8, 17, 31, 0.55)',
  },
  wrapCompact: {
    padding: LDS_SPACING.xs,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LDS_SPACING.xxs,
    marginBottom: 2,
  },
  headerLabel: {
    fontWeight: '600',
    letterSpacing: 0.02,
    opacity: 0.9,
  },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  bullet: {
    lineHeight: 18,
    opacity: 0.72,
  },
  line: {
    flex: 1,
    lineHeight: 18,
    opacity: 0.88,
  },
  lineCompact: {
    fontSize: 11,
    lineHeight: 16,
  },
  detailLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 2,
    marginTop: 4,
    paddingVertical: 2,
  },
  detailLinkPressed: {
    opacity: 0.82,
  },
  detailLinkText: {
    fontWeight: '600',
  },
});
