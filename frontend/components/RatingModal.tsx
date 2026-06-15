import React, { useState } from 'react';
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
import { API_BASE_URL } from '../lib/backendConfig';

const maskIdForLog = (v: string): string => {
  const s = String(v || '').trim();
  if (!s) return 'n/a';
  if (s.length <= 8) return `***${s.slice(-2)}`;
  return `${s.slice(0, 4)}***${s.slice(-4)}`;
};

interface RatingModalProps {
  visible: boolean;
  onClose: () => void;
  onRatingComplete?: () => void; // 🆕 Puanlama tamamlandığında çağrılır
  userId: string;
  tagId: string;
  rateUserId: string;
  rateUserName: string;
}

export default function RatingModal({
  visible,
  onClose,
  onRatingComplete,
  userId,
  tagId,
  rateUserId,
  rateUserName,
}: RatingModalProps) {
  const [rating, setRating] = useState(5);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const firstName = rateUserName?.split(' ')[0] || 'Kullanıcı';

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
          setSubmitted(false);
          setRating(5);
          setLoading(false);
          onClose();
          if (onRatingComplete) {
            onRatingComplete();
          }
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
        setTimeout(() => {
          onClose();
          // 🆕 Puanlama tamamlandığında state'leri temizle
          if (onRatingComplete) {
            onRatingComplete();
          }
          setSubmitted(false);
          setRating(5);
        }, 2000);
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
          result.detail || 'Değerlendirmen şu an kaydedilemedi. Biraz sonra tekrar dene.',
          [{ text: 'Tamam' }],
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
        [{ text: 'Tamam' }],
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
      {...(Platform.OS === 'ios' ? { presentationStyle: 'overFullScreen' as const } : {})}
    >
      <View style={styles.overlay}>
        <CockpitBackground showGrid={false} />
        <View style={styles.scrim} pointerEvents="none" />

        <GlassSurface variant="panel" style={styles.container} borderRadius={LDS_RADIUS.xl}>
          {submitted ? (
            <View style={styles.successContainer}>
              <View style={styles.guardianOrb}>
                <LeylekEye
                  size={LEYLEK_EYE_ROLE_SELECT_SIZE}
                  chromeTone="subtle"
                  motionProfile="guardian"
                  accessibilityLabel="Leylek guardian"
                />
              </View>
              <PremiumText variant="step" style={styles.phaseStep}>
                Değerlendirme kaydedildi
              </PremiumText>
              <PremiumText variant="caption" muted style={styles.successCaption}>
                Yolculuk kapanışına katkın güven ağına eklendi
              </PremiumText>
            </View>
          ) : (
            <>
              <View style={styles.phaseBlock}>
                <PremiumText variant="step" style={styles.phaseStep}>
                  Yolculuk tamamlandı
                </PremiumText>
                <PremiumText variant="caption" muted style={styles.phaseCaption}>
                  Deneyimini puanlayarak yolculuk kaydını tamamla
                </PremiumText>
              </View>

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
                  <ActivityIndicator color={PREMIUM_AUTH_CYAN} />
                ) : (
                  <PremiumText variant="body" style={styles.submitBtnText}>
                    Puanla
                  </PremiumText>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.skipBtn} onPress={onClose}>
                <PremiumText variant="caption" muted style={styles.skipBtnText}>
                  Şimdilik atla
                </PremiumText>
                <PremiumText variant="caption" muted style={styles.skipSubtext}>
                  Puanlamadan devam edebilirsin
                </PremiumText>
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
    marginBottom: LDS_SPACING.md,
    paddingHorizontal: LDS_SPACING.xxs,
  },
  phaseStep: {
    textAlign: 'center',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
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
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: LDS_SPACING.sm,
    gap: LDS_SPACING.xxs,
  },
  skipBtnText: {
    fontWeight: '600',
  },
  skipSubtext: {
    textAlign: 'center',
    lineHeight: 16,
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: LDS_SPACING.sm,
    gap: LDS_SPACING.xs,
  },
  guardianOrb: {
    marginBottom: LDS_SPACING.xs,
  },
  successCaption: {
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: LDS_SPACING.xs,
  },
});
