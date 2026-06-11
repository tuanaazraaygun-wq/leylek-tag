import React, { memo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import {
  PREMIUM_AUTH_CYAN,
  PREMIUM_BORDER_SLATE,
  PREMIUM_TEXT_MUTED,
  PREMIUM_TEXT_SOFT,
} from '../auth/premiumAuthStyles';
import {
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
};

function TrustedPendingRow({ item, direction }: TrustedPendingRowProps) {
  const peer: TrustedCounterparty | undefined =
    direction === 'incoming' ? item.from : item.to;
  const displayName = (peer?.display_name || '').trim() || 'Kullanıcı';
  const badge = direction === 'incoming' ? PENDING_BADGE_INCOMING : PENDING_BADGE_OUTGOING;
  const invitedLabel = formatTrustedHubDate(item.invited_at);
  const expiresHint = formatTrustedExpiresHint(item.expires_at);

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
      </View>
    </View>
  );
}

export default memo(TrustedPendingRow);

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
});
