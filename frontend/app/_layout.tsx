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
import { TrustProvider } from '../contexts/TrustContext';
import LeylekZekaWidget from '../components/LeylekZekaWidget';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

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
  useEffect(() => {
    void ExpoSplashScreen.hideAsync().catch(() => {});
  }, []);

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
          console.log('[PUSH] Android channels ready');
        }
      } catch (err) {
        if (!cancelled) console.warn(err);
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
                <TrustProvider>

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

                </TrustProvider>
              </SocketProvider>
            </NotificationProvider>
          </PushNotificationsProvider>
        </AppAlertProvider>
      </SafeAreaProvider>
    </RootErrorBoundary>
  );
}