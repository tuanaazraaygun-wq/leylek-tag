/**
 * Uygulama genelinde Alert.alert yerine modern, tutarlı uyarı kartı.
 * appAlert(...) — Alert.alert ile aynı imza (title, message?, buttons?, options?).
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type RNAlertButton = {
  text: string;
  onPress?: (value?: string) => void;
  style?: 'default' | 'cancel' | 'destructive';
};

type ShowOptions = {
  cancelable?: boolean;
  /** Uyarı başlığı için vurgu */
  variant?: 'warning' | 'info';
};

type AlertQueueItem = {
  title: string;
  message?: string;
  buttons?: RNAlertButton[];
  options?: ShowOptions;
};

const AppAlertContext = createContext<{ enqueue: (item: AlertQueueItem) => void } | null>(null);

const alertRef: { current: ((item: AlertQueueItem) => void) | null } = { current: null };

/** Alert.alert ile uyumlu — her yerden import edilebilir */
export function appAlert(
  title: string,
  message?: string,
  buttons?: RNAlertButton[],
  options?: ShowOptions,
): void {
  const item: AlertQueueItem = { title, message, buttons, options };
  if (alertRef.current) {
    alertRef.current(item);
    return;
  }
  const fallback =
    buttons && buttons.length > 0
      ? buttons.map((b) => ({
          text: b.text,
          onPress: b.onPress,
          style: b.style,
        }))
      : [{ text: 'Tamam' }];
  Alert.alert(title, message ?? '', fallback as any, options as any);
}

export function AppAlertProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<AlertQueueItem[]>([]);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const cardMax = Math.min(360, width - 32);

  const enqueue = useCallback((item: AlertQueueItem) => {
    setQueue((q) => [...q, item]);
  }, []);

  useEffect(() => {
    alertRef.current = enqueue;
    return () => {
      alertRef.current = null;
    };
  }, [enqueue]);

  const current = queue[0] ?? null;

  const closeCurrent = useCallback(() => {
    setQueue((q) => q.slice(1));
  }, []);

  const variant = current?.options?.variant ?? 'info';
  const cancelable = current?.options?.cancelable !== false;

  const buttons = useMemo(() => {
    if (!current) return [];
    if (current.buttons && current.buttons.length > 0) return current.buttons;
    return [{ text: 'Tamam', style: 'default' as const }];
  }, [current]);

  const titleColor = variant === 'warning' ? '#DC2626' : '#0F172A';

  if (!current) {
    return (
      <AppAlertContext.Provider value={{ enqueue }}>
        {children}
      </AppAlertContext.Provider>
    );
  }

  return (
    <AppAlertContext.Provider value={{ enqueue }}>
      {children}
      <Modal
        visible
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => {
          if (cancelable) closeCurrent();
        }}
      >
        <Pressable
          style={styles.overlay}
          onPress={() => {
            if (cancelable) closeCurrent();
          }}
        >
          <Pressable
            style={[
              styles.card,
              {
                maxWidth: cardMax,
                marginTop: Math.max(insets.top, 12),
                marginBottom: Math.max(insets.bottom, 12),
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.title, { color: titleColor }]}>{current.title}</Text>
            {current.message ? (
              <ScrollView style={styles.messageScroll} keyboardShouldPersistTaps="handled">
                <Text style={styles.message}>{current.message}</Text>
              </ScrollView>
            ) : null}

            <View style={styles.buttonColumn}>
              {buttons.map((btn, idx) => {
                const isCancel = btn.style === 'cancel';
                const isDest = btn.style === 'destructive';
                return (
                  <TouchableOpacity
                    key={`${btn.text}-${idx}`}
                    activeOpacity={0.88}
                    style={[
                      styles.btnOutline,
                      isCancel && styles.btnCancelOutline,
                      isDest && styles.btnDestructiveOutline,
                    ]}
                    onPress={async () => {
                      try {
                        await btn.onPress?.();
                      } finally {
                        closeCurrent();
                      }
                    }}
                  >
                    <Text
                      style={[
                        styles.btnText,
                        isCancel && styles.btnCancelText,
                        isDest && styles.btnDestructiveText,
                      ]}
                      numberOfLines={2}
                    >
                      {btn.text}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </AppAlertContext.Provider>
  );
}

export function useAppAlert() {
  const ctx = useContext(AppAlertContext);
  if (!ctx) throw new Error('useAppAlert: AppAlertProvider eksik');
  return ctx;
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  card: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 22,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.35)',
    shadowColor: '#1E3A8A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.2,
    marginBottom: 10,
  },
  messageScroll: {
    maxHeight: 220,
    marginBottom: 16,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    color: '#334155',
    fontWeight: '500',
  },
  buttonColumn: {
    gap: 10,
  },
  btnOutline: {
    borderWidth: 2,
    borderColor: '#2563EB',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCancelOutline: {
    borderColor: '#94A3B8',
    backgroundColor: '#F1F5F9',
  },
  btnDestructiveOutline: {
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  btnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#B91C1C',
    textAlign: 'center',
  },
  btnCancelText: {
    color: '#475569',
  },
  btnDestructiveText: {
    color: '#991B1B',
  },
});
