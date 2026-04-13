import React from 'react';
import { Image, Text, View, StyleSheet, ViewStyle } from 'react-native';

export type LoginBrandHeaderProps = {
  usableWidth: number;
  isCompact: boolean;
  isShort: boolean;
  subtitle?: string;
};

const DEFAULT_TAGLINE = 'Güvenli ve hızlı yolculuk deneyimi';

export function LoginBrandHeader({
  usableWidth,
  isCompact,
  isShort,
  subtitle,
}: LoginBrandHeaderProps) {
  const clusterStyle: ViewStyle = {
    width: usableWidth,
    maxWidth: usableWidth,
  };

  const secondLine = subtitle?.trim() ? subtitle.trim() : DEFAULT_TAGLINE;

  return (
    <View style={[styles.cluster, clusterStyle]}>
      <View style={styles.logoRow}>
        <Image
          source={require('../../assets/images/logo.png')}
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
  /** `Logo.tsx` medium (100) ile aynı ölçü — APK ile tutarlı tek kaynak: assets/images/logo.png */
  logo: {
    width: 100,
    height: 100,
    marginTop: 8,
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
