import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { TripPaymentDetailsResponse } from '../lib/tripPaymentApi';
import { appAlert } from '../contexts/AppAlertContext';

export type DriverPaymentDetailsSheetMode = 'info' | 'trip_end';

export type DriverPaymentDetailsSheetProps = {
  visible: boolean;
  loading?: boolean;
  error?: string | null;
  details?: TripPaymentDetailsResponse | null;
  mode: DriverPaymentDetailsSheetMode;
  onClose: () => void;
  onPaid?: () => void;
};

async function copyPlainText(text: string): Promise<boolean> {
  const value = String(text || '').trim();
  if (!value) return false;
  try {
    if (Platform.OS === 'web') {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        return true;
      }
      return false;
    }
    const clipboardMod = require('expo-clipboard') as {
      setStringAsync?: (input: string) => Promise<void>;
    };
    if (typeof clipboardMod.setStringAsync === 'function') {
      await clipboardMod.setStringAsync(value);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export default function DriverPaymentDetailsSheet({
  visible,
  loading = false,
  error = null,
  details = null,
  mode,
  onClose,
  onPaid,
}: DriverPaymentDetailsSheetProps) {
  const holderName = String(details?.account_holder_name || '').trim();
  const iban = String(details?.iban || '').trim();

  const handleCopyName = useCallback(async () => {
    if (!holderName) return;
    const ok = await copyPlainText(holderName);
    appAlert('Kopyalandı', ok ? 'Ad soyad panoya kopyalandı' : 'Kopyalanamadı');
  }, [holderName]);

  const handleCopyIban = useCallback(async () => {
    if (!iban) return;
    const ok = await copyPlainText(iban);
    appAlert('Kopyalandı', ok ? 'IBAN panoya kopyalandı' : 'Kopyalanamadı');
  }, [iban]);

  const handlePrimary = useCallback(() => {
    if (mode === 'trip_end') {
      onPaid?.();
      return;
    }
    onClose();
  }, [mode, onClose, onPaid]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Kapat" />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Sürücü ödeme bilgileri</Text>
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Kapat">
              <Ionicons name="close" size={22} color="rgba(172, 188, 212, 0.95)" />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            {loading ? (
              <View style={styles.centerBlock}>
                <ActivityIndicator size="small" color="#22D3EE" />
                <Text style={styles.loadingText}>Ödeme bilgileri yükleniyor…</Text>
              </View>
            ) : null}

            {!loading && error ? (
              <View style={styles.errorCard}>
                <Ionicons name="information-circle-outline" size={20} color="#22D3EE" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {!loading && !error && details ? (
              <>
                <Text style={styles.fieldLabel}>Hesap sahibi</Text>
                <Text style={styles.fieldValue}>{holderName || '—'}</Text>

                <Text style={styles.fieldLabel}>IBAN</Text>
                <Text style={styles.ibanValue} selectable>
                  {iban || '—'}
                </Text>

                <Pressable style={styles.secondaryBtn} onPress={() => void handleCopyName()} disabled={!holderName}>
                  <Ionicons name="copy-outline" size={18} color="#22D3EE" />
                  <Text style={styles.secondaryBtnText}>Ad soyad kopyala</Text>
                </Pressable>

                <Pressable style={styles.secondaryBtn} onPress={() => void handleCopyIban()} disabled={!iban}>
                  <Ionicons name="copy-outline" size={18} color="#22D3EE" />
                  <Text style={styles.secondaryBtnText}>IBAN kopyala</Text>
                </Pressable>

                <Text style={styles.hint}>
                  Havale/EFT ile ödeme yapıyorsanız bilgileri kontrol edip sürücüye gönderin.
                </Text>
              </>
            ) : null}
          </ScrollView>

          <Pressable
            style={[styles.primaryWrap, (loading || !!error) && styles.primaryDisabled]}
            disabled={loading || !!error}
            onPress={handlePrimary}
          >
            <LinearGradient colors={['#22D3EE', '#0EA5E9', '#2563EB']} style={styles.primaryGradient}>
              <Text style={styles.primaryText}>{mode === 'trip_end' ? 'Ödemeyi yaptım' : 'Tamam'}</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(1, 8, 24, 0.72)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '88%',
    backgroundColor: '#0B1220',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: '#1E3A5F',
    borderBottomWidth: 0,
    paddingBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(30, 58, 95, 0.55)',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: 'rgba(243, 248, 255, 0.96)',
  },
  body: {
    padding: 16,
    gap: 8,
    paddingBottom: 12,
  },
  centerBlock: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: 'rgba(172, 188, 212, 0.92)',
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(16, 26, 43, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.18)',
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(172, 188, 212, 0.95)',
  },
  fieldLabel: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(172, 188, 212, 0.95)',
  },
  fieldValue: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(243, 248, 255, 0.94)',
  },
  ibanValue: {
    fontSize: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.6,
    color: '#22D3EE',
  },
  secondaryBtn: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.35)',
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#22D3EE',
  },
  hint: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 18,
    color: 'rgba(148, 163, 184, 0.88)',
  },
  primaryWrap: {
    marginHorizontal: 16,
    marginTop: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  primaryDisabled: {
    opacity: 0.55,
  },
  primaryGradient: {
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#08111F',
  },
});
