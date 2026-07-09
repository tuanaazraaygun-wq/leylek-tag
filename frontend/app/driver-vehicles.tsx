import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import DriverKYCScreen from '../components/DriverKYCScreen';
import {
  PREMIUM_AUTH_CYAN,
  PREMIUM_NAVY_DEEP,
  PREMIUM_ROLE_CARD_BORDER,
  PREMIUM_TEXT_MUTED,
} from '../components/auth/premiumAuthStyles';
import {
  CockpitBackground,
  GlassSurface,
  PremiumText,
} from '../design-system/primitives';
import { LDS_COLOR_ERROR } from '../design-system/tokens/color';
import { LDS_SPACING } from '../design-system/tokens/spacing';
import { appAlert } from '../contexts/AppAlertContext';
import { API_BASE_URL } from '../lib/backendConfig';
import {
  getDriverVehicleRegistryRows,
  mergeDriverVehicleRegistrySnapshot,
  type DriverKycStatusResponse,
  type DriverVehicleKind,
  type DriverVehicleRegistryRow,
  vehicleKindIcon,
} from '../lib/driverVehicleRegistry';
import { getPersistedUserRaw } from '../lib/sessionToken';
import { useSettingsTheme } from '../lib/theme/useSettingsTheme';

type ScreenUser = {
  id?: string;
  name?: string;
  full_name?: string;
  role?: string;
  driver_details?: Record<string, unknown>;
};

const VEHICLE_STATUS_APPROVED = '#86EFAC';

function statusColor(state: DriverVehicleRegistryRow['state']): string {
  if (state === 'approved') return VEHICLE_STATUS_APPROVED;
  if (state === 'pending') return PREMIUM_AUTH_CYAN;
  if (state === 'rejected') return LDS_COLOR_ERROR;
  return PREMIUM_TEXT_MUTED;
}

type VehicleRowProps = {
  row: DriverVehicleRegistryRow;
  isFirst: boolean;
  onApply: (kind: DriverVehicleKind) => void;
};

function VehicleRegistryRow({ row, isFirst, onApply }: VehicleRowProps) {
  const iconName = vehicleKindIcon(row.kind);

  return (
    <View style={[styles.row, isFirst && styles.rowFirst]}>
      <View style={styles.rowMain}>
        <View style={styles.rowLeft}>
          <Ionicons name={iconName} size={20} color={PREMIUM_AUTH_CYAN} />
          <View style={styles.rowTextCol}>
            <PremiumText variant="body" style={styles.rowTitle}>
              {row.title}
            </PremiumText>
            <PremiumText variant="caption" style={[styles.rowStatus, { color: statusColor(row.state) }]}>
              {row.statusLabel}
            </PremiumText>
          </View>
        </View>
        {row.canApply && row.actionLabel ? (
          <Pressable
            style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]}
            onPress={() => onApply(row.kind)}
          >
            <PremiumText variant="caption" style={styles.actionBtnText}>
              {row.actionLabel}
            </PremiumText>
            <Ionicons name="chevron-forward" size={16} color={PREMIUM_AUTH_CYAN} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export default function DriverVehiclesScreen() {
  const router = useRouter();
  const { hubSurfaces, ui } = useSettingsTheme('settings');
  const [user, setUser] = useState<ScreenUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [kycStatus, setKycStatus] = useState<DriverKycStatusResponse | null>(null);
  const [activeKycKind, setActiveKycKind] = useState<DriverVehicleKind | null>(null);

  const refreshStatus = useCallback(async (screenUser: ScreenUser) => {
    const uid = String(screenUser.id || '').trim();
    if (!uid) return;
    const res = await fetch(`${API_BASE_URL}/driver/kyc/status?user_id=${encodeURIComponent(uid)}`);
    if (!res.ok) return;
    const data = (await res.json()) as DriverKycStatusResponse;
    setKycStatus(data);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const raw = await getPersistedUserRaw();
        if (!raw) return;
        const parsed = JSON.parse(raw) as ScreenUser;
        setUser(parsed);
        if (String(parsed.id || '').trim() && parsed.role === 'driver') {
          await refreshStatus(parsed);
        }
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [refreshStatus]);

  const registrySnapshot = useMemo(
    () => mergeDriverVehicleRegistrySnapshot(kycStatus, user?.driver_details),
    [kycStatus, user?.driver_details],
  );

  const rows = useMemo(
    () => getDriverVehicleRegistryRows(registrySnapshot),
    [registrySnapshot],
  );

  const handleApply = useCallback((kind: DriverVehicleKind) => {
    setActiveKycKind(kind);
  }, []);

  const handleKycBack = useCallback(() => {
    setActiveKycKind(null);
  }, []);

  const handleKycSuccess = useCallback(async () => {
    setActiveKycKind(null);
    if (user) {
      setRefreshing(true);
      try {
        await refreshStatus(user);
      } finally {
        setRefreshing(false);
      }
    }
    appAlert(
      '✅ Başvuru Alındı',
      'Başvurunuz inceleniyor. Onaylandığında bu araç türü için teklif alabilirsiniz.',
      [{ text: 'Tamam' }],
    );
  }, [refreshStatus, user]);

  const userId = String(user?.id || '').trim();
  const userName = (user?.full_name || user?.name || 'Kullanıcı').trim();
  const isDriver = user?.role === 'driver';

  if (activeKycKind && userId) {
    return (
      <DriverKYCScreen
        userId={userId}
        userName={userName}
        vehicleKind={activeKycKind}
        apiUrl={API_BASE_URL}
        onBack={handleKycBack}
        onSuccess={() => {
          void handleKycSuccess();
        }}
      />
    );
  }

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
                Araçlarım
              </PremiumText>
              <PremiumText variant="caption" muted style={styles.subtitle}>
                Onaylı araç türlerinizi görün ve eksik kayıt başvurusu yapın.
              </PremiumText>
            </View>
          </View>
        </GlassSurface>

        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator color={PREMIUM_AUTH_CYAN} />
          </View>
        ) : !isDriver || !userId ? (
          <View style={styles.centerState}>
            <PremiumText variant="body" muted style={styles.centerStateText}>
              Bu ekran yalnızca sürücü hesapları için kullanılabilir.
            </PremiumText>
          </View>
        ) : (
          <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
            <GlassSurface variant="plain" style={styles.card}>
              <PremiumText variant="title" style={styles.cardTitle}>
                Kayıtlı araç türleri
              </PremiumText>
              {refreshing ? (
                <View style={styles.refreshRow}>
                  <ActivityIndicator size="small" color={PREMIUM_AUTH_CYAN} />
                  <PremiumText variant="caption" muted>
                    Durum güncelleniyor…
                  </PremiumText>
                </View>
              ) : null}
              {rows.map((row, index) => (
                <VehicleRegistryRow
                  key={row.kind}
                  row={row}
                  isFirst={index === 0}
                  onApply={handleApply}
                />
              ))}
            </GlassSurface>
            <PremiumText variant="caption" muted style={styles.footerNote}>
              Onaylanmamış araç türleri teklif almak için kullanılamaz. Başvurunuz incelendikten sonra
              ilgili tür aktif hale gelir.
            </PremiumText>
          </ScrollView>
        )}
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: LDS_SPACING.sm,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  backBtnPressed: {
    opacity: 0.85,
  },
  headerBody: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  subtitle: {
    marginTop: 4,
    lineHeight: 18,
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
  refreshRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LDS_SPACING.xs,
    marginBottom: LDS_SPACING.xs,
  },
  row: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: PREMIUM_ROLE_CARD_BORDER,
    paddingVertical: LDS_SPACING.sm,
  },
  rowFirst: {
    borderTopWidth: 0,
    paddingTop: 0,
  },
  rowMain: {
    gap: LDS_SPACING.xs,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    flex: 1,
  },
  rowTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  rowStatus: {
    fontSize: 13,
    lineHeight: 18,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  actionBtnPressed: {
    opacity: 0.85,
  },
  actionBtnText: {
    color: PREMIUM_AUTH_CYAN,
    fontWeight: '600',
  },
  footerNote: {
    lineHeight: 18,
    paddingHorizontal: LDS_SPACING.xxs,
  },
});
