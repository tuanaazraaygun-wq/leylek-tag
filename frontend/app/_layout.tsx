/**
 * _layout.tsx - Root Layout with SocketProvider & NotificationProvider
 * 
 * Bu dosya, Expo Router'ın root layout dosyasıdır.
 * SocketProvider'ı uygulama kökünde sararak tüm ekranlarda
 * tek, kalıcı socket bağlantısı sağlar.
 * NotificationProvider bildirim dinleyicilerini yönetir.
 * PushNotificationsProvider Expo token + kanalları kökte mount eder (route’tan bağımsız).
 *
 * KRİTİK: Socket bağlantısı artık component lifecycle'dan BAĞIMSIZ.
 * Global push: handler + Android default/offers kanalları (Expo Router’da App.tsx yok, kök burası).
 */

import React, { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { Stack } from 'expo-router';
import * as ExpoSplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { SocketProvider } from '../contexts/SocketContext';
import { NotificationProvider } from '../contexts/NotificationContext';
import { PushNotificationsProvider } from '../hooks/usePushNotifications';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { RootErrorBoundary } from '../components/RootErrorBoundary';
import { AppAlertProvider } from '../contexts/AppAlertContext';
import { LeylekZekaChromeProvider } from '../contexts/LeylekZekaChromeContext';
import LeylekZekaWidget from '../components/LeylekZekaWidget';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Uygulama açıkken (foreground) da uyarı göster — tek tanım, component dışı
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function RootLayout() {
  // Native splash’i hemen kapat — aksi halde APK’da Leylek görseli üstte kalıp JS ekranı hiç görünmeyebilir
  useEffect(() => {
    void ExpoSplashScreen.hideAsync().catch(() => {});
  }, []);

  // Android: default + offers (MAX) — push token kaydından önce; usePushNotifications içinde tekrar yok
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    let cancelled = false;
    (async () => {
      try {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Default',
          importance: Notifications.AndroidImportance.MAX,
          sound: 'default',
        });
        await Notifications.setNotificationChannelAsync('offers', {
          name: 'Offers',
          importance: Notifications.AndroidImportance.MAX,
          sound: 'default',
        });
        if (!cancelled) {
          console.log('[PUSH] Android channels: default, offers (MAX)');
        }
      } catch (err) {
        if (!cancelled) console.warn('[PUSH] Android channel setup failed:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <RootErrorBoundary>
      <SafeAreaProvider>
        <AppAlertProvider>
          <PushNotificationsProvider>
            <NotificationProvider>
              <SocketProvider>
                <StatusBar style="dark" />
                <LeylekZekaChromeProvider>
                  <GestureHandlerRootView style={{ flex: 1 }}>
                    <View style={{ flex: 1 }}>
                      <Stack
                        screenOptions={{
                          headerShown: false,
                          animation: 'fade',
                        }}
                      />
                      <LeylekZekaWidget />
                    </View>
                  </GestureHandlerRootView>
                </LeylekZekaChromeProvider>
              </SocketProvider>
            </NotificationProvider>
          </PushNotificationsProvider>
        </AppAlertProvider>
      </SafeAreaProvider>
    </RootErrorBoundary>
  );
}
