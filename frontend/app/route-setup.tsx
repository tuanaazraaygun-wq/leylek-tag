import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

/**
 * Güzergah kaydı (POST /api/routes) için giriş noktası.
 * İstemci formu ileride buraya taşınabilir; şimdilik sade ve net yönlendirme.
 */
export default function RouteSetupScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Güzergah</Text>
        <View style={{ width: 40 }} />
      </View>
      <View style={styles.body}>
        <Text style={styles.headline}>Rota ekle</Text>
        <Text style={styles.copy}>
          Güzergahını kaydettiğinde aynı hat üzerindeki kullanıcılarla eşleşir ve istersen otomatik gruba
          katılırsın. Kayıt şu an uygulama içinden tamamlanır; kısa süre içinde bu ekrandan devam
          edebileceksin.
        </Text>
        <TouchableOpacity style={styles.primary} onPress={() => router.back()} activeOpacity={0.85}>
          <Text style={styles.primaryText}>Tamam</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F2F2F7' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(60,60,67,0.12)',
  },
  back: { padding: 8, minWidth: 44, justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '600', color: '#111' },
  body: { paddingHorizontal: 22, paddingTop: 28 },
  headline: { fontSize: 28, fontWeight: '700', color: '#111', letterSpacing: -0.4, marginBottom: 12 },
  copy: { fontSize: 16, lineHeight: 22, color: '#6E6E73', marginBottom: 28 },
  primary: {
    alignSelf: 'flex-start',
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
      default: {},
    }),
  },
  primaryText: { color: '#FFF', fontSize: 17, fontWeight: '600' },
});
