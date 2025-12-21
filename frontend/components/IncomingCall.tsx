import React, { useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Animated, Vibration, Platform, AppState, AppStateStatus } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Audio } from 'expo-av';

interface IncomingCallProps {
  visible: boolean;
  callerName: string;
  callType: 'audio' | 'video';
  onAccept: () => void;
  onReject: () => void;
}

export default function IncomingCall({
  visible,
  callerName,
  callType,
  onAccept,
  onReject,
}: IncomingCallProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const ringAnim = useRef(new Animated.Value(0)).current;
  const soundRef = useRef<Audio.Sound | null>(null);
  const isCleanedUp = useRef(false);
  const pulseAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const ringAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  // Zil sesi başlat
  const playRingtone = async () => {
    if (isCleanedUp.current) return;
    
    try {
      // Önceki sesi temizle
      if (soundRef.current) {
        try {
          await soundRef.current.stopAsync();
          await soundRef.current.unloadAsync();
        } catch (e) {}
        soundRef.current = null;
      }
      
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false, // Background'da çalmayı kapat
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
      });
      
      // Varsayılan sistem zil sesi kullan
      const { sound } = await Audio.Sound.createAsync(
        { uri: 'https://www.soundjay.com/phone/sounds/telephone-ring-04.mp3' },
        { isLooping: true, volume: 1.0 }
      );
      
      if (isCleanedUp.current) {
        // Temizleme sırasında oluşturulduysa hemen kapat
        await sound.stopAsync();
        await sound.unloadAsync();
        return;
      }
      
      soundRef.current = sound;
      await sound.playAsync();
      console.log('🔔 Zil sesi başlatıldı');
    } catch (error) {
      console.log('Zil sesi hatası:', error);
    }
  };

  // Zil sesini durdur - daha güçlü temizlik
  const stopRingtone = useCallback(async () => {
    console.log('🔕 Zil sesi durduruluyor...');
    
    try {
      const sound = soundRef.current;
      soundRef.current = null; // Hemen null yap
      
      if (sound) {
        try {
          const status = await sound.getStatusAsync();
          if (status.isLoaded) {
            await sound.stopAsync();
          }
        } catch (e) {
          console.log('Stop hatası (önemsiz):', e);
        }
        
        try {
          await sound.unloadAsync();
        } catch (e) {
          console.log('Unload hatası (önemsiz):', e);
        }
        
        console.log('🔕 Zil sesi DURDURULDU');
      }
    } catch (error) {
      console.log('Zil durdurma hatası:', error);
    }
  }, []);

  // Tüm animasyonları durdur
  const stopAnimations = useCallback(() => {
    if (pulseAnimRef.current) {
      pulseAnimRef.current.stop();
      pulseAnimRef.current = null;
    }
    if (ringAnimRef.current) {
      ringAnimRef.current.stop();
      ringAnimRef.current = null;
    }
    pulseAnim.setValue(1);
    ringAnim.setValue(0);
  }, []);

  // Tam temizlik fonksiyonu
  const fullCleanup = useCallback(async () => {
    console.log('🧹 IncomingCall FULL CLEANUP');
    isCleanedUp.current = true;
    
    // Animasyonları durdur
    stopAnimations();
    
    // Titreşimi durdur
    try {
      Vibration.cancel();
    } catch (e) {}
    
    // Sesi durdur
    await stopRingtone();
  }, [stopAnimations, stopRingtone]);

  // App state değişikliğini dinle (arka plana atılınca durdur)
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        console.log('📱 Uygulama arka plana gitti, zil durduruluyor');
        fullCleanup();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [fullCleanup]);

  useEffect(() => {
    if (visible) {
      isCleanedUp.current = false;
      
      // Zil sesi çal
      if (Platform.OS !== 'web') {
        playRingtone();
      }
      
      // Titreşim
      if (Platform.OS !== 'web') {
        const pattern = [0, 500, 200, 500, 200, 500, 200, 500, 200, 500];
        Vibration.vibrate(pattern, true);
      }

      // Pulse animasyonu
      pulseAnimRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      );
      pulseAnimRef.current.start();

      // Ring animasyonu
      ringAnimRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(ringAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(ringAnim, {
            toValue: -1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(ringAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ])
      );
      ringAnimRef.current.start();
    } else {
      // Visible false olduğunda temizlik yap
      fullCleanup();
    }

    return () => {
      // Unmount temizliği
      fullCleanup();
    };
  }, [visible, fullCleanup]);

  // Accept ve Reject'te zil sesini durdur
  const handleAccept = async () => {
    await fullCleanup();
    onAccept();
  };

  const handleReject = async () => {
    await fullCleanup();
    onReject();
  };

  const ringRotate = ringAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-15deg', '0deg', '15deg'],
  });

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <LinearGradient
        colors={callType === 'video' ? ['#1e3a8a', '#3b82f6', '#60a5fa'] : ['#065f46', '#10b981', '#34d399']}
        style={styles.container}
      >
        {/* Üst Kısım - Arayan Bilgisi */}
        <View style={styles.callerInfo}>
          <Text style={styles.callTypeText}>
            {callType === 'video' ? '📹 Görüntülü Arama' : '📞 Sesli Arama'}
          </Text>
          
          <Animated.View style={[styles.avatarContainer, { transform: [{ scale: pulseAnim }] }]}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{callerName?.[0] || '?'}</Text>
            </View>
          </Animated.View>

          <Text style={styles.callerName}>{callerName}</Text>
          <Text style={styles.callingText}>arıyor...</Text>

          <Animated.View style={{ transform: [{ rotate: ringRotate }] }}>
            <Ionicons name={callType === 'video' ? 'videocam' : 'call'} size={40} color="rgba(255,255,255,0.5)" />
          </Animated.View>
        </View>

        {/* Alt Kısım - Butonlar */}
        <View style={styles.buttonsContainer}>
          {/* Reddet Butonu */}
          <TouchableOpacity style={styles.buttonWrapper} onPress={handleReject}>
            <View style={styles.rejectButton}>
              <Ionicons name="close" size={36} color="#FFF" />
            </View>
            <Text style={styles.buttonLabel}>Reddet</Text>
          </TouchableOpacity>

          {/* Kabul Et Butonu */}
          <TouchableOpacity style={styles.buttonWrapper} onPress={handleAccept}>
            <Animated.View style={[styles.acceptButton, { transform: [{ scale: pulseAnim }] }]}>
              <Ionicons name={callType === 'video' ? 'videocam' : 'call'} size={36} color="#FFF" />
            </Animated.View>
            <Text style={styles.buttonLabel}>Kabul Et</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: 80,
  },
  callerInfo: {
    alignItems: 'center',
    marginTop: 40,
  },
  callTypeText: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 30,
  },
  avatarContainer: {
    marginBottom: 20,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  avatarText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFF',
  },
  callerName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 8,
  },
  callingText: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 30,
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 80,
    paddingBottom: 40,
  },
  buttonWrapper: {
    alignItems: 'center',
  },
  rejectButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#dc2626',
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#22c55e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonLabel: {
    marginTop: 12,
    fontSize: 16,
    color: '#FFF',
    fontWeight: '600',
  },
});
