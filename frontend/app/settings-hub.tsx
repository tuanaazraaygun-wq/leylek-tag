import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { clearSessionStorage, getPersistedUserRaw } from '../lib/sessionToken';

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

export default function SettingsHubScreen() {
  const router = useRouter();
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
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color="#22D3EE" />
        </Pressable>
        <View style={styles.headerBody}>
          <Text style={styles.title}>Ayarlar</Text>
          <Text style={styles.subtitle}>Hesap, destek ve yasal bilgilerin burada.</Text>
          <Text style={styles.identity}>
            {displayName} • {roleLabel(user?.role)}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Profil</Text>
          <Pressable style={styles.row} onPress={openMyProfile}>
            <View style={styles.rowLeft}>
              <Ionicons name="person-circle-outline" size={20} color="#22D3EE" />
              <Text style={styles.rowText}>Profilim</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="rgba(148, 163, 184, 0.65)" />
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Destek</Text>
          <Text style={styles.company}>Karekod Teknoloji ve Yazılım A.Ş.</Text>
          <Pressable
            style={styles.row}
            onPress={() => {
              void openExternalLink('mailto:info@karekodteknoloji.com', 'E-posta açılamadı');
            }}
          >
            <View style={styles.rowLeft}>
              <Ionicons name="mail-outline" size={20} color="#22D3EE" />
              <Text style={styles.rowText}>info@karekodteknoloji.com</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="rgba(148, 163, 184, 0.65)" />
          </Pressable>
          <Pressable
            style={styles.row}
            onPress={() => {
              void openExternalLink('tel:08503078029', 'Telefon açılamadı');
            }}
          >
            <View style={styles.rowLeft}>
              <Ionicons name="call-outline" size={20} color="#22D3EE" />
              <Text style={styles.rowText}>0850 307 80 29</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="rgba(148, 163, 184, 0.65)" />
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Yasal</Text>
          <Pressable style={styles.row} onPress={() => router.push('/privacy' as any)}>
            <View style={styles.rowLeft}>
              <Ionicons name="lock-closed-outline" size={20} color="#22D3EE" />
              <Text style={styles.rowText}>Gizlilik Politikası</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="rgba(148, 163, 184, 0.65)" />
          </Pressable>
          <Pressable style={styles.row} onPress={() => router.push('/terms' as any)}>
            <View style={styles.rowLeft}>
              <Ionicons name="document-text-outline" size={20} color="#22D3EE" />
              <Text style={styles.rowText}>Kullanım Şartları</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="rgba(148, 163, 184, 0.65)" />
          </Pressable>
          <Pressable style={styles.row} onPress={() => router.push('/kvkk' as any)}>
            <View style={styles.rowLeft}>
              <Ionicons name="information-circle-outline" size={20} color="#22D3EE" />
              <Text style={styles.rowText}>KVKK</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="rgba(148, 163, 184, 0.65)" />
          </Pressable>
          <Pressable style={styles.row} onPress={() => router.push('/delete-account' as any)}>
            <View style={styles.rowLeft}>
              <Ionicons name="trash-outline" size={20} color="#DC2626" />
              <Text style={[styles.rowText, styles.dangerText]}>Hesap Silme Bilgilendirmesi</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="rgba(148, 163, 184, 0.65)" />
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Hesap</Text>
          <Pressable style={styles.row} onPress={() => router.push('/delete-account' as any)}>
            <View style={styles.rowLeft}>
              <Ionicons name="trash-outline" size={20} color="#DC2626" />
              <Text style={[styles.rowText, styles.dangerText]}>Hesabımı Sil</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="rgba(148, 163, 184, 0.65)" />
          </Pressable>
          <Pressable style={styles.row} onPress={() => void handleSafeLogout()}>
            <View style={styles.rowLeft}>
              <Ionicons name="log-out-outline" size={20} color="#DC2626" />
              <Text style={[styles.rowText, styles.dangerText]}>
                {logoutBusy ? 'Çıkış yapılıyor...' : 'Çıkış Yap'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="rgba(148, 163, 184, 0.65)" />
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#08111F' },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10, flexDirection: 'row', alignItems: 'flex-start' },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16, 26, 43, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(30, 58, 95, 0.85)',
  },
  headerBody: { marginLeft: 10, flex: 1 },
  title: { fontSize: 26, fontWeight: '800', color: 'rgba(243, 248, 255, 0.96)' },
  subtitle: { marginTop: 4, fontSize: 13, color: 'rgba(172, 188, 212, 0.92)' },
  identity: { marginTop: 6, fontSize: 13, color: 'rgba(203, 213, 225, 0.95)', fontWeight: '600' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 28, gap: 12 },
  card: {
    backgroundColor: 'rgba(16, 26, 43, 0.78)',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#1E3A5F',
    borderTopColor: 'rgba(34, 211, 238, 0.14)',
    shadowColor: '#010818',
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: 'rgba(243, 248, 255, 0.94)', marginBottom: 8 },
  company: { fontSize: 13, color: 'rgba(172, 188, 212, 0.9)', marginBottom: 6 },
  row: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(30, 58, 95, 0.55)',
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 9, flex: 1, paddingRight: 8 },
  rowText: { color: 'rgba(243, 248, 255, 0.93)', fontSize: 14, fontWeight: '600', flexShrink: 1 },
  dangerText: { color: 'rgba(248, 113, 113, 0.95)' },
});
