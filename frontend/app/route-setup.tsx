import React, { useCallback, useState } from 'react';
import {
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  DeviceEventEmitter,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import PlacesAutocomplete, { type PlaceDetails } from '../components/PlacesAutocomplete';
import { ScreenHeaderGradient } from '../components/ScreenHeaderGradient';
import { GradientButton } from '../components/GradientButton';
import { API_BASE_URL } from '../lib/backendConfig';
import { getPersistedAccessToken } from '../lib/sessionToken';

const SURFACE = '#F2F2F7';
const TEXT_PRIMARY = '#111111';
const TEXT_SECONDARY = '#6E6E73';
const FIELD_BG = 'rgba(255,255,255,0.95)';

function formatApiError(data: unknown, fallback: string): string {
  if (!data || typeof data !== 'object') return fallback;
  const d = (data as { detail?: unknown }).detail;
  if (typeof d === 'string' && d.trim()) return d;
  if (Array.isArray(d) && d[0] && typeof d[0] === 'object' && d[0] !== null) {
    const m = (d[0] as { msg?: string }).msg;
    if (typeof m === 'string' && m.trim()) return m;
  }
  return fallback;
}

export default function RouteSetupScreen() {
  const router = useRouter();
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [start, setStart] = useState<PlaceDetails | null>(null);
  const [end, setEnd] = useState<PlaceDetails | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const cityTrim = city.trim();

  const onSubmit = useCallback(async () => {
    const token = (await getPersistedAccessToken())?.trim();
    if (!token) {
      Alert.alert('Oturum', 'Güzergah kaydetmek için giriş yapın.');
      return;
    }
    if (!cityTrim) {
      Alert.alert('Şehir', 'Şehir adını girin (ör. İstanbul).');
      return;
    }
    if (!start || !end) {
      Alert.alert('Rota', 'Başlangıç ve varış için listeden bir adres seçin.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/routes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          start_lat: start.latitude,
          start_lng: start.longitude,
          end_lat: end.latitude,
          end_lng: end.longitude,
          city: cityTrim,
          district: district.trim() || undefined,
        }),
      });
      const data: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        Alert.alert('Kayıt', formatApiError(data, 'Rota kaydedilemedi.'));
        return;
      }
      const dup = (data as { duplicate?: boolean }).duplicate === true;
      Alert.alert(
        dup ? 'Zaten kayıtlı' : 'Güzergahın yayında 🚀',
        dup
          ? 'Bu güzergahı daha önce kaydetmiştin. Teklif Sende tarafında aynı şekilde görünürsün.'
          : 'Artık aynı yolu kullanan insanları görebilirsin',
        [
          {
            text: 'Keşfe dön',
            style: 'cancel',
            onPress: () => router.back(),
          },
          {
            text: 'İnsanları gör',
            onPress: () => {
              DeviceEventEmitter.emit('leylek:open-community');
              router.back();
            },
          },
        ],
      );
    } catch {
      Alert.alert('Bağlantı', 'İstek gönderilemedi. Ağınızı kontrol edin.');
    } finally {
      setSubmitting(false);
    }
  }, [cityTrim, district, end, router, start]);

  return (
    <SafeAreaView style={styles.root} edges={['left', 'right', 'bottom']}>
      <ScreenHeaderGradient title="Güzergah" onBack={() => router.back()} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.lead}>
            Aynı hat üzerindeki kişilerle eşleşmek için başlangıç ve varışı seçin. İlçe alanı isteğe bağlıdır.
          </Text>

          <Text style={styles.label}>Şehir</Text>
          <TextInput
            style={styles.field}
            placeholder="Örn. İstanbul"
            placeholderTextColor={TEXT_SECONDARY}
            value={city}
            onChangeText={setCity}
            autoCapitalize="words"
          />

          <Text style={[styles.label, styles.labelSpaced]}>İlçe (isteğe bağlı)</Text>
          <TextInput
            style={styles.field}
            placeholder="Örn. Kadıköy"
            placeholderTextColor={TEXT_SECONDARY}
            value={district}
            onChangeText={setDistrict}
            autoCapitalize="words"
          />

          <Text style={[styles.label, styles.labelSpaced]}>Başlangıç</Text>
          {cityTrim ? (
            <PlacesAutocomplete
              key={`start-${cityTrim}`}
              city={cityTrim}
              strictCityBounds
              hidePopularChips
              placeholder="Adres ara..."
              onPlaceSelected={setStart}
            />
          ) : (
            <Text style={styles.hint}>Önce şehir adını yazın; arama o şehre göre daralır.</Text>
          )}
          {start ? (
            <Text style={styles.picked} numberOfLines={2}>
              {start.address}
            </Text>
          ) : null}

          <Text style={[styles.label, styles.labelSpaced]}>Varış</Text>
          {cityTrim ? (
            <PlacesAutocomplete
              key={`end-${cityTrim}`}
              city={cityTrim}
              strictCityBounds
              hidePopularChips
              placeholder="Varış noktası..."
              onPlaceSelected={setEnd}
            />
          ) : (
            <Text style={styles.hint}>Şehir girildikten sonra varış için arama açılır.</Text>
          )}
          {end ? (
            <Text style={styles.picked} numberOfLines={2}>
              {end.address}
            </Text>
          ) : null}

          <GradientButton
            label="Güzergahı kaydet"
            loading={submitting}
            onPress={() => void onSubmit()}
            style={styles.submit}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: SURFACE },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 12 },
  lead: {
    color: TEXT_SECONDARY,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
  },
  label: {
    color: TEXT_SECONDARY,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  labelSpaced: { marginTop: 18 },
  field: {
    backgroundColor: FIELD_BG,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: TEXT_PRIMARY,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60,60,67,0.12)',
  },
  hint: { color: TEXT_SECONDARY, fontSize: 14, marginTop: 4, fontStyle: 'italic' },
  picked: { color: TEXT_PRIMARY, fontSize: 14, marginTop: 8, lineHeight: 20 },
  submit: { marginTop: 28 },
});
