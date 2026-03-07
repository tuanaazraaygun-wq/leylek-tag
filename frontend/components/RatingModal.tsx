import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://tag-dispatch.preview.emergentagent.com';

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
    setLoading(true);
    try {
      const response = await fetch(
        `${API_URL}/api/qr/rate-user?rater_user_id=${userId}&rated_user_id=${rateUserId}&tag_id=${tagId}&rating=${rating}`,
        { method: 'POST' }
      );
      const result = await response.json();

      if (result.success) {
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
        Alert.alert('Hata', result.detail || 'Puanlama gönderilemedi');
      }
    } catch (error) {
      console.error('Rating error:', error);
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
                {firstName}'a {rating} ⭐ verdiniz
              </Text>
              <Text style={styles.pointsText}>+3 puan kazandınız!</Text>
            </View>
          ) : (
            <>
              <Text style={styles.title}>Yolculuk Tamamlandı!</Text>
              <Text style={styles.subtitle}>
                {firstName}'ı puanlayın
              </Text>

              {renderStars()}

              <Text style={styles.ratingText}>{rating} / 5</Text>

              <TouchableOpacity
                style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
                onPress={handleSubmitRating}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="white" />
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
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: '#1a1a2e',
    borderRadius: 24,
    padding: 32,
    width: '85%',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#9CA3AF',
    marginBottom: 24,
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
    color: '#4B5563',
  },
  starActive: {
    color: '#FCD34D',
  },
  ratingText: {
    fontSize: 18,
    color: 'white',
    marginBottom: 24,
  },
  submitBtn: {
    backgroundColor: '#3FA9F5',
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitBtnText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  skipBtn: {
    paddingVertical: 12,
  },
  skipBtnText: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  successIcon: {
    fontSize: 60,
    color: '#10B981',
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  successText: {
    fontSize: 16,
    color: '#9CA3AF',
    marginBottom: 8,
  },
  pointsText: {
    fontSize: 18,
    color: '#10B981',
    fontWeight: '600',
  },
});
