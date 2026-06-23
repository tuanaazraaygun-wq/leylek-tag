import React from 'react';
import { Image, Text, View, StyleSheet, ViewStyle, type TextStyle } from 'react-native';
import { useAuthTheme } from './premiumAuthChrome';

export type LoginBrandHeaderProps = {
  usableWidth: number;
  isCompact: boolean;
  isShort: boolean;
  subtitle?: string;
  /** Varsayılan klasik görünüm; `premium` = giriş ekranı kokpit marka başlığı. */
  theme?: 'default' | 'premium';
  /** Premium: isteğe bağlı ana başlık (Kayıt Ol, Şifremi Unuttum vb.). */
  premiumHeadline?: string;
  /** `brand`: LHIS caption; `body`: normal cümle alt başlık. */
  subtitleVariant?: 'brand' | 'body';
};

const LHIS_DEFAULT_CAPTION = 'Güvenli yolculuk paylaşımı';

export function LoginBrandHeader({
  usableWidth,
  isCompact,
  isShort,
  subtitle,
  theme = 'default',
  premiumHeadline,
  subtitleVariant = 'brand',
}: LoginBrandHeaderProps) {
  const { isAuthLight, tokens } = useAuthTheme();
  const clusterStyle: ViewStyle = {
    width: usableWidth,
    maxWidth: usableWidth,
  };

  const isPremium = theme === 'premium';
  const premiumLightText = isPremium && isAuthLight;

  const leylekColorStyle: TextStyle = isPremium
    ? premiumLightText
      ? { color: tokens.text.primary }
      : styles.wordmarkLeylekPremium
    : styles.wordmarkLeylekDefault;

  const tagColorStyle: TextStyle = isPremium
    ? premiumLightText
      ? { color: tokens.accent.primary }
      : styles.wordmarkTagPremium
    : styles.wordmarkTagDefault;

  const premiumSubtitleColorStyle: TextStyle | null = premiumLightText ? { color: tokens.text.muted } : null;
  const premiumHeadlineColorStyle: TextStyle | null = premiumLightText ? { color: tokens.text.primary } : null;

  const useBodySubtitle = subtitleVariant === 'body' && !!subtitle?.trim();

  const secondLine = subtitle?.trim()
    ? subtitle.trim()
    : LHIS_DEFAULT_CAPTION;

  const showWordmark = !premiumHeadline?.trim();

  const wordmarkBlock = showWordmark ? (
    <Text
      style={[styles.wordmarkRow, isCompact && styles.wordmarkRowCompact, isShort && styles.wordmarkRowShort]}
      accessibilityRole="header"
      accessibilityLabel="LeylekTAG"
    >
      <Text style={[styles.wordmarkLeylek, leylekColorStyle, isCompact && styles.wordmarkLeylekCompact]}>
        Leylek
      </Text>
      <Text style={[styles.wordmarkTag, tagColorStyle, isCompact && styles.wordmarkTagCompact]}>
        TAG
      </Text>
    </Text>
  ) : null;

  if (isPremium) {
    const subtitleBase = useBodySubtitle ? styles.taglinePremiumBody : styles.taglineLhCaption;
    const subtitleExtras = (
      useBodySubtitle
        ? [isShort ? styles.taglinePremiumBodyShort : null, isCompact ? styles.taglinePremiumBodyCompact : null]
        : [isShort ? styles.taglineLhCaptionShort : null, isCompact ? styles.taglineLhCaptionCompact : null]
    ).filter(Boolean) as object[];

    const titleBlock = premiumHeadline?.trim() ? (
      <Text
        style={[
          styles.premiumAlternateHeadline,
          premiumHeadlineColorStyle,
          isCompact && styles.premiumAlternateHeadlineCompact,
        ]}
        numberOfLines={2}
      >
        {premiumHeadline.trim()}
      </Text>
    ) : null;

    return (
      <View style={[styles.cluster, clusterStyle]}>
        <View style={styles.logoRow}>
          <Image
            source={require('../../assets/images/leylek-logo-premium.png')}
            style={[styles.logo, isCompact && styles.logoCompact, isShort && styles.logoShort]}
            resizeMode="contain"
          />
        </View>
        {wordmarkBlock}
        {titleBlock}
        <Text
          style={[
            subtitleBase,
            premiumSubtitleColorStyle,
            showWordmark ? styles.taglineAfterWordmark : styles.taglineAfterHeadline,
            ...subtitleExtras,
          ]}
          numberOfLines={subtitle?.trim() ? (useBodySubtitle ? 5 : 4) : premiumHeadline?.trim() ? 3 : 2}
        >
          {secondLine}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.cluster, clusterStyle]}>
      <View style={styles.logoRow}>
        <Image
          source={require('../../assets/images/leylek-logo-premium.png')}
          style={[styles.logo, isCompact && styles.logoCompact, isShort && styles.logoShort]}
          resizeMode="contain"
        />
      </View>
      {wordmarkBlock}
      <Text
        style={[styles.taglineLhCaption, styles.taglineLhCaptionDefault, isShort && styles.taglineLhCaptionShort, isCompact && styles.taglineLhCaptionCompact]}
        numberOfLines={subtitle?.trim() ? 4 : 2}
      >
        {secondLine}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cluster: {
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 18,
  },
  logoRow: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmarkRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    flexWrap: 'nowrap',
    marginTop: 10,
  },
  wordmarkRowCompact: {
    marginTop: 8,
  },
  wordmarkRowShort: {
    marginTop: 6,
  },
  wordmarkLeylek: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 0.15,
  },
  wordmarkLeylekPremium: {
    color: 'rgba(243, 248, 255, 0.94)',
  },
  wordmarkLeylekDefault: {
    color: '#1B1B1E',
  },
  wordmarkLeylekCompact: {
    fontSize: 23,
    letterSpacing: 0.12,
  },
  wordmarkTag: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 0.45,
  },
  wordmarkTagPremium: {
    color: '#22D3EE',
  },
  wordmarkTagDefault: {
    color: '#0891B2',
  },
  wordmarkTagCompact: {
    fontSize: 23,
    letterSpacing: 0.38,
  },
  taglineAfterWordmark: {
    marginTop: 8,
  },
  taglineAfterHeadline: {
    marginTop: 10,
  },
  taglineLhCaption: {
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(186, 201, 222, 0.82)',
    textAlign: 'center',
    fontWeight: '600',
    paddingHorizontal: 12,
    letterSpacing: 0.2,
  },
  taglineLhCaptionDefault: {
    color: '#475569',
  },
  taglineLhCaptionShort: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  taglineLhCaptionCompact: {
    fontSize: 12,
    lineHeight: 17,
    letterSpacing: 0.15,
    paddingHorizontal: 6,
  },
  premiumAlternateHeadline: {
    marginTop: 10,
    fontSize: 22,
    fontWeight: '800',
    color: 'rgba(243,248,255,0.94)',
    textAlign: 'center',
    letterSpacing: 0.2,
    paddingHorizontal: 10,
  },
  premiumAlternateHeadlineCompact: {
    marginTop: 8,
    fontSize: 19,
    paddingHorizontal: 6,
  },
  taglinePremiumBody: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 21,
    color: 'rgba(226,232,240,0.9)',
    textAlign: 'center',
    fontWeight: '600',
    paddingHorizontal: 12,
  },
  taglinePremiumBodyShort: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  taglinePremiumBodyCompact: {
    fontSize: 12,
    lineHeight: 17,
    letterSpacing: 0.08,
    paddingHorizontal: 6,
  },
  /** Görünür kutuda nefes: kuş görseli içte `contain` ile tam görünür */
  logo: {
    width: 100,
    height: 100,
    marginTop: 8,
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  logoCompact: {
    width: 88,
    height: 88,
    marginTop: 6,
  },
  logoShort: {
    marginTop: 4,
  },
});
