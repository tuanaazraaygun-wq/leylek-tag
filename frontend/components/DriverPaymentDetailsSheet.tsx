import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { CockpitBackground, GlassSurface, PremiumText } from '../design-system/primitives';
import { LDS_BORDER_COLOR, LDS_BORDER_WIDTH } from '../design-system/tokens/border';
import { LDS_ELEVATION } from '../design-system/tokens/elevation';
import { LDS_RADIUS } from '../design-system/tokens/radius';
import { LDS_SPACING } from '../design-system/tokens/spacing';
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
    if (typeof Clipboard.setStringAsync === 'function') {
      await Clipboard.setStringAsync(value);
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
        <CockpitBackground showGrid={false} />
        <View style={styles.scrim} pointerEvents="none" />
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Kapat" />

        <GlassSurface variant="panel" style={styles.sheet} borderRadius={LDS_RADIUS.xl}>
          <View style={styles.header}>
            <View style={styles.headerTextCol}>
              <PremiumText variant="step" style={styles.phaseStep}>
                Ödeme bilgileri
              </PremiumText>
              <PremiumText variant="caption" muted style={styles.phaseCaption}>
                Transfer bilgilerini dikkatlice kontrol et.
              </PremiumText>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Kapat"
            >
              <Ionicons name="close" size={22} color="rgba(186,201,222,0.82)" />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            {loading ? (
              <View style={styles.centerBlock}>
                <ActivityIndicator size="small" color="#22D3EE" />
                <PremiumText variant="caption" muted style={styles.loadingText}>
                  Ödeme bilgileri yükleniyor…
                </PremiumText>
              </View>
            ) : null}

            {!loading && error ? (
              <GlassSurface variant="plain" style={styles.errorCard} borderRadius={LDS_RADIUS.md}>
                <Ionicons name="information-circle-outline" size={20} color="rgba(34,211,238,0.88)" />
                <PremiumText variant="caption" style={styles.errorText}>
                  {error}
                </PremiumText>
              </GlassSurface>
            ) : null}

            {!loading && !error && details ? (
              <>
                <PremiumText variant="caption" muted style={styles.fieldLabel}>
                  Hesap sahibi
                </PremiumText>
                <GlassSurface variant="plain" style={styles.fieldCard} borderRadius={LDS_RADIUS.md}>
                  <PremiumText variant="body" style={styles.fieldValue}>
                    {holderName || '—'}
                  </PremiumText>
                </GlassSurface>

                <PremiumText variant="caption" muted style={styles.fieldLabel}>
                  IBAN
                </PremiumText>
                <GlassSurface variant="plain" style={styles.fieldCard} borderRadius={LDS_RADIUS.md}>
                  <PremiumText variant="body" selectable style={styles.ibanValue}>
                    {iban || '—'}
                  </PremiumText>
                </GlassSurface>

                <Pressable
                  style={[styles.secondaryBtn, !holderName && styles.btnDisabled]}
                  onPress={() => void handleCopyName()}
                  disabled={!holderName}
                >
                  <Ionicons name="copy-outline" size={18} color="rgba(34,211,238,0.92)" />
                  <PremiumText variant="caption" style={styles.secondaryBtnText}>
                    Ad soyad kopyala
                  </PremiumText>
                </Pressable>

                <Pressable
                  style={[styles.secondaryBtn, !iban && styles.btnDisabled]}
                  onPress={() => void handleCopyIban()}
                  disabled={!iban}
                >
                  <Ionicons name="copy-outline" size={18} color="rgba(34,211,238,0.92)" />
                  <PremiumText variant="caption" style={styles.secondaryBtnText}>
                    IBAN kopyala
                  </PremiumText>
                </Pressable>

                <PremiumText variant="caption" muted style={styles.hint}>
                  Havale/EFT ile ödeme yapıyorsanız bilgileri kontrol edip sürücüye gönderin.
                </PremiumText>
              </>
            ) : null}
          </ScrollView>

          <Pressable
            style={[styles.primaryBtn, (loading || !!error) && styles.primaryDisabled]}
            disabled={loading || !!error}
            onPress={handlePrimary}
          >
            <PremiumText variant="body" style={styles.primaryText}>
              {mode === 'trip_end' ? 'Ödemeyi yaptım' : 'Tamam'}
            </PremiumText>
          </Pressable>
        </GlassSurface>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8,17,31,0.72)',
  },
  sheet: {
    maxHeight: '88%',
    paddingBottom: LDS_SPACING.md,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    ...LDS_ELEVATION.cockpit,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: LDS_SPACING.lg,
    paddingTop: LDS_SPACING.lg,
    paddingBottom: LDS_SPACING.sm,
    gap: LDS_SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LDS_BORDER_COLOR.card,
  },
  headerTextCol: {
    flex: 1,
    minWidth: 0,
    gap: LDS_SPACING.xxs,
  },
  phaseStep: {
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  phaseCaption: {
    lineHeight: 18,
  },
  closeBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: LDS_RADIUS.md,
    backgroundColor: 'rgba(8,17,31,0.55)',
    borderWidth: LDS_BORDER_WIDTH.standard,
    borderColor: LDS_BORDER_COLOR.card,
  },
  body: {
    paddingHorizontal: LDS_SPACING.lg,
    paddingTop: LDS_SPACING.md,
    paddingBottom: LDS_SPACING.sm,
    gap: LDS_SPACING.xs,
  },
  centerBlock: {
    alignItems: 'center',
    paddingVertical: LDS_SPACING.lg,
    gap: LDS_SPACING.sm,
  },
  loadingText: {
    fontWeight: '600',
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: LDS_SPACING.sm,
    padding: LDS_SPACING.sm,
    backgroundColor: 'rgba(5,11,24,0.55)',
    borderColor: LDS_BORDER_COLOR.card,
    borderTopColor: LDS_BORDER_COLOR.cardTopCyan,
    ...LDS_ELEVATION.flat,
  },
  errorText: {
    flex: 1,
    lineHeight: 18,
  },
  fieldLabel: {
    marginTop: LDS_SPACING.xs,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  fieldCard: {
    paddingVertical: LDS_SPACING.sm,
    paddingHorizontal: LDS_SPACING.md,
    backgroundColor: 'rgba(5,11,24,0.55)',
    borderColor: LDS_BORDER_COLOR.card,
    borderTopColor: LDS_BORDER_COLOR.cardTopCyan,
    ...LDS_ELEVATION.flat,
  },
  fieldValue: {
    fontWeight: '600',
  },
  ibanValue: {
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.6,
    color: 'rgba(186, 230, 253, 0.95)',
  },
  secondaryBtn: {
    marginTop: LDS_SPACING.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: LDS_SPACING.xs,
    paddingVertical: LDS_SPACING.sm,
    borderRadius: LDS_RADIUS.md,
    backgroundColor: 'rgba(8,17,31,0.55)',
    borderWidth: LDS_BORDER_WIDTH.standard,
    borderColor: LDS_BORDER_COLOR.card,
  },
  secondaryBtnText: {
    fontWeight: '700',
    color: 'rgba(186, 230, 253, 0.92)',
  },
  btnDisabled: {
    opacity: 0.45,
  },
  hint: {
    marginTop: LDS_SPACING.xs,
    lineHeight: 18,
  },
  primaryBtn: {
    marginHorizontal: LDS_SPACING.lg,
    marginTop: LDS_SPACING.xs,
    paddingVertical: LDS_SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: LDS_RADIUS.md,
    backgroundColor: 'rgba(16,26,43,0.9)',
    borderWidth: LDS_BORDER_WIDTH.emphasis,
    borderColor: LDS_BORDER_COLOR.selected,
    borderTopColor: LDS_BORDER_COLOR.selectedTop,
    ...LDS_ELEVATION.cta,
  },
  primaryDisabled: {
    opacity: 0.55,
  },
  primaryText: {
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
