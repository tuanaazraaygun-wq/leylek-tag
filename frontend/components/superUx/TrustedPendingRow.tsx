import React, { memo, useCallback } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { appAlert } from '../../contexts/AppAlertContext';
import {
  PREMIUM_AUTH_CYAN,
  PREMIUM_BORDER_SLATE,
  PREMIUM_TEXT_MUTED,
  PREMIUM_TEXT_SOFT,
} from '../auth/premiumAuthStyles';
import {
  ACTION_ACCEPT,
  ACTION_CANCEL,
  ACTION_DECLINE,
  CONFIRM_DECLINE_TITLE,
  formatTrustedExpiresHint,
  formatTrustedHubDate,
  PENDING_BADGE_INCOMING,
  PENDING_BADGE_OUTGOING,
} from '../../lib/trustedHubCopy';
import type { TrustedCounterparty, TrustedPendingItem } from '../../lib/trustedNetworkApi';

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

type TrustedPendingRowProps = {
  item: TrustedPendingItem;
  direction: 'incoming' | 'outgoing';
  actingId?: string | null;
  actionsDisabled?: boolean;
  onAccept?: (inviteId: string) => void;
  onDecline?: (inviteId: string) => void;
};

function TrustedPendingRow({
  item,
  direction,
  actingId = null,
  actionsDisabled = false,
  onAccept,
  onDecline,
}: TrustedPendingRowProps) {
  const peer: TrustedCounterparty | undefined =
    direction === 'incoming' ? item.from : item.to;
  const displayName = (peer?.display_name || '').trim() || 'Kullanıcı';
  const badge = direction === 'incoming' ? PENDING_BADGE_INCOMING : PENDING_BADGE_OUTGOING;
  const invitedLabel = formatTrustedHubDate(item.invited_at);
  const expiresHint = formatTrustedExpiresHint(item.expires_at);
  const isIncoming = direction === 'incoming';
  const isBusy = actingId === item.invite_id;
  const disabled = actionsDisabled || (actingId != null && !isBusy);

  const handleAccept = useCallback(() => {
    if (disabled || isBusy || !onAccept) return;
    onAccept(item.invite_id);
  }, [disabled, isBusy, item.invite_id, onAccept]);

  const handleDeclinePress = useCallback(() => {
    if (disabled || isBusy || !onDecline) return;
    appAlert(CONFIRM_DECLINE_TITLE, undefined, [
      { text: ACTION_CANCEL, style: 'cancel' },
      {
        text: ACTION_DECLINE,
        style: 'destructive',
        onPress: () => onDecline(item.invite_id),
      },
    ]);
  }, [disabled, isBusy, item.invite_id, onDecline]);

  return (
    <View style={styles.row} accessibilityRole="text">
      <TrustedAvatar displayName={displayName} photoUri={peer?.profile_photo ?? null} />
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {displayName}
        </Text>
        <View style={styles.badgeRow}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        </View>
        {invitedLabel || expiresHint ? (
          <Text style={styles.dateLine} numberOfLines={2}>
            {[invitedLabel, expiresHint].filter(Boolean).join(' · ')}
          </Text>
        ) : null}
        {isIncoming && onAccept && onDecline ? (
          <View style={styles.actionsRow}>
            {isBusy ? (
              <View style={styles.busyWrap}>
                <ActivityIndicator size="small" color={PREMIUM_AUTH_CYAN} />
              </View>
            ) : (
              <>
                <Pressable
                  style={({ pressed }) => [
                    styles.actionBtnPrimary,
                    disabled && styles.actionBtnDisabled,
                    pressed && !disabled && styles.actionBtnPressed,
                  ]}
                  onPress={handleAccept}
                  disabled={disabled}
                  accessibilityRole="button"
                  accessibilityLabel={ACTION_ACCEPT}
                  accessibilityState={{ disabled }}
                >
                  <Text style={styles.actionBtnPrimaryText}>{ACTION_ACCEPT}</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.actionBtnGhost,
                    disabled && styles.actionBtnDisabled,
                    pressed && !disabled && styles.actionBtnPressed,
                  ]}
                  onPress={handleDeclinePress}
                  disabled={disabled}
                  accessibilityRole="button"
                  accessibilityLabel={ACTION_DECLINE}
                  accessibilityState={{ disabled }}
                >
                  <Text style={styles.actionBtnGhostText}>{ACTION_DECLINE}</Text>
                </Pressable>
              </>
            )}
          </View>
        ) : null}
      </View>
    </View>
  );
}

export default memo(TrustedPendingRow);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
    marginTop: 2,
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
    gap: 5,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: PREMIUM_TEXT_SOFT,
    letterSpacing: -0.15,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(34, 211, 238, 0.1)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(34, 211, 238, 0.28)',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: PREMIUM_AUTH_CYAN,
    letterSpacing: 0.35,
    textTransform: 'uppercase',
  },
  dateLine: {
    fontSize: 12,
    fontWeight: '600',
    color: PREMIUM_TEXT_MUTED,
    lineHeight: 16,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  busyWrap: {
    minHeight: 34,
    justifyContent: 'center',
    paddingVertical: 6,
  },
  actionBtnPrimary: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(34, 211, 238, 0.16)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(34, 211, 238, 0.42)',
  },
  actionBtnGhost: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(8, 17, 31, 0.45)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PREMIUM_BORDER_SLATE,
  },
  actionBtnPrimaryText: {
    fontSize: 13,
    fontWeight: '800',
    color: PREMIUM_AUTH_CYAN,
  },
  actionBtnGhostText: {
    fontSize: 13,
    fontWeight: '700',
    color: PREMIUM_TEXT_MUTED,
  },
  actionBtnDisabled: {
    opacity: 0.55,
  },
  actionBtnPressed: {
    opacity: 0.88,
  },
});
