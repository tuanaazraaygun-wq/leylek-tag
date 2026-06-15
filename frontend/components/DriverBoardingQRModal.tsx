import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  View,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { CockpitBackground, GlassSurface, PremiumText } from '../design-system/primitives';
import { LDS_BORDER_COLOR, LDS_BORDER_WIDTH } from '../design-system/tokens/border';
import { LDS_ELEVATION } from '../design-system/tokens/elevation';
import { LDS_RADIUS } from '../design-system/tokens/radius';
import { LDS_SPACING } from '../design-system/tokens/spacing';
import { API_BASE_URL } from '../lib/backendConfig';
import { waitForPersistedAccessToken } from '../lib/sessionToken';

type Props = {
  visible: boolean;
  onClose: () => void;
  tagId: string;
};

export default function DriverBoardingQRModal({ visible, onClose, tagId }: Props) {
  const [qrString, setQrString] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCode = useCallback(async () => {
    if (!tagId) return;
    setLoading(true);
    setError(null);
    setQrString(null);
    console.log('BOARDING_QR_REQUESTED', { tag_id: tagId });
    try {
      const tok = await waitForPersistedAccessToken();
      if (!tok?.trim()) {
        setError('Oturum bulunamadı; yeniden giriş yapın.');
        return;
      }
      const q = new URLSearchParams({ tag_id: String(tagId) });
      const res = await fetch(`${API_BASE_URL}/qr/boarding-code?${q.toString()}`, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${tok.trim()}` },
      });
      const raw = await res.text();
      let json: { success?: boolean; qr_string?: string; detail?: string } = {};
      try {
        json = raw ? JSON.parse(raw) : {};
      } catch {
        setError('Sunucu yanıtı okunamadı');
        return;
      }
      if (res.status === 401) {
        setError(json.detail || 'Oturum doğrulanamadı');
        return;
      }
      if (json.success && json.qr_string) {
        setQrString(json.qr_string);
      } else {
        setError(json.detail || 'Karekod alınamadı');
      }
    } catch {
      setError('Ağ hatası');
    } finally {
      setLoading(false);
    }
  }, [tagId]);

  useEffect(() => {
    if (visible) {
      void fetchCode();
    } else {
      setQrString(null);
      setError(null);
    }
  }, [visible, fetchCode]);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <CockpitBackground showGrid={false} />
        <View style={styles.scrim} pointerEvents="none" />

        <GlassSurface variant="panel" style={styles.sheet} borderRadius={LDS_RADIUS.xl}>
          <View style={styles.header}>
            <View style={styles.headerTextCol}>
              <PremiumText variant="step" style={styles.phaseStep}>
                Biniş QR kodu
              </PremiumText>
              <PremiumText variant="caption" muted style={styles.phaseCaption}>
                Yolcunun binişi güvenli şekilde doğrulaması için bu kodu göster.
              </PremiumText>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Kapat"
            >
              <Ionicons name="close" size={22} color="rgba(186,201,222,0.82)" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            {loading ? (
              <View style={styles.center}>
                <ActivityIndicator size="large" color="#22D3EE" />
                <PremiumText variant="caption" muted style={styles.stateText}>
                  Karekod hazırlanıyor…
                </PremiumText>
              </View>
            ) : error ? (
              <View style={styles.center}>
                <PremiumText variant="body" style={styles.errText}>
                  {error}
                </PremiumText>
                <TouchableOpacity
                  style={styles.retryBtn}
                  onPress={() => void fetchCode()}
                  activeOpacity={0.88}
                >
                  <PremiumText variant="body" style={styles.retryBtnText}>
                    Yeniden dene
                  </PremiumText>
                </TouchableOpacity>
              </View>
            ) : qrString ? (
              <GlassSurface variant="stage" style={styles.qrStage} borderRadius={LDS_RADIUS.lg}>
                <View style={styles.qrBox}>
                  <QRCode value={qrString} size={220} backgroundColor="#fff" color="#0f172a" />
                </View>
                <PremiumText variant="caption" muted style={styles.qrHint}>
                  Yolcu kodu tarayıp onayladıktan sonra yolculuk başlar.
                </PremiumText>
              </GlassSurface>
            ) : null}
          </ScrollView>
        </GlassSurface>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8,17,31,0.72)',
  },
  sheet: {
    maxHeight: '90%',
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
    paddingBottom: LDS_SPACING.xl,
  },
  center: {
    alignItems: 'center',
    paddingVertical: LDS_SPACING.lg,
    gap: LDS_SPACING.sm,
  },
  stateText: {
    marginTop: LDS_SPACING.xs,
    fontWeight: '600',
  },
  errText: {
    textAlign: 'center',
    fontWeight: '600',
    color: 'rgba(252, 212, 213, 0.92)',
    paddingHorizontal: LDS_SPACING.sm,
  },
  retryBtn: {
    marginTop: LDS_SPACING.sm,
    paddingHorizontal: LDS_SPACING.lg,
    paddingVertical: LDS_SPACING.sm,
    borderRadius: LDS_RADIUS.md,
    backgroundColor: 'rgba(16,26,43,0.9)',
    borderWidth: LDS_BORDER_WIDTH.emphasis,
    borderColor: LDS_BORDER_COLOR.selected,
    borderTopColor: LDS_BORDER_COLOR.selectedTop,
    ...LDS_ELEVATION.cta,
  },
  retryBtnText: {
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  qrStage: {
    alignItems: 'center',
    paddingVertical: LDS_SPACING.lg,
    paddingHorizontal: LDS_SPACING.md,
    ...LDS_ELEVATION.panel,
  },
  qrBox: {
    backgroundColor: '#fff',
    padding: LDS_SPACING.md,
    borderRadius: LDS_RADIUS.md,
    borderWidth: LDS_BORDER_WIDTH.standard,
    borderColor: LDS_BORDER_COLOR.card,
  },
  qrHint: {
    marginTop: LDS_SPACING.sm,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: LDS_SPACING.xs,
  },
});
