import React, { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  View,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { appAlert } from '../contexts/AppAlertContext';
import LeylekEye, { LEYLEK_EYE_ROLE_SELECT_SIZE } from '../design-system/leylek-eye/LeylekEye';
import { CockpitBackground, GlassSurface, PremiumText } from '../design-system/primitives';
import { LDS_BORDER_COLOR, LDS_BORDER_WIDTH } from '../design-system/tokens/border';
import { PREMIUM_AUTH_CYAN } from '../design-system/tokens/color';
import { LDS_ELEVATION } from '../design-system/tokens/elevation';
import { LDS_RADIUS } from '../design-system/tokens/radius';
import { LDS_SPACING } from '../design-system/tokens/spacing';
import TrustedAddButton from './trusted/TrustedAddButton';
import { useTrustedCounterpartyStatus } from '../hooks/useTrustedCounterpartyStatus';
import { API_BASE_URL } from '../lib/backendConfig';

/** Emergency P0: journey hot-path trust UI temporarily disabled */
const EMERGENCY_TRUST_JOURNEY_UI_DISABLED = false;

const maskIdForLog = (v: string): string => {
  const s = String(v || '').trim();
  if (!s) return 'n/a';
  if (s.length <= 8) return `***${s.slice(-2)}`;
  return `${s.slice(0, 4)}***${s.slice(-4)}`;
};

interface RatingModalProps {
  visible: boolean;
  onClose: () => void;
  onRatingComplete?: () => void;
  viewerRole: 'passenger' | 'driver';
  userId: string;
  tagId: string;
  rateUserId: string;
  rateUserName: string;
  onOpenTrustedHub?: () => void;
}

export default function RatingModal({
  visible,
  onClose,
  onRatingComplete,
  viewerRole,
  userId,
  tagId,
  rateUserId,
  rateUserName,
  onOpenTrustedHub,
}: RatingModalProps) {
  const [rating, setRating] = useState(5);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const firstName = rateUserName?.split(' ')[0] || 'Kullanıcı';
  const trustPhaseEnabled =
    !EMERGENCY_TRUST_JOURNEY_UI_DISABLED &&
    visible &&
    submitted &&
    !!String(rateUserId || '').trim() &&
    !!String(tagId || '').trim();

  const {
    status: trustedAddStatus,
    loading: trustedAddLoading,
    creating: trustedAddCreating,
    accepting: trustedAddAccepting,
    errorMessage: trustedAddErrorMessage,
    refresh: refreshTrustedAddStatus,
    performTrustedPrimaryAction,
  } = useTrustedCounterpartyStatus({
    counterpartyUserId: rateUserId || null,
    sourceTagId: tagId || null,
    enabled: trustPhaseEnabled,
    refetchOnScreenFocus: true,
  });

  useEffect(() => {
    if (!visible) {
      setSubmitted(false);
      setRating(5);
      setLoading(false);
    }
  }, [visible]);

  const handleContinue = useCallback(() => {
    onClose();
    if (onRatingComplete) {
      onRatingComplete();
    }
    setSubmitted(false);
    setRating(5);
  }, [onClose, onRatingComplete]);

  const handleSubmitRating = async () => {
    const t0 = Date.now();
    console.log(
      'RATING_SUBMIT_START',
      JSON.stringify({
        rater_user_id: maskIdForLog(userId),
        rated_user_id: maskIdForLog(rateUserId),
        tag_id: maskIdForLog(tagId),
        rating,
      }),
    );
    setLoading(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/qr/rate-user?rater_user_id=${encodeURIComponent(userId)}&rated_user_id=${encodeURIComponent(rateUserId)}&tag_id=${encodeURIComponent(tagId)}&rating=${rating}`,
        { method: 'POST' }
      );
      const result = await response.json();

      if (result.success) {
        if (result.already_rated === true) {
          setSubmitted(true);
          setRating(5);
          return;
        }
        console.log(
          'RATING_SUBMIT_DONE',
          JSON.stringify({
            ok: true,
            ms: Date.now() - t0,
            rating,
            tag_id: maskIdForLog(tagId),
          }),
        );
        setSubmitted(true);
      } else {
        console.log(
          'RATING_SUBMIT_FAIL',
          JSON.stringify({
            ok: false,
            ms: Date.now() - t0,
            status: response.status,
            detail: typeof result?.detail === 'string' ? result.detail : null,
            tag_id: maskIdForLog(tagId),
          }),
        );
        appAlert(
          'Puan gönderilemedi',
          result.detail || 'Değerlendirmen şu an kaydedilemedi. Kısa bir süre sonra tekrar dene.',
          [{ text: 'Tamam', style: 'default' }],
          { tone: 'error' },
        );
      }
    } catch (error) {
      console.log(
        'RATING_SUBMIT_FAIL',
        JSON.stringify({
          ok: false,
          ms: Date.now() - t0,
          error: true,
          tag_id: maskIdForLog(tagId),
        }),
      );
      console.error('RATING_SUBMIT_ERROR', error);
      appAlert(
        'Puan gönderilemedi',
        'Bağlantı kurulamadı. İnternetini kontrol edip tekrar dene.',
        [{ text: 'Tamam', style: 'default' }],
        { tone: 'error' },
      );
    } finally {
      setLoading(false);
    }
  };

  const renderStars = () => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => setRating(star)}
            style={styles.starBtn}
            hitSlop={{ top: 14, bottom: 14, left: 10, right: 10 }}
            activeOpacity={0.75}
          >
            <Ionicons
              name={star <= rating ? 'star' : 'star-outline'}
              size={34}
              color={
                star <= rating ? 'rgba(34,211,238,0.92)' : 'rgba(186,201,222,0.38)'
              }
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={() => {
        if (submitted) return;
        onClose();
      }}
      {...(Platform.OS === 'ios' ? { presentationStyle: 'overFullScreen' as const } : {})}
    >
      <View style={styles.overlay}>
        <CockpitBackground showGrid={false} />
        <View style={styles.scrim} pointerEvents="none" />

        <GlassSurface variant="panel" style={styles.container} borderRadius={LDS_RADIUS.xl}>
          {submitted ? (
            <GlassSurface variant="plain" borderRadius={LDS_RADIUS.lg} style={styles.successPanel}>
              <View style={styles.successContainer}>
                <View style={styles.guardianOrb}>
                  <LeylekEye
                    size={LEYLEK_EYE_ROLE_SELECT_SIZE}
                    chromeTone="subtle"
                    motionProfile="guardian"
                    accessibilityLabel="Leylek guardian"
                  />
                </View>
                <GlassSurface variant="plain" borderRadius={LDS_RADIUS.full} style={styles.successStatusChip}>
                  <PremiumText variant="caption" style={styles.successStatusChipText}>
                    Kapanış onayı
                  </PremiumText>
                </GlassSurface>
                <PremiumText variant="step" style={styles.phaseStep}>
                  Değerlendirmen kaydedildi.
                </PremiumText>
                <PremiumText variant="caption" muted style={styles.successCaption}>
                  Bu yolculuktan sonra güven ağına ekleyebilirsin.
                </PremiumText>
                {trustPhaseEnabled ? (
                  <View style={styles.trustAddWrap}>
                    <PremiumText variant="caption" muted style={styles.trustNameHint}>
                      {firstName}
                    </PremiumText>
                    <TrustedAddButton
                      viewerRole={viewerRole}
                      status={trustedAddStatus}
                      loading={trustedAddLoading}
                      creating={trustedAddCreating}
                      accepting={trustedAddAccepting}
                      errorMessage={trustedAddErrorMessage}
                      onPress={() => {
                        void performTrustedPrimaryAction();
                      }}
                      onRefresh={() => {
                        void refreshTrustedAddStatus();
                      }}
                    />
                  </View>
                ) : null}
                <TouchableOpacity
                  style={styles.continueBtn}
                  onPress={handleContinue}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="Devam et"
                >
                  <PremiumText variant="body" style={styles.continueBtnText}>
                    Devam et
                  </PremiumText>
                </TouchableOpacity>
              </View>
            </GlassSurface>
          ) : (
            <>
              <GlassSurface variant="plain" borderRadius={LDS_RADIUS.md} style={styles.phasePanel}>
                <View style={styles.phaseBlock}>
                  <PremiumText variant="step" style={styles.phaseStep}>
                    Yolculuk tamamlandı
                  </PremiumText>
                  <PremiumText variant="caption" muted style={styles.phaseCaption}>
                    Yolculuğunu değerlendirerek güven ağını güçlendirebilirsin.
                  </PremiumText>
                </View>
              </GlassSurface>

              <PremiumText variant="body" style={styles.nameCaption}>
                {`${firstName} için puanın`}
              </PremiumText>

              {renderStars()}

              <PremiumText variant="caption" style={styles.ratingText}>
                {rating} / 5
              </PremiumText>

              <TouchableOpacity
                style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
                onPress={handleSubmitRating}
                disabled={loading}
                hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
                activeOpacity={0.85}
              >
                {loading ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator color={PREMIUM_AUTH_CYAN} />
                    <PremiumText variant="caption" muted style={styles.loadingText}>
                      Değerlendirmen kaydediliyor…
                    </PremiumText>
                  </View>
                ) : (
                  <PremiumText variant="body" style={styles.submitBtnText}>
                    Puanla
                  </PremiumText>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.skipBtn} onPress={onClose} activeOpacity={0.85}>
                <GlassSurface variant="plain" borderRadius={LDS_RADIUS.md} style={styles.skipPanel}>
                  <PremiumText variant="caption" muted style={styles.skipBtnText}>
                    Şimdilik atla
                  </PremiumText>
                  <PremiumText variant="caption" muted style={styles.skipSubtext}>
                    Puanlamadan devam edebilirsin.
                  </PremiumText>
                </GlassSurface>
              </TouchableOpacity>
            </>
          )}
        </GlassSurface>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: LDS_SPACING.md,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8,17,31,0.72)',
  },
  container: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    paddingTop: LDS_SPACING.lg,
    paddingBottom: LDS_SPACING.lg,
    paddingHorizontal: LDS_SPACING.lg,
    ...LDS_ELEVATION.cockpit,
  },
  phaseBlock: {
    alignItems: 'center',
    gap: LDS_SPACING.xxs,
    paddingHorizontal: LDS_SPACING.xxs,
  },
  phasePanel: {
    width: '100%',
    alignItems: 'center',
    marginBottom: LDS_SPACING.md,
    paddingVertical: LDS_SPACING.sm,
    paddingHorizontal: LDS_SPACING.sm,
    backgroundColor: 'rgba(5,11,24,0.45)',
    borderColor: LDS_BORDER_COLOR.card,
    borderTopColor: LDS_BORDER_COLOR.cardTopCyan,
    ...LDS_ELEVATION.chip,
  },
  phaseStep: {
    textAlign: 'center',
    letterSpacing: 0.2,
    fontWeight: '700',
  },
  phaseCaption: {
    textAlign: 'center',
    lineHeight: 18,
  },
  nameCaption: {
    textAlign: 'center',
    fontWeight: '700',
    marginBottom: LDS_SPACING.sm,
  },
  starsContainer: {
    flexDirection: 'row',
    marginBottom: LDS_SPACING.sm,
    gap: LDS_SPACING.xxs,
  },
  starBtn: {
    padding: LDS_SPACING.xs,
    borderRadius: LDS_RADIUS.sm,
    backgroundColor: 'rgba(5,11,24,0.35)',
    borderWidth: LDS_BORDER_WIDTH.hairline,
    borderColor: LDS_BORDER_COLOR.card,
  },
  ratingText: {
    marginBottom: LDS_SPACING.md,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  submitBtn: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: LDS_SPACING.md,
    paddingHorizontal: LDS_SPACING.lg,
    borderRadius: LDS_RADIUS.md,
    marginBottom: LDS_SPACING.sm,
    backgroundColor: 'rgba(16,26,43,0.9)',
    borderWidth: LDS_BORDER_WIDTH.emphasis,
    borderColor: LDS_BORDER_COLOR.selected,
    borderTopColor: LDS_BORDER_COLOR.selectedTop,
    ...LDS_ELEVATION.cta,
  },
  submitBtnDisabled: {
    opacity: 0.65,
  },
  submitBtnText: {
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: LDS_SPACING.xs,
  },
  loadingText: {
    fontWeight: '600',
  },
  skipBtn: {
    width: '100%',
    alignItems: 'center',
  },
  skipPanel: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: LDS_SPACING.sm,
    paddingHorizontal: LDS_SPACING.md,
    gap: LDS_SPACING.xxs,
    backgroundColor: 'rgba(5,11,24,0.35)',
    borderColor: LDS_BORDER_COLOR.card,
    ...LDS_ELEVATION.flat,
  },
  skipBtnText: {
    fontWeight: '600',
  },
  skipSubtext: {
    textAlign: 'center',
    lineHeight: 16,
  },
  successPanel: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: LDS_SPACING.md,
    paddingHorizontal: LDS_SPACING.sm,
    backgroundColor: 'rgba(5,11,24,0.45)',
    borderColor: LDS_BORDER_COLOR.card,
    borderTopColor: LDS_BORDER_COLOR.cardTopCyan,
    ...LDS_ELEVATION.panel,
  },
  successContainer: {
    width: '100%',
    alignItems: 'center',
    gap: LDS_SPACING.xs,
  },
  guardianOrb: {
    marginBottom: LDS_SPACING.xxs,
  },
  successStatusChip: {
    paddingHorizontal: LDS_SPACING.md,
    paddingVertical: LDS_SPACING.xxs,
    marginBottom: LDS_SPACING.xxs,
    backgroundColor: 'rgba(5,11,24,0.55)',
    borderColor: LDS_BORDER_COLOR.card,
    borderTopColor: LDS_BORDER_COLOR.cardTopCyan,
    ...LDS_ELEVATION.chip,
  },
  successStatusChipText: {
    fontWeight: '600',
    letterSpacing: 0.04,
  },
  successCaption: {
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: LDS_SPACING.xs,
  },
  trustAddWrap: {
    width: '100%',
    alignSelf: 'stretch',
    marginTop: LDS_SPACING.xxs,
  },
  trustNameHint: {
    textAlign: 'center',
    marginBottom: LDS_SPACING.xxs,
    fontWeight: '600',
  },
  continueBtn: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: LDS_SPACING.sm,
    paddingVertical: LDS_SPACING.md,
    paddingHorizontal: LDS_SPACING.lg,
    borderRadius: LDS_RADIUS.md,
    backgroundColor: 'rgba(16,26,43,0.9)',
    borderWidth: LDS_BORDER_WIDTH.emphasis,
    borderColor: LDS_BORDER_COLOR.selected,
    borderTopColor: LDS_BORDER_COLOR.selectedTop,
    ...LDS_ELEVATION.cta,
  },
  continueBtnText: {
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
