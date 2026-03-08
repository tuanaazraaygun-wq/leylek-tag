/**
 * SoundButton - Tuş sesi ile TouchableOpacity
 * Her tuşa basıldığında nazik bir tıklama sesi çalar
 */

import React, { useCallback } from 'react';
import { TouchableOpacity, TouchableOpacityProps, Platform } from 'react-native';
import { Audio } from 'expo-av';

// Ses dosyası URL'si - hafif, nazik tıklama sesi
const TAP_SOUND_URL = 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3';

// Ses önbelleği
let cachedSound: Audio.Sound | null = null;

// Sesi önceden yükle
const preloadSound = async () => {
  try {
    if (!cachedSound) {
      const { sound } = await Audio.Sound.createAsync(
        { uri: TAP_SOUND_URL },
        { volume: 0.25 }
      );
      cachedSound = sound;
    }
  } catch (e) {
    // Sessiz hata
  }
};

// İlk yüklemede sesi hazırla
preloadSound();

// Tuş sesi çal
const playTapSound = async () => {
  try {
    // Yeni ses objesi oluştur (hızlı ardışık tıklamalar için)
    const { sound } = await Audio.Sound.createAsync(
      { uri: TAP_SOUND_URL },
      { shouldPlay: true, volume: 0.25 }
    );
    
    // Ses bitince temizle
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        sound.unloadAsync();
      }
    });
  } catch (error) {
    // Sessiz hata - kullanıcı deneyimini bozma
  }
};

interface SoundButtonProps extends TouchableOpacityProps {
  enableSound?: boolean;
}

export default function SoundButton({ 
  onPress, 
  enableSound = true,
  children, 
  ...props 
}: SoundButtonProps) {
  
  const handlePress = useCallback((event: any) => {
    // Tuş sesini çal
    if (enableSound && Platform.OS !== 'web') {
      playTapSound();
    }
    
    // Orijinal onPress'i çağır
    if (onPress) {
      onPress(event);
    }
  }, [onPress, enableSound]);

  return (
    <TouchableOpacity 
      {...props} 
      onPress={handlePress}
      activeOpacity={0.7}
    >
      {children}
    </TouchableOpacity>
  );
}

// Export tap sound function for use elsewhere
export { playTapSound };
