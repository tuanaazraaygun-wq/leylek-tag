import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  PREMIUM_NAVY_DEEP,
  PREMIUM_ROLE_CARD_BG,
  PREMIUM_ROLE_CARD_BORDER,
} from '../components/auth/premiumAuthStyles';
import {
  CockpitBackground,
  GlassSurface,
  PremiumText,
} from '../design-system/primitives';
import { LDS_COLOR_ERROR } from '../design-system/tokens/color';
import { LDS_SPACING } from '../design-system/tokens/spacing';
import { themeSettingsEnabled } from '../lib/featureFlags';
import { clearSessionStorage, getPersistedUserRaw } from '../lib/sessionToken';
import ThemeSettingsSegment from '../components/theme/ThemeSettingsSegment';
import { useSettingsTheme, type SettingsUiColors, type SettingsHubLightSurfaces } from '../lib/theme/useSettingsTheme';

type HubUser = {
  id?: string;
  name?: string;
  full_name?: string;
  role?: 'passenger' | 'driver' | string;
};

function roleLabel(role?: string): string {
  if (role === 'driver') return 'Sürücü';
  if (role === 'passenger') return 'Yolcu';
  return 'Leylek kullanıcısı';
}

type SettingsHubRowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
  isFirst?: boolean;
  ui: SettingsUiColors;
  hubSurfaces: SettingsHubLightSurfaces | null;
};

function SettingsHubRow({
  icon,
  label,
  onPress,
  danger = false,
  isFirst = false,
  ui,
  hubSurfaces,
}: SettingsHubRowProps) {
  const iconColor = danger ? LDS_COLOR_ERROR : ui.accent;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        isFirst && styles.rowFirst,
        !isFirst && hubSurfaces?.row,
        pressed && styles.rowPressed,
      ]}
      onPress={onPress}
    >
      <View style={styles.rowLeft}>
        <Ionicons name={icon} size={20} color={iconColor} />
        <PremiumText
          variant="body"
          style={[styles.rowText, danger && styles.dangerText]}
          numberOfLines={2}
        >
          {label}
        </PremiumText>
      </View>
      <Ionicons name="chevron-forward" size={18} color={ui.textMuted} />
    </Pressable>
  );
}

type SettingsHubCardProps = {
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

function SettingsHubCard({ title, children, footer }: SettingsHubCardProps) {
  return (
    <GlassSurface variant="plain" style={styles.card}>
      <PremiumText variant="title" style={styles.cardTitle}>
        {title}
      </PremiumText>
      {footer}
      {children}
    </GlassSurface>
  );
}

export default function SettingsHubScreen() {
  const router = useRouter();
  const { hubSurfaces, ui } = useSettingsTheme('settings');
  const [user, setUser] = useState<HubUser | null>(null);
  const [logoutBusy, setLogoutBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await getPersistedUserRaw();
        if (!raw) return;
        const parsed = JSON.parse(raw) as HubUser;
        setUser(parsed);
      } catch {
        setUser(null);
      }
    })();
  }, []);

  const displayName = useMemo(() => {
    const candidate = (user?.full_name || user?.name || '').trim();
    return candidate || 'Leylek kullanıcısı';
  }, [user?.full_name, user?.name]);

  const openExternalLink = async (url: string, errorTitle: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert(errorTitle, 'Bu bağlantı bu cihazda açılamıyor.');
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert(errorTitle, 'Bağlantı açılamadı. Lütfen tekrar deneyin.');
    }
  };

  const openMyProfile = () => {
    const uid = String(user?.id || '').trim();
    if (uid) {
      router.push(`/muhabbet-profile/${encodeURIComponent(uid)}` as any);
      return;
    }
    Alert.alert('Profil', 'Profil bilgisi yüklenemedi.');
  };

  const handleSafeLogout = async () => {
    if (logoutBusy) return;
    setLogoutBusy(true);
    try {
      await clearSessionStorage();
      router.replace('/' as any);
    } catch {
      Alert.alert('Çıkış', 'Oturum kapatılırken bir hata oluştu.');
    } finally {
      setLogoutBusy(false);
    }
  };

  return (
    <View style={[styles.screen, hubSurfaces?.screen]}>
      <CockpitBackground />
      <SafeAreaView style={styles.safe}>
        <GlassSurface variant="header" style={styles.headerGlass}>
          <View style={styles.header}>
            <Pressable
              style={({ pressed }) => [
                styles.backBtn,
                hubSurfaces?.backBtn,
                pressed && styles.backBtnPressed,
              ]}
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-back" size={20} color={ui.accent} />
            </Pressable>
            <View style={styles.headerBody}>
              <PremiumText variant="headline" style={styles.title}>
                Ayarlar
              </PremiumText>
              <PremiumText variant="caption" muted style={styles.subtitle}>
                Hesap, destek ve yasal bilgilerin burada.
              </PremiumText>
              <PremiumText variant="caption" style={styles.identity}>
                {displayName} • {roleLabel(user?.role)}
              </PremiumText>
            </View>
          </View>
        </GlassSurface>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          <SettingsHubCard title="Profil">
            <SettingsHubRow
              isFirst
              icon="person-circle-outline"
              label="Profilim"
              onPress={openMyProfile}
              ui={ui}
              hubSurfaces={hubSurfaces}
            />
          </SettingsHubCard>

          {themeSettingsEnabled ? <ThemeSettingsSegment /> : null}

          {user?.role === 'driver' ? (
            <>
              <SettingsHubCard title="Sürücü">
                <SettingsHubRow
                  isFirst
                  icon="volume-high-outline"
                  label="Teklif Sesi"
                  onPress={() => router.push('/driver-offer-sound-settings' as any)}
                  ui={ui}
                  hubSurfaces={hubSurfaces}
                />
              </SettingsHubCard>
              <SettingsHubCard title="Katkı payı / IBAN">
                <SettingsHubRow
                  isFirst
                  icon="card-outline"
                  label="IBAN hesabınızı yönetin"
                  onPress={() => router.push('/driver-bank-accounts' as any)}
                  ui={ui}
                  hubSurfaces={hubSurfaces}
                />
              </SettingsHubCard>
            </>
          ) : null}

          <SettingsHubCard
            title="Destek"
            footer={
              <PremiumText variant="caption" muted style={styles.company}>
                Karekod Teknoloji ve Yazılım A.Ş.
              </PremiumText>
            }
          >
            <SettingsHubRow
              isFirst
              icon="mail-outline"
              label="info@karekodteknoloji.com"
              onPress={() => {
                void openExternalLink('mailto:info@karekodteknoloji.com', 'E-posta açılamadı');
              }}
              ui={ui}
              hubSurfaces={hubSurfaces}
            />
            <SettingsHubRow
              icon="call-outline"
              label="0850 307 80 29"
              onPress={() => {
                void openExternalLink('tel:08503078029', 'Telefon açılamadı');
              }}
              ui={ui}
              hubSurfaces={hubSurfaces}
            />
          </SettingsHubCard>

          <SettingsHubCard title="Yasal">
            <SettingsHubRow
              isFirst
              icon="shield-checkmark-outline"
              label="Yasal ve Güven Merkezi"
              onPress={() => router.push('/trust-center' as any)}
              ui={ui}
              hubSurfaces={hubSurfaces}
            />
            <SettingsHubRow
              icon="document-text-outline"
              label="Kullanıcı Sözleşmesi"
              onPress={() => router.push('/terms-user' as any)}
              ui={ui}
              hubSurfaces={hubSurfaces}
            />
            <SettingsHubRow
              icon="information-circle-outline"
              label="KVKK Aydınlatma Metni"
              onPress={() => router.push('/kvkk' as any)}
              ui={ui}
              hubSurfaces={hubSurfaces}
            />
            <SettingsHubRow
              icon="lock-closed-outline"
              label="Gizlilik Politikası"
              onPress={() => router.push('/privacy' as any)}
              ui={ui}
              hubSurfaces={hubSurfaces}
            />
            <SettingsHubRow
              danger
              icon="trash-outline"
              label="Hesap Silme"
              onPress={() => router.push('/delete-account' as any)}
              ui={ui}
              hubSurfaces={hubSurfaces}
            />
          </SettingsHubCard>

          <SettingsHubCard title="Hesap">
            <SettingsHubRow
              danger
              isFirst
              icon="trash-outline"
              label="Hesabımı Sil"
              onPress={() => router.push('/delete-account' as any)}
              ui={ui}
              hubSurfaces={hubSurfaces}
            />
            <SettingsHubRow
              danger
              icon="log-out-outline"
              label={logoutBusy ? 'Çıkış yapılıyor...' : 'Çıkış Yap'}
              onPress={() => void handleSafeLogout()}
              ui={ui}
              hubSurfaces={hubSurfaces}
            />
          </SettingsHubCard>
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PREMIUM_ROLE_CARD_BG,
    borderWidth: StyleSheet.hairlineWidth + 1,
    borderColor: PREMIUM_ROLE_CARD_BORDER,
  },
  backBtnPressed: {
    opacity: 0.92,
  },
  headerBody: {
    marginLeft: LDS_SPACING.sm,
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.35,
  },
  subtitle: {
    marginTop: LDS_SPACING.xxs,
  },
  identity: {
    marginTop: LDS_SPACING.xs,
    fontWeight: '600',
    opacity: 0.88,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: LDS_SPACING.md,
    paddingBottom: LDS_SPACING.xxl,
    gap: LDS_SPACING.sm,
  },
  card: {
    paddingHorizontal: LDS_SPACING.sm + 2,
    paddingVertical: LDS_SPACING.sm,
  },
  cardTitle: {
    fontSize: 16,
    lineHeight: 22,
    marginBottom: LDS_SPACING.xs,
    letterSpacing: -0.2,
  },
  company: {
    marginBottom: LDS_SPACING.xs,
  },
  row: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(30, 58, 95, 0.55)',
    paddingVertical: LDS_SPACING.xxs,
  },
  rowFirst: {
    borderTopWidth: 0,
    paddingTop: 0,
  },
  rowPressed: {
    opacity: 0.88,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    flex: 1,
    paddingRight: LDS_SPACING.xs,
  },
  rowText: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  dangerText: {
    color: LDS_COLOR_ERROR,
  },
});
