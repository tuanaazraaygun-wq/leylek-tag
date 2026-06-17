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
import {
  ACTION_CANCEL,
  ACTION_REMOVE,
  CONFIRM_REVOKE_TITLE,
} from '../../lib/trustedHubCopy';
import type { TrustedConnectionItem } from '../../lib/trustedNetworkApi';

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
  actingId?: string | null;
  actionsDisabled?: boolean;
  onRevoke?: (connectionId: string) => void;
};

function TrustedConnectionRow({
  item,
  actingId = null,
  actionsDisabled = false,
  onRevoke,
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

  return (
    <View style={styles.row} accessibilityRole="text">
      <TrustedAvatar displayName={displayName} photoUri={cp.profile_photo} />
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.name} numberOfLines={1}>
            {displayName}
          </Text>
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
      </View>
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
  avatarRing: {
    width: 44,
    height: 44,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(34, 211, 238, 0.22)',
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
