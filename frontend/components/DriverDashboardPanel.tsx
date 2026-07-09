import React, { useState, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { API_BASE_URL } from '../lib/backendConfig';
import { GlassSurface, PremiumText } from '../design-system/primitives';
import { LDS_BORDER_WIDTH } from '../design-system/tokens/border';
import { LDS_ELEVATION } from '../design-system/tokens/elevation';
import { LDS_RADIUS } from '../design-system/tokens/radius';
import { LDS_SPACING } from '../design-system/tokens/spacing';
import { useDriverTheme } from '../lib/theme/useDriverTheme';
import DriverCockpitQuickStrip from './superUx/DriverCockpitQuickStrip';

interface DriverDashboardPanelProps {
  userId: string;
  onPackagePress: () => void;
  onToggleOnline?: (isOnline: boolean) => void;
  onTrustedPress?: () => void;
}

interface DashboardData {
  active_time: {
    is_active: boolean;
    is_online: boolean;
  };
}

const PANEL_HEIGHT = 44;
const ONLINE_HERO_HEIGHT = 76;

export default function DriverDashboardPanel({
  userId,
  onPackagePress,
  onToggleOnline,
  onTrustedPress,
}: DriverDashboardPanelProps) {
  const { dashboardPanelSurfaces: dpLt, ui } = useDriverTheme();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    fetchDashboard();
    const refreshInterval = setInterval(fetchDashboard, 60000);
    return () => clearInterval(refreshInterval);
  }, [userId]);

  const normalizeDashboard = (raw: any): DashboardData | null => {
    if (!raw || raw.success !== true || !raw.active_time || typeof raw.active_time !== 'object') {
      return null;
    }
    return {
      active_time: {
        is_active: !!raw.active_time.is_active,
        is_online: !!raw.active_time.is_online,
      },
    };
  };

  const fetchDashboard = async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/driver/dashboard?user_id=${userId}`);
      const result = await response.json();
      const safe = normalizeDashboard(result);
      if (safe) {
        setData(safe);
      } else {
        setData(null);
      }
    } catch (error) {
      console.error('Dashboard fetch error:', error);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const toggleOnline = async () => {
    if (!data) return;

    setToggling(true);
    try {
      const endpoint = data.active_time.is_online ? 'go-offline' : 'go-online';
      const response = await fetch(`${API_BASE_URL}/driver/${endpoint}?user_id=${userId}`, { method: 'POST' });
      const result = await response.json();

      if (result.success) {
        setData(prev => prev ? {
          ...prev,
          active_time: { ...prev.active_time, is_online: !prev.active_time.is_online }
        } : null);
        onToggleOnline?.(!data.active_time.is_online);
      } else if (String(result.detail ?? '').toLowerCase().includes('paket')) {
        onPackagePress();
      }
    } catch (error) {
      console.error('Toggle online error:', error);
    } finally {
      setToggling(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.stack}>
        <View style={styles.onlineHeroWrap}>
          <GlassSurface variant="plain" style={[styles.onlineHeroLoading, dpLt.onlineStripLoading]} borderRadius={LDS_RADIUS.xl}>
            <ActivityIndicator size="small" color={ui.activity} />
          </GlassSurface>
        </View>
        <View style={styles.container}>
          <GlassSurface variant="panel" style={[styles.panelShellLoading, dpLt.panelShellLoading]} borderRadius={LDS_RADIUS.xl}>
            <ActivityIndicator size="small" color={ui.activity} />
          </GlassSurface>
        </View>
      </View>
    );
  }

  if (!data) return null;

  const isOnline = data.active_time.is_online;
  const availabilityLabel = isOnline ? 'Çevrimiçi' : 'Çevrimdışı';
  const onlineActionLabel = isOnline ? 'Çevrimdışı ol' : 'Çevrimiçi ol';
  const onlineStatusHint = isOnline
    ? 'Yolculuk fırsatlarını almaya hazırsın'
    : 'Çevrimiçi olunca talepler gelir';

  return (
    <View style={styles.stack}>
      <View style={styles.onlineHeroWrap}>
        <GlassSurface
          variant="plain"
          style={[
            styles.onlineHero,
            isOnline ? dpLt.onlineStripActive : dpLt.onlineStripInactive,
          ]}
          borderRadius={LDS_RADIUS.xl}
        >
          <View style={styles.onlineHeroLeft}>
            <View style={[styles.statusDot, isOnline ? dpLt.statusDotOnline : dpLt.statusDotOffline]} />
            <View style={styles.onlineTextCol}>
              <PremiumText variant="headline" style={[styles.onlineStatusLabel, dpLt.onlineStatusLabel]}>
                {availabilityLabel}
              </PremiumText>
              <PremiumText variant="caption" muted style={[styles.onlineStatusHint, dpLt.onlineStatusHint]} numberOfLines={2}>
                {onlineStatusHint}
              </PremiumText>
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.switchTrack,
              isOnline ? styles.switchTrackAlignEnd : styles.switchTrackAlignStart,
              isOnline ? dpLt.switchTrackOn : dpLt.switchTrackOff,
              (toggling || !data.active_time.is_active) && styles.switchTrackDisabled,
            ]}
            onPress={toggleOnline}
            disabled={toggling || !data.active_time.is_active}
            activeOpacity={0.92}
            accessibilityRole="switch"
            accessibilityLabel={onlineActionLabel}
            accessibilityState={{
              checked: isOnline,
              disabled: toggling || !data.active_time.is_active,
            }}
          >
            {toggling ? (
              <ActivityIndicator size="small" color={ui.textSoft} style={styles.switchSpinner} />
            ) : (
              <View
                style={[
                  styles.switchThumb,
                  isOnline ? dpLt.switchThumbOn : dpLt.switchThumbOff,
                ]}
              />
            )}
          </TouchableOpacity>
        </GlassSurface>
      </View>

      <View style={[styles.container, { height: PANEL_HEIGHT }]}>
        <GlassSurface variant="panel" style={[styles.panelShell, dpLt.panelShell]} borderRadius={LDS_RADIUS.xl}>
          <View style={styles.quickLinkPad}>
            <DriverCockpitQuickStrip embedded onTrustedPress={onTrustedPress} />
          </View>
        </GlassSurface>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: LDS_SPACING.xs,
  },
  onlineHeroWrap: {
    marginHorizontal: 0,
  },
  onlineHero: {
    minHeight: ONLINE_HERO_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: LDS_SPACING.sm,
    paddingHorizontal: LDS_SPACING.md,
    gap: LDS_SPACING.md,
    borderWidth: LDS_BORDER_WIDTH.standard,
  },
  onlineHeroLoading: {
    minHeight: ONLINE_HERO_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineHeroLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: LDS_SPACING.sm,
  },
  onlineTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  onlineStatusLabel: {
    letterSpacing: -0.2,
  },
  onlineStatusHint: {
    letterSpacing: 0.02,
  },
  switchTrack: {
    width: 64,
    height: 36,
    borderRadius: LDS_RADIUS.full,
    borderWidth: LDS_BORDER_WIDTH.standard,
    justifyContent: 'center',
    paddingHorizontal: 4,
    flexShrink: 0,
  },
  switchTrackAlignEnd: {
    alignItems: 'flex-end',
  },
  switchTrackAlignStart: {
    alignItems: 'flex-start',
  },
  switchTrackDisabled: {
    opacity: 0.55,
  },
  switchThumb: {
    width: 28,
    height: 28,
    borderRadius: LDS_RADIUS.full,
    borderWidth: LDS_BORDER_WIDTH.hairline,
  },
  switchSpinner: {
    alignSelf: 'center',
  },
  container: {
    marginHorizontal: 0,
    overflow: 'hidden',
    ...LDS_ELEVATION.panel,
  },
  panelShell: {
    flex: 1,
    justifyContent: 'center',
  },
  panelShellLoading: {
    minHeight: PANEL_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: LDS_SPACING.sm,
  },
  quickLinkPad: {
    paddingHorizontal: LDS_SPACING.sm,
    paddingVertical: 2,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: LDS_RADIUS.full,
    borderWidth: LDS_BORDER_WIDTH.hairline,
    flexShrink: 0,
  },
});
