/**
 * _layout.tsx - Root Layout with SocketProvider
 * 
 * Bu dosya, Expo Router'ın root layout dosyasıdır.
 * SocketProvider'ı uygulama kökünde sararak tüm ekranlarda
 * tek, kalıcı socket bağlantısı sağlar.
 * 
 * KRİTİK: Socket bağlantısı artık component lifecycle'dan BAĞIMSIZ.
 */

import React from 'react';
import { Stack } from 'expo-router';
import { SocketProvider } from '../contexts/SocketContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SocketProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'fade',
          }}
        />
      </SocketProvider>
    </SafeAreaProvider>
  );
}
