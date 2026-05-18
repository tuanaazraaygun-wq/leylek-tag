import React, { memo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ActivityIndicator,
  Animated,
  Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

export type TrustRequestModalProps = {
  visible: boolean;
  /** İsteği gönderen taraf */
  requesterRole: 'driver' | 'passenger';
  loading?: boolean;
  onAccept: () => void;
  onReject: () => void;
};

const TrustRequestModal = memo(function TrustRequestModal({
  visible,
  requesterRole,
  loading = false,
  onAccept,
  onReject,
}: TrustRequestModalProps) {
  const pulse = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulse, {
            toValue: 1.04,
            duration: 1200,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(glow, {
            toValue: 0.85,
            duration: 1200,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(pulse, {
            toValue: 1,
            duration: 1200,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(glow, {
            toValue: 0.38,
            duration: 1200,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [visible, pulse, glow]);

  const title =
    requesterRole === 'driver'
      ? 'Sürücü sizden güven almak istiyor'
      : 'Yolcu sizden güven almak istiyor';

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <LinearGradient
              colors={['rgba(16,26,43,0.95)', '#0F3D4F', '#1E3A5F']}
              style={styles.iconGrad}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="shield-checkmark" size={36} color="#22D3EE" />
            </LinearGradient>
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>
            En fazla 5 dakikalık görüntülü güven görüşmesi başlatılacak
          </Text>
          <Text style={styles.hint}>
            Onaylarsanız kısa süreli canlı görüntü paylaşımı açılır. Müsait değilseniz aşağıdaki seçeneği kullanabilirsiniz.
          </Text>

          <View style={styles.actions}>
            <Animated.View style={{ transform: [{ scale: pulse }], opacity: glow }}>
              <Pressable
                onPress={() => {
                  if (!loading) onAccept();
                }}
                disabled={loading}
                style={({ pressed }) => [pressed && { opacity: 0.92 }]}
              >
                <LinearGradient
                  colors={['rgba(8,17,31,0.96)', '#0E4F5E', '#0E7490', '#22D3EE']}
                  locations={[0, 0.45, 0.78, 1]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.btnPrimary}
                >
                  {loading ? (
                    <ActivityIndicator color="rgba(243,248,255,0.94)" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={22} color="rgba(243,248,255,0.94)" style={{ marginRight: 8 }} />
                      <Text style={styles.btnPrimaryText}>Güven Ver</Text>
                    </>
                  )}
                </LinearGradient>
              </Pressable>
            </Animated.View>

            <Pressable
              onPress={() => {
                if (!loading) onReject();
              }}
              disabled={loading}
              style={({ pressed }) => [styles.btnDangerWrap, pressed && { opacity: 0.9 }]}
            >
              <LinearGradient
                colors={[
                  'rgba(45, 24, 28, 0.92)',
                  'rgba(80, 32, 36, 0.85)',
                  'rgba(112, 40, 44, 0.78)',
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.btnDanger}
              >
                <Ionicons name="close-circle" size={22} color="#FECACA" style={{ marginRight: 8 }} />
                <Text style={styles.btnDangerText}>Müsait Değilim</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(8, 17, 31, 0.78)',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  card: {
    borderRadius: 20,
    paddingVertical: 26,
    paddingHorizontal: 22,
    backgroundColor: 'rgba(16, 26, 43, 0.94)',
    borderWidth: 1,
    borderColor: '#1E3A5F',
    borderTopColor: 'rgba(34, 211, 238, 0.32)',
    shadowColor: '#010818',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 14,
  },
  iconWrap: {
    alignSelf: 'center',
    marginBottom: 16,
  },
  iconGrad: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.35)',
  },
  title: {
    color: 'rgba(243, 248, 255, 0.94)',
    fontSize: 19,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 26,
    letterSpacing: -0.2,
  },
  subtitle: {
    marginTop: 12,
    color: 'rgba(186, 201, 222, 0.82)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  hint: {
    marginTop: 10,
    color: 'rgba(186, 201, 222, 0.72)',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
  },
  actions: {
    marginTop: 24,
    gap: 12,
  },
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.42)',
  },
  btnPrimaryText: {
    color: 'rgba(243, 248, 255, 0.94)',
    fontSize: 16,
    fontWeight: '700',
  },
  btnDangerWrap: {
    marginTop: 4,
  },
  btnDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.38)',
  },
  btnDangerText: {
    color: '#FECACA',
    fontSize: 15,
    fontWeight: '700',
  },
});

export default TrustRequestModal;
