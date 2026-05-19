import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';

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
        Alert.alert('Hata', result.detail || 'Puanlama gönderilemedi');
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
      Alert.alert('Hata', 'Puanlama gönderilemedi');
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
          >
            <Text style={[styles.star, star <= rating && styles.starActive]}>
              ★
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {submitted ? (
            <View style={styles.successContainer}>
              <Text style={styles.successIcon}>✓</Text>
              <Text style={styles.successTitle}>Teşekkürler!</Text>
              <Text style={styles.successText}>
                {`${firstName}'a ${rating} ⭐ verdiniz`}
              </Text>
              <Text style={styles.pointsText}>+3 puan kazandınız!</Text>
            </View>
          ) : (
            <>
              <Text style={styles.title}>Yolculuk Tamamlandı!</Text>
              <Text style={styles.subtitle}>
                {`${firstName}'ı puanlayın`}
              </Text>

              {renderStars()}

              <Text style={styles.ratingText}>{rating} / 5</Text>

              <TouchableOpacity
                style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
                onPress={handleSubmitRating}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#22D3EE" />
                ) : (
                  <Text style={styles.submitBtnText}>Puanla</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.skipBtn} onPress={onClose}>
                <Text style={styles.skipBtnText}>Atla</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(8,17,31,0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  container: {
    backgroundColor: 'rgba(16, 26, 43, 0.88)',
    borderRadius: 24,
    padding: 28,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E3A5F',
    borderTopColor: 'rgba(34, 211, 238, 0.2)',
    ...Platform.select({
      ios: {
        shadowColor: '#010818',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.45,
        shadowRadius: 24,
      },
      android: { elevation: 12 },
      default: {},
    }),
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: 'rgba(243,248,255,0.94)',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(186,201,222,0.82)',
    marginBottom: 22,
    textAlign: 'center',
  },
  starsContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  starBtn: {
    padding: 8,
  },
  star: {
    fontSize: 40,
    color: 'rgba(186,201,222,0.35)',
  },
  starActive: {
    color: '#22D3EE',
    textShadowColor: 'rgba(34, 211, 238, 0.32)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  ratingText: {
    fontSize: 17,
    color: 'rgba(243,248,255,0.94)',
    marginBottom: 22,
    fontWeight: '700',
  },
  submitBtn: {
    backgroundColor: '#22D3EE',
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.45)',
    shadowColor: '#22D3EE',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 6,
  },
  submitBtnDisabled: {
    opacity: 0.65,
  },
  submitBtnText: {
    color: '#08111F',
    fontSize: 17,
    fontWeight: '800',
  },
  skipBtn: {
    paddingVertical: 12,
  },
  skipBtnText: {
    color: 'rgba(186,201,222,0.82)',
    fontSize: 14,
    fontWeight: '600',
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  successIcon: {
    fontSize: 56,
    color: 'rgba(110,231,183,0.92)',
    marginBottom: 14,
    textShadowColor: 'rgba(34, 211, 238, 0.12)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: 'rgba(243,248,255,0.94)',
    marginBottom: 8,
  },
  successText: {
    fontSize: 15,
    color: 'rgba(186,201,222,0.82)',
    marginBottom: 8,
    textAlign: 'center',
  },
  pointsText: {
    fontSize: 17,
    color: 'rgba(110,231,183,0.95)',
    fontWeight: '700',
  },
});
