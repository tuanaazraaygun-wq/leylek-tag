/**
 * Hesap Silme Sayfası - Google Play Zorunlu
 */

import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
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
import { clearSessionStorage, getPersistedAccessToken, getPersistedUserRaw } from '../lib/sessionToken';
import { API_BASE_URL } from '../lib/backendConfig';
import { useSettingsTheme, type SettingsUiColors, type SettingsHubLightSurfaces } from '../lib/theme/useSettingsTheme';

const DATA_ITEMS: { icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { icon: 'person', label: 'Profil bilgileriniz' },
  { icon: 'car', label: 'Yolculuk geçmişiniz' },
  { icon: 'chatbubbles', label: 'Mesajlarınız' },
  { icon: 'star', label: 'Puanlarınız ve değerlendirmeleriniz' },
  { icon: 'document-text', label: 'Ehliyet ve araç bilgileriniz (sürücüler için)' },
];

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

export default function DeleteAccountScreen() {
  const router = useRouter();
  const { hubSurfaces, ui } = useSettingsTheme('settings');
  const [isDeleting, setIsDeleting] = useState(false);

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

  const handleDeleteAccount = async () => {
    Alert.alert(
      '⚠️ Hesabı Sil',
      'Bu işlem hesabınızı devre dışı bırakır.\n\nAktif yolculuk varsa hesap silinemez.\n\nDevam etmek için onaylayın.',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Evet, Sil',
          style: 'destructive',
          onPress: confirmDelete,
        },
      ]
    );
  };

  const confirmDelete = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      const token = (await getPersistedAccessToken())?.trim();
      if (!token) {
        Alert.alert('Hata', 'Giriş yapmanız gerekiyor');
        return;
      }

      // user_id backend tarafından Bearer token'dan belirlenir
      const response = await fetch(`${API_BASE_URL}/user/delete-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: 'user_request_mobile' }),
      });

      const data = await response.json();

      if (response.status === 409 && data?.code === 'active_tag_exists') {
        Alert.alert('Hesap Silinemedi', 'Aktif yolculuk varken hesabınızı silemezsiniz.');
        return;
      }
      if (response.status === 409 && data?.code === 'active_muhabbet_trip_exists') {
        Alert.alert('Hesap Silinemedi', 'Aktif Leylek Teklifi yolculuğu varken hesabınızı silemezsiniz.');
        return;
      }

      if (data.success) {
        // Push token temizliği (best-effort)
        try {
          const raw = await getPersistedUserRaw();
          const parsed = raw ? (JSON.parse(raw) as { id?: string }) : null;
          const uid = String(parsed?.id || '').trim();
          if (uid) {
            await fetch(`${API_BASE_URL}/user/remove-push-token?user_id=${encodeURIComponent(uid)}`, {
              method: 'DELETE',
            });
          }
        } catch {
          // no-op
        }
        await clearSessionStorage();

        Alert.alert(
          '✅ Hesap Silindi',
          'Hesabınız devre dışı bırakıldı ve oturumunuz kapatıldı.',
          [
            {
              text: 'Tamam',
              onPress: () => router.replace('/'),
            },
          ]
        );
      } else {
        Alert.alert('Hata', data?.message || data?.error || 'Hesap silinemedi');
      }
    } catch (error) {
      console.error('Delete account error:', error);
      Alert.alert('Hata', 'Bir hata oluştu. Lütfen tekrar deneyin.');
    } finally {
      setIsDeleting(false);
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
                Hesap Silme
              </PremiumText>
              <PremiumText variant="caption" muted style={styles.subtitle}>
                Bu işlem geri alınamaz.
              </PremiumText>
            </View>
          </View>
        </GlassSurface>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <SettingsHubCard title="Dikkat!">
            <View style={styles.warningLead}>
              <Ionicons name="warning-outline" size={22} color={LDS_COLOR_ERROR} />
              <PremiumText variant="body" style={styles.warningText}>
                Hesabınızı sildiğinizde aşağıdaki verileriniz kalıcı olarak silinecektir.
              </PremiumText>
            </View>
          </SettingsHubCard>

          <SettingsHubCard title="Silinecek Veriler">
            {DATA_ITEMS.map((item, index) => (
              <View
                key={item.label}
                style={[styles.row, index === 0 && styles.rowFirst, index > 0 && hubSurfaces?.row]}
              >
                <View style={styles.rowLeft}>
                  <Ionicons name={item.icon} size={20} color={LDS_COLOR_ERROR} />
                  <PremiumText variant="body" style={styles.rowText}>
                    {item.label}
                  </PremiumText>
                </View>
              </View>
            ))}
          </SettingsHubCard>

          <SettingsHubCard title="Silme Süreci">
            <PremiumText variant="caption" muted style={styles.infoText}>
              • Hesabınız hemen devre dışı bırakılacaktır{'\n'}
              • Kişisel verileriniz 30 gün içinde silinecektir{'\n'}
              • Muhabbet mesajları ve ses verisi/ses kayıtları (özellik aktifse) ürün ve güvenlik operasyonları kapsamında 7 güne kadar saklanabilir{'\n'}
              • Yasal zorunluluklar kapsamındaki veriler anonimleştirilecektir{'\n'}
              • Bu işlem geri alınamaz
            </PremiumText>
          </SettingsHubCard>

          <Pressable
            style={({ pressed }) => [
              styles.deleteButton,
              hubSurfaces?.deleteButton,
              isDeleting && styles.btnDisabled,
              pressed && !isDeleting && styles.backBtnPressed,
            ]}
            onPress={handleDeleteAccount}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <ActivityIndicator color={LDS_COLOR_ERROR} />
            ) : (
              <>
                <Ionicons name="trash-outline" size={20} color={LDS_COLOR_ERROR} />
                <PremiumText variant="body" style={styles.deleteButtonText}>
                  Hesabımı Kalıcı Olarak Sil
                </PremiumText>
              </>
            )}
          </Pressable>

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

          <SettingsHubCard
            title="Yasal Metinler"
            footer={
              <PremiumText variant="caption" muted style={styles.company}>
                KVKK başvuru hakları ve destek için: info@karekodteknoloji.com / 0850 307 80 29
              </PremiumText>
            }
          >
            <SettingsHubRow
              isFirst
              icon="lock-closed-outline"
              label="Gizlilik Politikası"
              onPress={() => router.push('/privacy' as any)}
              ui={ui}
              hubSurfaces={hubSurfaces}
            />
            <SettingsHubRow
              icon="document-text-outline"
              label="Hizmet Şartları"
              onPress={() => router.push('/terms' as any)}
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
  warningLead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: LDS_SPACING.xs,
  },
  warningText: {
    flex: 1,
    flexShrink: 1,
    lineHeight: 22,
  },
  infoText: {
    lineHeight: 22,
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
  deleteButton: {
    minHeight: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: LDS_SPACING.xxs,
    backgroundColor: PREMIUM_ROLE_CARD_BG,
    borderWidth: StyleSheet.hairlineWidth + 1,
    borderColor: LDS_COLOR_ERROR,
  },
  deleteButtonText: {
    color: LDS_COLOR_ERROR,
    fontSize: 14,
    fontWeight: '600',
  },
  btnDisabled: {
    opacity: 0.65,
  },
});
