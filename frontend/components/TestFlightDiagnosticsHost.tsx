/**
 * Global iOS TestFlight diagnostics FAB (flag + iOS only).
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isTestFlightDiagnosticsEnabled } from '../lib/testFlightDebug';
import TestFlightSystemTestScreen from './TestFlightSystemTestScreen';

export default function TestFlightDiagnosticsHost() {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  if (!isTestFlightDiagnosticsEnabled()) {
    return null;
  }

  return (
    <>
      <View
        pointerEvents="box-none"
        style={[styles.fabWrap, { top: insets.top + 8 }]}
      >
        <Pressable
          style={styles.fab}
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="iOS sistem testi"
        >
          <Text style={styles.fabText}>SYS TEST</Text>
        </Pressable>
      </View>
      <TestFlightSystemTestScreen visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  fabWrap: {
    position: 'absolute',
    right: 10,
    zIndex: 99999,
    elevation: 99999,
  },
  fab: {
    backgroundColor: 'rgba(127, 29, 29, 0.94)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.55)',
  },
  fabText: {
    color: '#fecaca',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
