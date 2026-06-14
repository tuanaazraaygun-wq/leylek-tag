import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { PremiumGradientCtaButton } from '../components/auth/premiumAuthChrome';
import {
  PREMIUM_AUTH_CYAN,
  PREMIUM_NAVY_DEEP,
  PREMIUM_ROLE_CARD_BG,
  PREMIUM_ROLE_CARD_BORDER,
  PREMIUM_TEXT_MUTED,
} from '../components/auth/premiumAuthStyles';
import {
  CockpitBackground,
  GlassSurface,
  PremiumText,
} from '../design-system/primitives';
import { LDS_SPACING } from '../design-system/tokens/spacing';
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

  const renderHeader = (subtitle?: string) => (
    <GlassSurface variant="header" style={styles.headerGlass}>
      <View style={styles.header}>
        <Pressable
          style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={20} color={PREMIUM_AUTH_CYAN} />
        </Pressable>
        <View style={styles.headerBody}>
          <PremiumText variant="headline" style={styles.title}>
            Teklif Sesi
          </PremiumText>
          {subtitle ? (
            <PremiumText variant="caption" muted style={styles.subtitle}>
              {subtitle}
            </PremiumText>
          ) : null}
        </View>
      </View>
    </GlassSurface>
  );

  const renderShell = (body: React.ReactNode) => (
    <View style={styles.screen}>
      <CockpitBackground />
      <SafeAreaView style={styles.safe}>
        {renderHeader(
          loading || !userId ? undefined : 'Yeni teklif geldiğinde çalacak sesi özelleştirin.',
        )}
        {body}
      </SafeAreaView>
    </View>
  );

  if (loading) {
    return renderShell(
      <View style={styles.centerState}>
        <PremiumText variant="caption" muted style={styles.centerStateText}>
          Yükleniyor…
        </PremiumText>
      </View>,
    );
  }

  if (!userId) {
    return renderShell(
      <View style={styles.centerState}>
        <PremiumText variant="caption" muted style={styles.centerStateText}>
          Bu ekran yalnızca sürücü hesapları içindir.
        </PremiumText>
      </View>,
    );
  }

  return renderShell(
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <SettingsHubCard title="Ses Türü">
        {SOUND_OPTIONS.map((option, index) => {
          const selected = soundType === option.id;
          return (
            <Pressable
              key={option.id}
              style={({ pressed }) => [
                styles.row,
                index === 0 && styles.rowFirst,
                pressed && styles.rowPressed,
              ]}
              onPress={() => setSoundType(option.id)}
            >
              <View style={styles.rowLeft}>
                <View style={[styles.radioOuter, selected ? styles.radioOuterSelected : null]}>
                  {selected ? <View style={styles.radioInner} /> : null}
                </View>
                <View style={styles.optionTextCol}>
                  <PremiumText variant="body" style={styles.rowText}>
                    {option.label}
                  </PremiumText>
                  <PremiumText variant="caption" muted>
                    {option.subtitle}
                  </PremiumText>
                </View>
              </View>
              {selected ? <Ionicons name="checkmark-circle" size={20} color={PREMIUM_AUTH_CYAN} /> : null}
            </Pressable>
          );
        })}
      </SettingsHubCard>

      <GlassSurface variant="plain" style={styles.card}>
        <View style={styles.volumeHeader}>
          <PremiumText variant="title" style={styles.volumeCardTitle}>
            Ses Seviyesi
          </PremiumText>
          <PremiumText variant="body" style={styles.volumeValue}>
            {volumePercent}%
          </PremiumText>
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
        <PremiumText variant="caption" muted style={styles.volumeHint}>
          Varsayılan: %65
        </PremiumText>
      </GlassSurface>

      <Pressable
        style={({ pressed }) => [
          styles.secondaryBtn,
          testing && styles.btnDisabled,
          pressed && !testing && styles.backBtnPressed,
        ]}
        onPress={() => void handleTestSound()}
        disabled={testing}
      >
        <Ionicons name="volume-high-outline" size={18} color={PREMIUM_AUTH_CYAN} />
        <PremiumText variant="body" style={styles.secondaryBtnText}>
          {testing ? 'Çalınıyor…' : 'Sesi Test Et'}
        </PremiumText>
      </Pressable>

      <PremiumGradientCtaButton
        label={saving ? 'Kaydediliyor…' : 'Kaydet'}
        disabled={saving}
        busy={saving}
        onPress={() => void handleSave()}
      />
    </ScrollView>,
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
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: LDS_SPACING.xl,
  },
  centerStateText: {
    textAlign: 'center',
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
  optionTextCol: {
    flex: 1,
    minWidth: 0,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: PREMIUM_TEXT_MUTED,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: PREMIUM_AUTH_CYAN,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: PREMIUM_AUTH_CYAN,
  },
  volumeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: LDS_SPACING.xs,
  },
  volumeCardTitle: {
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  volumeValue: {
    color: PREMIUM_AUTH_CYAN,
    fontSize: 14,
    fontWeight: '600',
  },
  sliderTrack: {
    height: 36,
    borderRadius: 14,
    backgroundColor: PREMIUM_NAVY_DEEP,
    borderWidth: StyleSheet.hairlineWidth + 1,
    borderColor: PREMIUM_ROLE_CARD_BORDER,
    justifyContent: 'center',
    overflow: 'visible',
  },
  sliderFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 14,
    backgroundColor: 'rgba(34, 211, 238, 0.35)',
  },
  sliderThumb: {
    position: 'absolute',
    top: 9,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: PREMIUM_AUTH_CYAN,
    borderWidth: 2,
    borderColor: PREMIUM_NAVY_DEEP,
  },
  volumeHint: {
    marginTop: LDS_SPACING.xxs,
  },
  secondaryBtn: {
    minHeight: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: LDS_SPACING.xxs,
    backgroundColor: PREMIUM_ROLE_CARD_BG,
    borderWidth: StyleSheet.hairlineWidth + 1,
    borderColor: PREMIUM_ROLE_CARD_BORDER,
  },
  secondaryBtnText: {
    color: PREMIUM_AUTH_CYAN,
    fontSize: 14,
    fontWeight: '600',
  },
  btnDisabled: {
    opacity: 0.65,
  },
});
