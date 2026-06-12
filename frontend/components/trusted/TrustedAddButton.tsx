import React, { memo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { TrustedCounterpartyUiStatus } from '../../hooks/useTrustedCounterpartyStatus';

export type TrustedAddButtonProps = {
  viewerRole: 'passenger' | 'driver';
  status: TrustedCounterpartyUiStatus;
  loading: boolean;
  creating: boolean;
  errorMessage: string | null;
  onPress: () => void;
  onRefresh: () => void;
};

type UiConfig = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  pressable: boolean;
  muted: boolean;
};

function buildUiConfig(
  viewerRole: 'passenger' | 'driver',
  status: TrustedCounterpartyUiStatus,
  loading: boolean,
  creating: boolean,
): UiConfig {
  if (loading || status === 'loading') {
    return {
      label: 'Güven ağı kontrol ediliyor…',
      icon: 'time-outline',
      pressable: false,
      muted: true,
    };
  }

  if (creating) {
    return {
      label: 'Davet gönderiliyor…',
      icon: 'time-outline',
      pressable: false,
      muted: true,
    };
  }

  switch (status) {
    case 'none':
      return {
        label:
          viewerRole === 'passenger'
            ? '+ Sürücüyü güven ağına ekle'
            : '+ Yolcuyu güven ağına ekle',
        icon: 'person-add-outline',
        pressable: true,
        muted: false,
      };
    case 'outgoing_pending':
      return {
        label: 'Davet gönderildi',
        icon: 'time-outline',
        pressable: false,
        muted: true,
      };
    case 'incoming_pending':
      return {
        label: 'Size güven ağı daveti var',
        icon: 'time-outline',
        pressable: false,
        muted: true,
      };
    case 'active':
      return {
        label: 'Güven ağında',
        icon: 'checkmark-circle-outline',
        pressable: false,
        muted: true,
      };
    case 'declined':
      return {
        label: 'Tekrar davet gönder',
        icon: 'person-add-outline',
        pressable: true,
        muted: false,
      };
    case 'blocked':
      return {
        label: 'Eklenemez',
        icon: 'person-add-outline',
        pressable: false,
        muted: true,
      };
    case 'error':
      return {
        label: 'Yüklenemedi · Tekrar dene',
        icon: 'refresh-outline',
        pressable: true,
        muted: false,
      };
    default:
      return {
        label: 'Güven ağı',
        icon: 'person-add-outline',
        pressable: false,
        muted: true,
      };
  }
}

function TrustedAddButton({
  viewerRole,
  status,
  loading,
  creating,
  errorMessage,
  onPress,
  onRefresh,
}: TrustedAddButtonProps) {
  const ui = buildUiConfig(viewerRole, status, loading, creating);
  const showSpinner = loading || creating;
  const accessibilityLabel = errorMessage && status === 'error' ? errorMessage : ui.label;

  const handlePress = () => {
    if (!ui.pressable || showSpinner) return;
    if (status === 'error') {
      onRefresh();
      return;
    }
    onPress();
  };

  return (
    <View style={styles.wrap}>
      <Pressable
        style={({ pressed }) => [
          styles.pill,
          ui.muted ? styles.pillMuted : null,
          ui.pressable && pressed ? styles.pillPressed : null,
          !ui.pressable ? styles.pillDisabled : null,
        ]}
        onPress={handlePress}
        disabled={!ui.pressable || showSpinner}
        accessibilityRole="button"
        accessibilityState={{ disabled: !ui.pressable || showSpinner }}
        accessibilityLabel={accessibilityLabel}
      >
        {showSpinner ? (
          <ActivityIndicator size="small" color="#22D3EE" style={styles.spinner} />
        ) : (
          <Ionicons
            name={ui.icon}
            size={16}
            color={ui.muted ? 'rgba(186,201,222,0.78)' : 'rgba(34,211,238,0.95)'}
          />
        )}
        <Text
          style={[styles.label, ui.muted ? styles.labelMuted : null]}
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.85}
        >
          {ui.label}
        </Text>
      </Pressable>
      {errorMessage && (status === 'none' || status === 'declined') ? (
        <Text style={styles.errorHint} numberOfLines={2}>
          {errorMessage}
        </Text>
      ) : null}
    </View>
  );
}

export default memo(TrustedAddButton);

const styles = StyleSheet.create({
  wrap: {
    marginTop: 10,
    alignSelf: 'stretch',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.42)',
    backgroundColor: 'rgba(8,17,31,0.72)',
  },
  pillMuted: {
    borderColor: 'rgba(30,58,95,0.55)',
    backgroundColor: 'rgba(8,17,31,0.55)',
  },
  pillPressed: {
    opacity: 0.88,
    borderColor: 'rgba(34,211,238,0.62)',
  },
  pillDisabled: {
    opacity: 0.92,
  },
  spinner: {
    width: 16,
    height: 16,
  },
  label: {
    flex: 1,
    color: 'rgba(243,248,255,0.94)',
    fontSize: 13,
    fontWeight: '700',
  },
  labelMuted: {
    color: 'rgba(186,201,222,0.82)',
    fontWeight: '600',
  },
  errorHint: {
    marginTop: 6,
    color: 'rgba(252,165,165,0.88)',
    fontSize: 12,
    fontWeight: '600',
  },
});
