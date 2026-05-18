import React from 'react';
import { Image, Text, View, StyleSheet, ViewStyle } from 'react-native';

export type LoginBrandHeaderProps = {
  usableWidth: number;
  isCompact: boolean;
  isShort: boolean;
  subtitle?: string;
  /** Varsayılan klasik görünüm; `premium` = giriş ekranı (kuş işareti + koyu tema metinleri). */
  theme?: 'default' | 'premium';
  /** Premium: isteğe bağlı ana başlık (Kayıt Ol, Şifremi Unuttum vb.). */
  premiumHeadline?: string;
  /** `brand`: büyük harf slogan; `body`: normal cümle alt başlık. */
  subtitleVariant?: 'brand' | 'body';
};

const DEFAULT_TAGLINE = 'Güvenli ve hızlı yolculuk deneyimi';
const PREMIUM_TAGLINE = 'GÜVENLİ VE HIZLI YOLCULUK DENEYİMİ';

export function LoginBrandHeader({
  usableWidth,
  isCompact,
  isShort,
  subtitle,
  theme = 'default',
  premiumHeadline,
  subtitleVariant = 'brand',
}: LoginBrandHeaderProps) {
  const clusterStyle: ViewStyle = {
    width: usableWidth,
    maxWidth: usableWidth,
  };

  const isPremium = theme === 'premium';

  const useBodySubtitle = subtitleVariant === 'body' && !!subtitle?.trim();

  const secondLine = subtitle?.trim()
    ? subtitle.trim()
    : isPremium
      ? PREMIUM_TAGLINE
      : DEFAULT_TAGLINE;

  if (isPremium) {
    const subtitleBase = useBodySubtitle ? styles.taglinePremiumBody : styles.taglinePremium;
    const subtitleExtras = (
      useBodySubtitle
        ? [isShort ? styles.taglinePremiumBodyShort : null, isCompact ? styles.taglinePremiumBodyCompact : null]
        : [isShort ? styles.taglinePremiumShort : null, isCompact ? styles.taglinePremiumCompact : null]
    ).filter(Boolean) as object[];

    const titleBlock = premiumHeadline?.trim() ? (
      <Text style={[styles.premiumAlternateHeadline, isCompact && styles.premiumAlternateHeadlineCompact]} numberOfLines={2}>
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
        {titleBlock}
        <Text
          style={[subtitleBase, !premiumHeadline?.trim() && styles.taglineAfterLogoOnly, ...subtitleExtras]}
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
      <Text style={[styles.title, isCompact && styles.titleCompact]}>Yolculuk Eşleştirme</Text>
      <Text
        style={[styles.tagline, isShort && styles.taglineShort, isCompact && styles.taglineCompact]}
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
  /** Premium: kelime işareti yokken logo ile slogan arasında nefes */
  taglineAfterLogoOnly: {
    marginTop: 14,
  },
  taglinePremium: {
    marginTop: 10,
    fontSize: 11,
    lineHeight: 15,
    color: 'rgba(248, 250, 252, 0.88)',
    textAlign: 'center',
    fontWeight: '700',
    paddingHorizontal: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  taglinePremiumShort: {
    marginTop: 6,
    fontSize: 10,
    lineHeight: 14,
    paddingHorizontal: 6,
  },
  taglinePremiumCompact: {
    fontSize: 9,
    letterSpacing: 0.85,
    lineHeight: 13,
  },
  premiumAlternateHeadline: {
    marginTop: 10,
    fontSize: 22,
    fontWeight: '900',
    color: 'rgba(243,248,255,0.94)',
    textAlign: 'center',
    letterSpacing: 0.35,
    paddingHorizontal: 10,
    textShadowColor: 'rgba(34, 211, 238, 0.12)',
    textShadowRadius: 8,
    textShadowOffset: { width: 0, height: 0 },
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
  title: {
    marginTop: 14,
    fontSize: 20,
    fontWeight: '800',
    color: '#1B1B1E',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  titleCompact: {
    marginTop: 10,
    fontSize: 17,
  },
  tagline: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 18,
    color: '#334155',
    textAlign: 'center',
    fontWeight: '600',
    paddingHorizontal: 12,
  },
  taglineShort: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 16,
    paddingHorizontal: 8,
  },
  taglineCompact: {
    fontSize: 11,
    lineHeight: 15,
  },
});
