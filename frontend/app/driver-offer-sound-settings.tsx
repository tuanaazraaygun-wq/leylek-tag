import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getPersistedUserRaw } from '../lib/sessionToken';
import {
  DEFAULT_DRIVER_OFFER_SOUND,
  DEFAULT_DRIVER_OFFER_VOLUME,
  getDriverOfferSoundPreference,
  getDriverOfferSoundVolume,
  setDriverOfferSoundPreference,
  setDriverOfferSoundVolume,
  type DriverOfferSoundType,
} from '../lib/driverOfferSoundPrefs';
import { invalidateDriverOfferSoundCache, previewDriverOfferSound } from '../utils/sound';

type ScreenUser = {
  id?: string;
  role?: string;
};

const SOUND_OPTIONS: { id: DriverOfferSoundType; label: string; subtitle: string }[] = [
  { id: 'classic', label: 'Klasik', subtitle: 'Yumuşak teklif bildirimi' },
  { id: 'urgent', label: 'Dikkat Çekici', subtitle: 'Daha belirgin uyarı tonu' },
];

function volumeFromLocationX(locationX: number, trackWidth: number): number {
  if (trackWidth <= 0) return DEFAULT_DRIVER_OFFER_VOLUME;
  return Math.max(0, Math.min(1, locationX / trackWidth));
}

export default function DriverOfferSoundSettingsScreen() {
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [soundType, setSoundType] = useState<DriverOfferSoundType>(DEFAULT_DRIVER_OFFER_SOUND);
  const [volume, setVolume] = useState(DEFAULT_DRIVER_OFFER_VOLUME);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [trackWidth, setTrackWidth] = useState(0);
  const trackWidthRef = useRef(0);

  const volumePercent = useMemo(() => Math.round(volume * 100), [volume]);

  const loadPrefs = useCallback(async (uid: string) => {
    const [pref, vol] = await Promise.all([
      getDriverOfferSoundPreference(uid),
      getDriverOfferSoundVolume(uid),
    ]);
    setSoundType(pref);
    setVolume(vol);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const raw = await getPersistedUserRaw();
        if (!raw) {
          setLoading(false);
          return;
        }
        const parsed = JSON.parse(raw) as ScreenUser;
        const uid = String(parsed?.id || '').trim();
        if (!uid || parsed?.role !== 'driver') {
          setLoading(false);
          return;
        }
        setUserId(uid);
        await loadPrefs(uid);
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    })();
  }, [loadPrefs]);

  const handleTrackLayout = (event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    trackWidthRef.current = width;
    setTrackWidth(width);
  };

  const applyVolumeAtX = (locationX: number) => {
    setVolume(volumeFromLocationX(locationX, trackWidthRef.current || trackWidth));
  };

  const handleTestSound = async () => {
    if (testing) return;
    setTesting(true);
    try {
      await previewDriverOfferSound({
        userId: userId || undefined,
        type: soundType,
        volume,
      });
    } catch {
      Alert.alert('Ses testi', 'Ses çalınamadı. Lütfen tekrar deneyin.');
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!userId || saving) return;
    setSaving(true);
    try {
      await setDriverOfferSoundPreference(userId, soundType);
      const savedVolume = await setDriverOfferSoundVolume(userId, volume);
      setVolume(savedVolume);
      await invalidateDriverOfferSoundCache();
      Alert.alert('Kaydedildi', 'Teklif sesi ayarların güncellendi.');
    } catch {
      Alert.alert('Kaydet', 'Ayarlar kaydedilemedi. Lütfen tekrar deneyin.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color="#22D3EE" />
          </Pressable>
          <Text style={styles.title}>Teklif Sesi</Text>
        </View>
        <View style={styles.centerState}>
          <Text style={styles.centerStateText}>Yükleniyor…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!userId) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color="#22D3EE" />
          </Pressable>
          <Text style={styles.title}>Teklif Sesi</Text>
        </View>
        <View style={styles.centerState}>
          <Text style={styles.centerStateText}>Bu ekran yalnızca sürücü hesapları içindir.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color="#22D3EE" />
        </Pressable>
        <View style={styles.headerBody}>
          <Text style={styles.title}>Teklif Sesi</Text>
          <Text style={styles.subtitle}>Yeni teklif geldiğinde çalacak sesi özelleştirin.</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Ses Türü</Text>
          {SOUND_OPTIONS.map((option, index) => {
            const selected = soundType === option.id;
            return (
              <Pressable
                key={option.id}
                style={[styles.optionRow, index > 0 ? styles.optionRowBorder : null]}
                onPress={() => setSoundType(option.id)}
              >
                <View style={styles.optionLeft}>
                  <View style={[styles.radioOuter, selected ? styles.radioOuterSelected : null]}>
                    {selected ? <View style={styles.radioInner} /> : null}
                  </View>
                  <View style={styles.optionTextCol}>
                    <Text style={styles.optionLabel}>{option.label}</Text>
                    <Text style={styles.optionSubtitle}>{option.subtitle}</Text>
                  </View>
                </View>
                {selected ? <Ionicons name="checkmark-circle" size={20} color="#22D3EE" /> : null}
              </Pressable>
            );
          })}
        </View>

        <View style={styles.card}>
          <View style={styles.volumeHeader}>
            <Text style={styles.cardTitle}>Ses Seviyesi</Text>
            <Text style={styles.volumeValue}>{volumePercent}%</Text>
          </View>
          <View
            style={styles.sliderTrack}
            onLayout={handleTrackLayout}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderGrant={(event) => applyVolumeAtX(event.nativeEvent.locationX)}
            onResponderMove={(event) => applyVolumeAtX(event.nativeEvent.locationX)}
          >
            <View style={[styles.sliderFill, { width: `${volume * 100}%` }]} />
            <View
              style={[
                styles.sliderThumb,
                { left: Math.max(0, Math.min(trackWidth - 18, volume * trackWidth - 9)) },
              ]}
            />
          </View>
          <Text style={styles.volumeHint}>Varsayılan: %65</Text>
        </View>

        <Pressable
          style={[styles.secondaryBtn, testing ? styles.btnDisabled : null]}
          onPress={() => void handleTestSound()}
          disabled={testing}
        >
          <Ionicons name="volume-high-outline" size={18} color="#22D3EE" />
          <Text style={styles.secondaryBtnText}>{testing ? 'Çalınıyor…' : 'Sesi Test Et'}</Text>
        </Pressable>

        <Pressable
          style={[styles.primaryBtn, saving ? styles.btnDisabled : null]}
          onPress={() => void handleSave()}
          disabled={saving}
        >
          <Text style={styles.primaryBtnText}>{saving ? 'Kaydediliyor…' : 'Kaydet'}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#08111F' },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
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
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 28, gap: 12 },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  centerStateText: { color: 'rgba(172, 188, 212, 0.92)', fontSize: 14, textAlign: 'center' },
  card: {
    backgroundColor: 'rgba(16, 26, 43, 0.78)',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#1E3A5F',
    borderTopColor: 'rgba(34, 211, 238, 0.14)',
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: 'rgba(243, 248, 255, 0.94)' },
  optionRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
  },
  optionRowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(30, 58, 95, 0.55)',
    marginTop: 4,
  },
  optionLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, paddingRight: 8 },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(148, 163, 184, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: { borderColor: '#22D3EE' },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#22D3EE' },
  optionTextCol: { flex: 1 },
  optionLabel: { color: 'rgba(243, 248, 255, 0.93)', fontSize: 15, fontWeight: '700' },
  optionSubtitle: { marginTop: 2, color: 'rgba(172, 188, 212, 0.88)', fontSize: 12 },
  volumeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  volumeValue: { color: '#22D3EE', fontSize: 15, fontWeight: '800' },
  sliderTrack: {
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(8, 17, 31, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(30, 58, 95, 0.85)',
    justifyContent: 'center',
    overflow: 'visible',
  },
  sliderFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 18,
    backgroundColor: 'rgba(34, 211, 238, 0.35)',
  },
  sliderThumb: {
    position: 'absolute',
    top: 9,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#22D3EE',
    borderWidth: 2,
    borderColor: '#08111F',
  },
  volumeHint: { marginTop: 8, fontSize: 12, color: 'rgba(148, 163, 184, 0.85)' },
  secondaryBtn: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.35)',
    backgroundColor: 'rgba(16, 26, 43, 0.78)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryBtnText: { color: '#22D3EE', fontSize: 15, fontWeight: '700' },
  primaryBtn: {
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: '#0891B2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { color: '#F8FAFC', fontSize: 16, fontWeight: '800' },
  btnDisabled: { opacity: 0.65 },
});
