/**
 * _layout.tsx - Root Layout with SocketProvider & NotificationProvider
 * 
 * Bu dosya, Expo Router'ın root layout dosyasıdır.
 * SocketProvider'ı uygulama kökünde sararak tüm ekranlarda
 * tek, kalıcı socket bağlantısı sağlar.
 * NotificationProvider bildirim sistemini yönetir.
 * 
 * KRİTİK: Socket bağlantısı artık component lifecycle'dan BAĞIMSIZ.
 * Bildirim handler ve Android "default" kanalı uygulama açılışında oluşturulur.
 */

import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { SocketProvider } from '../contexts/SocketContext';
import { NotificationProvider } from '../contexts/NotificationContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

// Bildirimler önde/arkada görünsün, ses çalsın
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function RootLayout() {
  // Android: "default" bildirim kanalını uygulama açılışında oluştur (token kaydından önce)
  useEffect(() => {
    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      }).then(() => {
        console.log('[PUSH] Android "default" notification channel created on app startup');
      }).catch((err) => {
        console.warn('[PUSH] Android default channel creation failed:', err);
      });
    }
  }, []);

  return (
    <SafeAreaProvider>
      <NotificationProvider>
        <SocketProvider>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerShown: false,
              animation: 'fade',
            }}
          />
        </SocketProvider>
      </NotificationProvider>
    </SafeAreaProvider>
  );
}
