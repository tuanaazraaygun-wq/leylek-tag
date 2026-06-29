import React, { memo, useCallback } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { appAlert } from '../../contexts/AppAlertContext';
import {
  PREMIUM_AUTH_CYAN,
  PREMIUM_BORDER_SLATE,
  PREMIUM_TEXT_MUTED,
  PREMIUM_TEXT_SOFT,
} from '../auth/premiumAuthStyles';
import { PremiumText } from '../../design-system/primitives';
import {
  ACTION_CANCEL,
  ACTION_REMOVE,
  CONFIRM_REVOKE_TITLE,
  formatTieInsightLine,
  TDM_REQUEST_BUSY,
  TDM_NOTIFY_CTA,
} from '../../lib/trustedHubCopy';
import {
  isTrustedDirectRequestEligible,
  type TrustedConnectionItem,
  type TrustedConnectionRadarState,
  type TdmDriverAvailability,
  type TdmDriverUiState,
} from '../../lib/trustedNetworkApi';
import type { TrustedHubRole } from '../../lib/trustedHubCopy';

function buildRadarInsightLine(radar: NonNullable<TrustedConnectionItem['radar']>): string | null {
  const parts: string[] = [];
  const label = (radar.radar_label || '').trim();
  const subtitle = (radar.radar_subtitle || '').trim();
  if (label) parts.push(label);
  if (subtitle) parts.push(subtitle);
  return parts.length > 0 ? parts.join(' · ') : null;
}

function resolveRadarDotStyle(state: TrustedConnectionRadarState | undefined) {
  switch (state) {
    case 'TRUST_READY':
      return styles.radarDotReady;
    case 'TRUST_ON_TRIP':
      return styles.radarDotOnTrip;
    default:
      return styles.radarDotMuted;
  }
}

function resolveTdmDotStyle(uiState: TdmDriverUiState) {
  switch (uiState) {
    case 'online':
      return styles.tdmDotOnline;
    case 'busy':
      return styles.tdmDotBusy;
    default:
      return styles.tdmDotOffline;
  }
}

function shouldShowRadarInsight(
  hubRole: TrustedHubRole | undefined,
  item: TrustedConnectionItem,
  tdmAvailability: TdmDriverAvailability | null | undefined,
): boolean {
  if (tdmAvailability) return false;
  if (!item.radar) return false;
  if (hubRole === 'passenger' && item.role === 'driver') return true;
  return false;
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'LK';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
}

function TrustedAvatar({
  displayName,
  photoUri,
}: {
  displayName: string;
  photoUri: string | null;
}) {
  const uri = (photoUri || '').trim();
  if (uri) {
    return (
      <View style={styles.avatarRing}>
        <Image source={{ uri }} style={styles.avatarImage} />
      </View>
    );
  }
  return (
    <View style={styles.avatarRing}>
      <View style={styles.avatarFallback}>
        <Text style={styles.avatarInitials}>{initialsFromName(displayName)}</Text>
      </View>
    </View>
  );
}

type TrustedConnectionRowProps = {
  item: TrustedConnectionItem;
  hubRole?: TrustedHubRole;
  actingId?: string | null;
  actionsDisabled?: boolean;
  onRevoke?: (connectionId: string) => void;
  tdmRequestVisible?: boolean;
  tdmRequestDisabled?: boolean;
  tdmRequestBusy?: boolean;
  tdmAvailability?: TdmDriverAvailability | null;
  onRequestDirect?: (item: TrustedConnectionItem) => void;
  notifyPassengerVisible?: boolean;
  notifyPassengerDisabled?: boolean;
  notifyPassengerBusy?: boolean;
  onNotifyPassenger?: (item: TrustedConnectionItem) => void;
};

function TrustedConnectionRow({
  item,
  hubRole,
  actingId = null,
  actionsDisabled = false,
  onRevoke,
  tdmRequestVisible = false,
  tdmRequestDisabled = false,
  tdmRequestBusy = false,
  tdmAvailability = null,
  onRequestDirect,
  notifyPassengerVisible = false,
  notifyPassengerDisabled = false,
  notifyPassengerBusy = false,
  onNotifyPassenger,
}: TrustedConnectionRowProps) {
  const cp = item.counterparty;
  const displayName = (cp.display_name || '').trim() || 'Kullanıcı';
  const rating =
    cp.rating != null && Number.isFinite(Number(cp.rating)) ? Number(cp.rating) : null;
  const totalTrips =
    cp.total_trips != null && Number.isFinite(Number(cp.total_trips))
      ? Math.max(0, Math.floor(Number(cp.total_trips)))
      : null;
  const showVehicle = item.role === 'driver' && cp.vehicle_kind != null;
  const vehicleIcon =
    cp.vehicle_kind === 'motorcycle' ? 'car-sport-outline' : 'car-outline';
  const isBusy = actingId === item.connection_id;
  const disabled = actionsDisabled || (actingId != null && !isBusy);
  const showRadar = shouldShowRadarInsight(hubRole, item, tdmAvailability);
  const radarInsightLine = showRadar && item.radar ? buildRadarInsightLine(item.radar) : null;
  const radarState = showRadar ? item.radar?.radar_state : undefined;
  const tieInsightLine =
    showRadar && item.tie
      ? formatTieInsightLine(item.tie, radarInsightLine)
      : null;
  const showTdmStatus = tdmAvailability != null && tdmRequestVisible;
  const tdmUiState = tdmAvailability?.uiState;
  const showPresenceDot = showTdmStatus && tdmUiState != null;

  const handleRevokePress = useCallback(() => {
    if (disabled || isBusy || !onRevoke) return;
    appAlert(CONFIRM_REVOKE_TITLE, undefined, [
      { text: ACTION_CANCEL, style: 'cancel' },
      {
        text: ACTION_REMOVE,
        style: 'destructive',
        onPress: () => onRevoke(item.connection_id),
      },
    ]);
  }, [disabled, isBusy, item.connection_id, onRevoke]);

  const tdmTargetEligible = isTrustedDirectRequestEligible(item);
  const showTdmCta =
    tdmRequestVisible &&
    hubRole === 'passenger' &&
    tdmTargetEligible &&
    typeof onRequestDirect === 'function';
  const showDriverRoleBadge = item.role === 'driver';
  const showRegisteredDriverBadge =
    item.role === 'passenger' && item.counterparty.is_registered_driver === true;
  const showDriverBadge = showDriverRoleBadge || showRegisteredDriverBadge;
  const driverBadgeLabel = showDriverRoleBadge ? 'Sürücü' : 'Bu kullanıcı sürücü';
  const tdmDisabled = disabled || tdmRequestDisabled || tdmRequestBusy;
  const tdmButtonLabel = tdmRequestBusy
    ? TDM_REQUEST_BUSY
    : tdmAvailability?.buttonLabel ?? 'İstek gönder';

  const handleRequestPress = useCallback(() => {
    if (tdmDisabled || !onRequestDirect) return;
    onRequestDirect(item);
  }, [item, onRequestDirect, tdmDisabled]);

  const showNotifyCta =
    notifyPassengerVisible &&
    hubRole === 'driver' &&
    item.role === 'passenger' &&
    typeof onNotifyPassenger === 'function';
  const notifyDisabled = disabled || notifyPassengerDisabled || notifyPassengerBusy;

  const handleNotifyPress = useCallback(() => {
    if (notifyDisabled || !onNotifyPassenger) return;
    onNotifyPassenger(item);
  }, [item, notifyDisabled, onNotifyPassenger]);

  return (
    <View style={styles.row} accessibilityRole="text">
      <View style={styles.avatarWrap}>
        <TrustedAvatar displayName={displayName} photoUri={cp.profile_photo} />
        {showPresenceDot ? (
          <View style={[styles.tdmDot, resolveTdmDotStyle(tdmUiState!)]} />
        ) : showRadar && radarState ? (
          <View style={[styles.radarDot, resolveRadarDotStyle(radarState)]} />
        ) : null}
      </View>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.name} numberOfLines={1}>
            {displayName}
          </Text>
          {showDriverBadge ? (
            <View style={styles.driverBadge}>
              <Text style={styles.driverBadgeText}>{driverBadgeLabel}</Text>
            </View>
          ) : null}
          {showVehicle ? (
            <Ionicons name={vehicleIcon} size={14} color={PREMIUM_AUTH_CYAN} style={styles.vehicleIcon} />
          ) : null}
        </View>
        <View style={styles.metaRow}>
          {rating != null ? (
            <Text style={styles.metaText}>
              <Text style={styles.star}>★</Text> {rating.toFixed(1)}
            </Text>
          ) : null}
          {totalTrips != null && totalTrips > 0 ? (
            <Text style={styles.metaText}>
              {rating != null ? ' · ' : ''}
              {totalTrips} yolculuk
            </Text>
          ) : null}
        </View>
        {showTdmStatus && tdmAvailability?.statusLabel ? (
          <PremiumText
            variant="caption"
            style={[
              styles.tdmStatusLine,
              tdmAvailability.eligible ? styles.tdmStatusOnline : styles.tdmStatusMuted,
            ]}
            numberOfLines={1}
          >
            {tdmAvailability.statusLabel}
          </PremiumText>
        ) : null}
        {radarInsightLine ? (
          <PremiumText variant="caption" muted style={styles.radarInsight} numberOfLines={2}>
            {radarInsightLine}
          </PremiumText>
        ) : null}
        {tieInsightLine ? (
          <PremiumText variant="caption" muted style={styles.tieInsight} numberOfLines={2}>
            {tieInsightLine}
          </PremiumText>
        ) : null}
      </View>
      <View style={styles.actionsCol}>
        {showTdmCta ? (
          tdmRequestBusy ? (
            <View style={styles.tdmBusy}>
              <ActivityIndicator size="small" color={PREMIUM_AUTH_CYAN} />
            </View>
          ) : (
            <Pressable
              style={({ pressed }) => [
                styles.tdmBtn,
                tdmDisabled ? styles.tdmBtnDisabled : styles.tdmBtnReady,
                pressed && !tdmDisabled && styles.tdmBtnPressed,
              ]}
              onPress={handleRequestPress}
              disabled={tdmDisabled}
              accessibilityRole="button"
              accessibilityLabel={tdmButtonLabel}
              accessibilityState={{ disabled: tdmDisabled }}
            >
              <Text
                style={[styles.tdmBtnText, tdmDisabled ? styles.tdmBtnTextDisabled : styles.tdmBtnTextReady]}
              >
                {tdmButtonLabel}
              </Text>
            </Pressable>
          )
        ) : null}
        {showNotifyCta ? (
          notifyPassengerBusy ? (
            <View style={styles.tdmBusy}>
              <ActivityIndicator size="small" color={PREMIUM_AUTH_CYAN} />
            </View>
          ) : (
            <Pressable
              style={({ pressed }) => [
                styles.notifyBtn,
                notifyDisabled && styles.notifyBtnDisabled,
                pressed && !notifyDisabled && styles.notifyBtnPressed,
              ]}
              onPress={handleNotifyPress}
              disabled={notifyDisabled}
              accessibilityRole="button"
              accessibilityLabel={TDM_NOTIFY_CTA}
              accessibilityState={{ disabled: notifyDisabled }}
            >
              <Text style={styles.notifyBtnText}>{TDM_NOTIFY_CTA}</Text>
            </Pressable>
          )
        ) : null}
        {onRevoke ? (
          isBusy ? (
            <View style={styles.removeBusy}>
              <ActivityIndicator size="small" color={PREMIUM_AUTH_CYAN} />
            </View>
          ) : (
            <Pressable
              style={({ pressed }) => [
                styles.removeBtn,
                disabled && styles.removeBtnDisabled,
                pressed && !disabled && styles.removeBtnPressed,
              ]}
              onPress={handleRevokePress}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={ACTION_REMOVE}
              accessibilityState={{ disabled }}
            >
              <Text style={styles.removeBtnText}>{ACTION_REMOVE}</Text>
            </Pressable>
          )
        ) : null}
      </View>
    </View>
  );
}

export default memo(TrustedConnectionRow);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(16, 26, 43, 0.72)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PREMIUM_BORDER_SLATE,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatarRing: {
    width: 44,
    height: 44,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(34, 211, 238, 0.22)',
  },
  radarDot: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'rgba(11, 18, 32, 0.98)',
  },
  tdmDot: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: 'rgba(11, 18, 32, 0.98)',
  },
  tdmDotOnline: {
    backgroundColor: 'rgba(52, 211, 153, 0.98)',
    shadowColor: 'rgba(52, 211, 153, 0.95)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 5,
    elevation: 4,
  },
  tdmDotBusy: {
    backgroundColor: 'rgba(251, 191, 36, 0.95)',
  },
  tdmDotOffline: {
    backgroundColor: 'rgba(100, 116, 139, 0.82)',
  },
  radarDotReady: {
    backgroundColor: 'rgba(52, 211, 153, 0.95)',
  },
  radarDotOnTrip: {
    backgroundColor: 'rgba(251, 191, 36, 0.95)',
  },
  radarDotMuted: {
    backgroundColor: 'rgba(100, 116, 139, 0.75)',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(30, 58, 95, 0.55)',
  },
  avatarInitials: {
    fontSize: 14,
    fontWeight: '800',
    color: PREMIUM_AUTH_CYAN,
    letterSpacing: 0.3,
  },
  body: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: PREMIUM_TEXT_SOFT,
    letterSpacing: -0.15,
  },
  vehicleIcon: {
    opacity: 0.9,
  },
  driverBadge: {
    paddingVertical: 2,
    paddingHorizontal: 7,
    borderRadius: 8,
    backgroundColor: 'rgba(8, 47, 73, 0.45)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(34, 211, 238, 0.28)',
  },
  driverBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: PREMIUM_AUTH_CYAN,
    letterSpacing: 0.2,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 12,
    fontWeight: '600',
    color: PREMIUM_TEXT_MUTED,
  },
  star: {
    color: 'rgba(251, 191, 36, 0.92)',
  },
  tdmStatusLine: {
    marginTop: 2,
    lineHeight: 16,
    fontWeight: '700',
  },
  tdmStatusOnline: {
    color: 'rgba(52, 211, 153, 0.95)',
  },
  tdmStatusMuted: {
    color: PREMIUM_TEXT_MUTED,
  },
  radarInsight: {
    marginTop: 2,
    lineHeight: 16,
  },
  tieInsight: {
    marginTop: 1,
    lineHeight: 16,
    opacity: 0.78,
  },
  actionsCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 6,
  },
  tdmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    minWidth: 92,
  },
  tdmBtnReady: {
    borderColor: 'rgba(34, 211, 238, 0.35)',
    backgroundColor: 'rgba(8, 47, 73, 0.35)',
  },
  tdmBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
  tdmBtnTextReady: {
    color: PREMIUM_AUTH_CYAN,
  },
  tdmBtnTextDisabled: {
    color: 'rgba(148, 163, 184, 0.92)',
  },
  tdmBtnDisabled: {
    borderColor: 'rgba(100, 116, 139, 0.42)',
    backgroundColor: 'rgba(51, 65, 85, 0.38)',
  },
  tdmBtnPressed: {
    opacity: 0.88,
  },
  tdmBusy: {
    width: 92,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifyBtn: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(34, 211, 238, 0.35)',
    backgroundColor: 'rgba(8, 47, 73, 0.35)',
  },
  notifyBtnDisabled: {
    opacity: 0.45,
  },
  notifyBtnPressed: {
    opacity: 0.88,
  },
  notifyBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: PREMIUM_AUTH_CYAN,
  },
  removeBtn: {
    alignSelf: 'center',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(248, 113, 113, 0.35)',
    backgroundColor: 'rgba(127, 29, 29, 0.18)',
  },
  removeBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: 'rgba(252, 165, 165, 0.92)',
  },
  removeBtnDisabled: {
    opacity: 0.55,
  },
  removeBtnPressed: {
    opacity: 0.88,
  },
  removeBusy: {
    width: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
