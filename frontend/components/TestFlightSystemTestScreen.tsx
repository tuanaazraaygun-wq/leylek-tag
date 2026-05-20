/**
 * iOS TestFlight — read-only sistem test ekranı (Modal).
 */
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSocketContext } from '../contexts/SocketContext';
import { isTestFlightDiagnosticsEnabled } from '../lib/testFlightDebug';
import {
  runAllSystemTests,
  type SystemTestResult,
  type SystemTestStatus,
} from '../lib/testFlightSystemTests';

type TestFlightSystemTestScreenProps = {
  visible: boolean;
  onClose: () => void;
};

function statusColor(status: SystemTestStatus): string {
  if (status === 'pass') return '#4ade80';
  if (status === 'fail') return '#f87171';
  if (status === 'skip') return '#fbbf24';
  return '#94a3b8';
}

export default function TestFlightSystemTestScreen({
  visible,
  onClose,
}: TestFlightSystemTestScreenProps) {
  const { isConnected, isRegistered } = useSocketContext();
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<SystemTestResult[]>([]);
  const [lastRunAt, setLastRunAt] = useState<number | null>(null);

  const runTests = useCallback(async () => {
    setRunning(true);
    try {
      const out = await runAllSystemTests({ isConnected, isRegistered });
      setResults(out);
      setLastRunAt(Date.now());
    } finally {
      setRunning(false);
    }
  }, [isConnected, isRegistered]);

  if (!isTestFlightDiagnosticsEnabled()) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text style={styles.title}>iOS Sistem Testi</Text>
          <Text style={styles.subtitle}>Read-only · TestFlight debug</Text>
        </View>

        <View style={styles.actions}>
          <Pressable
            style={[styles.btn, styles.btnPrimary, running && styles.btnDisabled]}
            onPress={() => void runTests()}
            disabled={running}
          >
            {running ? (
              <ActivityIndicator color="#0f172a" size="small" />
            ) : (
              <Text style={styles.btnPrimaryText}>Tümünü Çalıştır</Text>
            )}
          </Pressable>
          <Pressable style={[styles.btn, styles.btnSecondary]} onPress={onClose}>
            <Text style={styles.btnSecondaryText}>Kapat</Text>
          </Pressable>
        </View>

        {lastRunAt != null ? (
          <Text style={styles.meta}>
            Son çalıştırma: {new Date(lastRunAt).toLocaleTimeString()} · socket=
            {isConnected ? 'on' : 'off'} reg={isRegistered ? 'yes' : 'no'}
          </Text>
        ) : (
          <Text style={styles.meta}>Henüz test çalıştırılmadı.</Text>
        )}

        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {results.length === 0 && !running ? (
            <Text style={styles.hint}>
              Eşleşme/teklif sorunlarını görmek için ilgili ekrana gidin, sonra «Tümünü
              Çalıştır» deyin. Offer/route satırları anlık snapshot okur.
            </Text>
          ) : null}
          {results.map((row) => (
            <View key={row.id} style={styles.row}>
              <View style={styles.rowTop}>
                <Text style={[styles.badge, { color: statusColor(row.status) }]}>
                  {row.status.toUpperCase()}
                </Text>
                <Text style={styles.rowLabel}>{row.label}</Text>
              </View>
              <Text style={styles.rowDetail}>{row.detail}</Text>
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  title: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '800',
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  btnPrimary: {
    backgroundColor: '#22d3ee',
  },
  btnPrimaryText: {
    color: '#0f172a',
    fontWeight: '800',
    fontSize: 14,
  },
  btnSecondary: {
    backgroundColor: 'rgba(148,163,184,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.35)',
  },
  btnSecondaryText: {
    color: '#e2e8f0',
    fontWeight: '700',
    fontSize: 14,
  },
  btnDisabled: {
    opacity: 0.7,
  },
  meta: {
    color: '#64748b',
    fontSize: 11,
    paddingHorizontal: 16,
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  hint: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  row: {
    backgroundColor: 'rgba(30,41,59,0.85)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(51,65,85,0.6)',
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  badge: {
    fontSize: 10,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  rowLabel: {
    flex: 1,
    color: '#f1f5f9',
    fontSize: 13,
    fontWeight: '700',
  },
  rowDetail: {
    color: '#cbd5e1',
    fontSize: 11,
    lineHeight: 15,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
