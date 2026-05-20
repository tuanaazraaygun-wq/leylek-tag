/**
 * Geçici iOS TestFlight debug paneli — GPS / socket / route / chat durumu.
 * Production kullanıcıya görünmez (isTestFlightDebugPanelEnabled gate).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSocketContext } from '../contexts/SocketContext';
import { getSupabase } from '../lib/supabase';
import { isTestFlightDebugPanelEnabled } from '../lib/testFlightDebug';

export type TestFlightDebugTagSnapshot = {
  id?: string | null;
  status?: string | null;
  pickup_lat?: unknown;
  pickup_lng?: unknown;
  driver_location?: { latitude?: unknown; longitude?: unknown } | null;
  driver_lat?: unknown;
  driver_lng?: unknown;
  driver_latitude?: unknown;
  driver_longitude?: unknown;
  route_info?: Record<string, unknown> | null;
  pickup_distance_km?: unknown;
  pickup_eta_min?: unknown;
} | null;

type TestFlightDebugPanelProps = {
  role: 'driver' | 'passenger';
  userLocation: { latitude: number; longitude: number } | null;
  activeTag: TestFlightDebugTagSnapshot;
  chatVisible?: boolean;
};

function boolLine(label: string, value: boolean): string {
  return `${label}: ${value ? 'YES' : 'no'}`;
}

function hasValidCoordPair(lat: unknown, lng: unknown): boolean {
  const la = Number(lat);
  const ln = Number(lng);
  return Number.isFinite(la) && Number.isFinite(ln) && !(Math.abs(la) < 1e-6 && Math.abs(ln) < 1e-6);
}

function tagHasDriverLocation(tag: TestFlightDebugTagSnapshot): boolean {
  if (!tag) return false;
  const dl = tag.driver_location;
  if (dl && hasValidCoordPair(dl.latitude, dl.longitude)) return true;
  return hasValidCoordPair(
    tag.driver_lat ?? tag.driver_latitude,
    tag.driver_lng ?? tag.driver_longitude,
  );
}

function tagHasPickup(tag: TestFlightDebugTagSnapshot): boolean {
  if (!tag) return false;
  return hasValidCoordPair(tag.pickup_lat, tag.pickup_lng);
}

function tagHasRoutePolyline(tag: TestFlightDebugTagSnapshot): boolean {
  if (!tag?.route_info || typeof tag.route_info !== 'object') return false;
  const ri = tag.route_info;
  const op = ri.overview_polyline ?? ri.polyline;
  if (typeof op === 'string' && op.length > 2) return true;
  const coords = ri.coordinates;
  return Array.isArray(coords) && coords.length >= 2;
}

function tagHasRouteMetrics(tag: TestFlightDebugTagSnapshot): boolean {
  if (!tag) return false;
  const km = Number(tag.pickup_distance_km);
  const min = Number(tag.pickup_eta_min);
  return Number.isFinite(km) && km > 0 && Number.isFinite(min) && min > 0;
}

export default function TestFlightDebugPanel({
  role,
  userLocation,
  activeTag,
  chatVisible = false,
}: TestFlightDebugPanelProps) {
  const insets = useSafeAreaInsets();
  const { isConnected, isRegistered } = useSocketContext();
  const [collapsed, setCollapsed] = useState(false);
  const [locPerm, setLocPerm] = useState<string>('…');
  const [hasLastKnown, setHasLastKnown] = useState(false);
  const [tick, setTick] = useState(0);

  const enabled = isTestFlightDebugPanelEnabled();

  const pollLocation = useCallback(async () => {
    try {
      const perm = await Location.getForegroundPermissionsAsync();
      setLocPerm(perm.status);
    } catch {
      setLocPerm('error');
    }
    try {
      const last = await Location.getLastKnownPositionAsync();
      setHasLastKnown(!!last?.coords);
    } catch {
      setHasLastKnown(false);
    }
    setTick((t) => t + 1);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void pollLocation();
    const id = setInterval(() => {
      void pollLocation();
    }, 3000);
    return () => clearInterval(id);
  }, [enabled, pollLocation]);

  const lines = useMemo(() => {
    const hasUserLocation = !!(
      userLocation &&
      Number.isFinite(userLocation.latitude) &&
      Number.isFinite(userLocation.longitude)
    );
    const supabaseOk = !!getSupabase();
    return [
      `role: ${role}`,
      `platform: ${Platform.OS}`,
      `refresh: ${tick}`,
      '— GPS —',
      `locPermission: ${locPerm}`,
      boolLine('hasUserLocation', hasUserLocation),
      boolLine('hasLastKnownPosition', hasLastKnown),
      '— TAG / ROUTE —',
      `tagId: ${activeTag?.id ? String(activeTag.id).slice(0, 12) : 'null'}`,
      `tagStatus: ${activeTag?.status ?? 'null'}`,
      boolLine('tagPickupCoords', tagHasPickup(activeTag)),
      boolLine('tagDriverLocation', tagHasDriverLocation(activeTag)),
      boolLine('routeInfoPolyline', tagHasRoutePolyline(activeTag)),
      boolLine('routeInfoKmMin', tagHasRouteMetrics(activeTag)),
      '— SOCKET —',
      boolLine('socketConnected', isConnected),
      boolLine('socketRegistered', isRegistered),
      '— CHAT —',
      boolLine('supabaseEnv', supabaseOk),
      boolLine('chatSheetOpen', chatVisible),
    ];
  }, [
    role,
    tick,
    locPerm,
    hasLastKnown,
    userLocation,
    activeTag,
    isConnected,
    isRegistered,
    chatVisible,
  ]);

  if (!enabled) return null;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.root, { bottom: Math.max(insets.bottom, 8) + 72 }]}
    >
      <Pressable
        onPress={() => setCollapsed((c) => !c)}
        style={styles.header}
        accessibilityRole="button"
        accessibilityLabel={collapsed ? 'TestFlight debug panelini aç' : 'TestFlight debug panelini kapat'}
      >
        <Text style={styles.headerText}>
          TF DEBUG {collapsed ? '▸' : '▾'} ({Platform.OS})
        </Text>
      </Pressable>
      {!collapsed ? (
        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          nestedScrollEnabled
          pointerEvents="auto"
        >
          {lines.map((line) => (
            <Text key={line} style={styles.line}>
              {line}
            </Text>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: 8,
    right: 8,
    zIndex: 99990,
    elevation: 99990,
    maxHeight: '42%',
  },
  header: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(127, 29, 29, 0.92)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.45)',
  },
  headerText: {
    color: '#fecaca',
    fontSize: 11,
    fontWeight: '800',
  },
  body: {
    marginTop: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.88)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.35)',
    maxHeight: 220,
  },
  bodyContent: {
    padding: 8,
  },
  line: {
    color: '#e2e8f0',
    fontSize: 9,
    lineHeight: 13,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
