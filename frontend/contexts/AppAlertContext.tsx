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
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Tasarım sözleşmesi — merkezi appAlert kokpit yüzü */
const OVERLAY_BG = 'rgba(2,6,23,0.72)';
const CARD_BG = 'rgba(16,26,43,0.92)';
const BORDER_SLATE = '#1E3A5F';
const ACCENT_CYAN = '#22D3EE';
const TEXT_PRIMARY = 'rgba(243,248,255,0.94)';
const TEXT_MUTED = 'rgba(186,201,222,0.82)';

type RNAlertButton = {
  text: string;
  onPress?: (value?: string) => void;
  style?: 'default' | 'cancel' | 'destructive';
};

type AlertTone = 'info' | 'success' | 'warning' | 'error';

type ShowOptions = {
  cancelable?: boolean;
  /** Uyarı başlığı için vurgu (mevcut API — `tone` yoksa türetilir) */
  variant?: 'warning' | 'info';
  /**
   * İsteğe bağlı görsel ton. Verilmezse: `variant === 'warning'` → `warning`,
   * aksi halde `info` (geri uyumluluk).
   */
  tone?: AlertTone;
  /**
   * >0 ise kart bu süre sonra kendiliğinden kapanır; `buttons` boş bırakılabilir (Tamam zorunlu değil).
   */
  autoDismissMs?: number;
};

type AlertQueueItem = {
  title: string;
  message?: string;
  buttons?: RNAlertButton[];
  options?: ShowOptions;
};

function resolveTone(options: ShowOptions | undefined): AlertTone {
  if (options?.tone) return options.tone;
  if (options?.variant === 'warning') return 'warning';
  return 'info';
}

function toneAccentMeta(tone: AlertTone): {
  iconName: keyof typeof Ionicons.glyphMap;
  subtleBorder: string;
  iconColor: string;
} {
  switch (tone) {
    case 'success':
      return {
        iconName: 'checkmark-circle-outline',
        subtleBorder: 'rgba(52,211,153,0.38)',
        iconColor: 'rgba(52,211,153,0.92)',
      };
    case 'warning':
      return {
        iconName: 'warning-outline',
        subtleBorder: 'rgba(251,191,36,0.42)',
        iconColor: 'rgba(253,224,71,0.92)',
      };
    case 'error':
      return {
        iconName: 'close-circle-outline',
        subtleBorder: 'rgba(239,68,68,0.38)',
        iconColor: 'rgba(248,113,113,0.92)',
      };
    default:
      return {
        iconName: 'information-circle-outline',
        subtleBorder: 'rgba(34,211,238,0.32)',
        iconColor: ACCENT_CYAN,
      };
  }
}

function titleColorForTone(tone: AlertTone): string {
  switch (tone) {
    case 'success':
      return 'rgba(167,243,208,0.96)';
    case 'warning':
      return 'rgba(253,224,71,0.95)';
    case 'error':
      return 'rgba(252,165,165,0.96)';
    default:
      return TEXT_PRIMARY;
  }
}

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
    buttons !== undefined && buttons.length > 0
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

  const cancelable = current?.options?.cancelable !== false;
  const autoDismissMs = current?.options?.autoDismissMs;

  const effectiveTone = useMemo(
    () => (current ? resolveTone(current.options) : 'info'),
    [current],
  );

  const toneMeta = useMemo(() => toneAccentMeta(effectiveTone), [effectiveTone]);

  const titleColor = useMemo(() => titleColorForTone(effectiveTone), [effectiveTone]);

  useEffect(() => {
    const ms = typeof autoDismissMs === 'number' && autoDismissMs > 0 ? autoDismissMs : 0;
    if (!current || !ms) return;
    const t = setTimeout(() => {
      closeCurrent();
    }, ms);
    return () => clearTimeout(t);
  }, [current, autoDismissMs, closeCurrent]);

  const buttons = useMemo(() => {
    if (!current) return [];
    if (current.buttons !== undefined) {
      const raw = current.buttons;
      const ms = current.options?.autoDismissMs;
      if (raw.length === 0 && (!ms || ms <= 0)) {
        return [{ text: 'Tamam', style: 'default' as const }];
      }
      return raw;
    }
    return [{ text: 'Tamam', style: 'default' as const }];
  }, [current]);

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
                borderLeftColor: toneMeta.subtleBorder,
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <LinearGradient
              colors={[
                'rgba(34,211,238,0.07)',
                'rgba(34,211,238,0)',
              ]}
              start={{ x: 0.1, y: 0 }}
              end={{ x: 0.6, y: 0.85 }}
              pointerEvents="none"
              style={StyleSheet.absoluteFillObject}
            />

            <View style={styles.toneRow}>
              <View style={[styles.toneIconOrb, { borderColor: toneMeta.subtleBorder }]}>
                <Ionicons name={toneMeta.iconName} size={22} color={toneMeta.iconColor} />
              </View>
              <Text style={[styles.title, { color: titleColor }]}>{current.title}</Text>
            </View>

            {current.message ? (
              <ScrollView style={styles.messageScroll} keyboardShouldPersistTaps="handled">
                <Text style={styles.message}>{current.message}</Text>
              </ScrollView>
            ) : null}

            {buttons.length > 0 ? (
              <View style={styles.buttonColumn}>
                {buttons.map((btn, idx) => {
                  const isCancel = btn.style === 'cancel';
                  const isDest = btn.style === 'destructive';
                  const isPrimary = !isCancel && !isDest;
                  return (
                    <TouchableOpacity
                      key={`${btn.text}-${idx}`}
                      activeOpacity={0.88}
                      style={[
                        styles.btnTouchable,
                        isPrimary && styles.btnPrimaryTouchable,
                        isCancel && styles.btnCancelTouchable,
                        isDest && styles.btnDestructiveTouchable,
                      ]}
                      onPress={async () => {
                        try {
                          await btn.onPress?.();
                        } finally {
                          closeCurrent();
                        }
                      }}
                    >
                      {isPrimary ? (
                        <LinearGradient
                          colors={[
                            ACCENT_CYAN,
                            '#0EA5E9',
                            '#1D4ED8',
                          ]}
                          locations={[0, 0.45, 1]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={StyleSheet.absoluteFillObject}
                          pointerEvents="none"
                        />
                      ) : null}
                      <Text
                        style={[
                          styles.btnTextBase,
                          isPrimary && styles.btnPrimaryText,
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
            ) : null}
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
    backgroundColor: OVERLAY_BG,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  card: {
    width: '100%',
    overflow: 'hidden',
    borderRadius: 22,
    paddingVertical: 22,
    paddingHorizontal: 20,
    backgroundColor: CARD_BG,
    borderWidth: StyleSheet.hairlineWidth + 1,
    borderColor: BORDER_SLATE,
    borderLeftWidth: StyleSheet.hairlineWidth + 2,
    ...Platform.select({
      ios: {
        shadowColor: '#020617',
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.45,
        shadowRadius: 28,
      },
      android: {
        elevation: 16,
      },
      default: {},
    }),
  },
  toneRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
    zIndex: 1,
  },
  toneIconOrb: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(8,17,31,0.55)',
    borderWidth: StyleSheet.hairlineWidth + 1,
  },
  title: {
    flex: 1,
    minWidth: 0,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
    lineHeight: 24,
    paddingTop: 2,
  },
  messageScroll: {
    maxHeight: 220,
    marginBottom: 18,
    zIndex: 1,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    color: TEXT_MUTED,
    fontWeight: '500',
  },
  buttonColumn: {
    gap: 11,
    zIndex: 1,
  },
  btnTouchable: {
    overflow: 'hidden',
    borderRadius: 14,
    minHeight: 50,
    paddingVertical: 14,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryTouchable: {
    borderWidth: StyleSheet.hairlineWidth + 1,
    borderColor: 'rgba(34,211,238,0.35)',
    ...Platform.select({
      ios: {
        shadowColor: ACCENT_CYAN,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.16,
        shadowRadius: 12,
      },
      android: {
        elevation: 5,
      },
      default: {},
    }),
  },
  btnCancelTouchable: {
    backgroundColor: 'rgba(8,17,31,0.62)',
    borderWidth: StyleSheet.hairlineWidth + 1,
    borderColor: 'rgba(30,58,95,0.85)',
    borderTopColor: 'rgba(148,163,184,0.22)',
    ...Platform.select({
      ios: {
        shadowColor: '#020617',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
      default: {},
    }),
  },
  btnDestructiveTouchable: {
    backgroundColor: 'rgba(55,10,22,0.55)',
    borderWidth: StyleSheet.hairlineWidth + 1,
    borderColor: 'rgba(248,113,113,0.38)',
    borderTopColor: 'rgba(239,68,68,0.22)',
    ...Platform.select({
      ios: {
        shadowColor: '#450a0a',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.22,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
      default: {},
    }),
  },
  btnTextBase: {
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
    zIndex: 1,
    letterSpacing: 0.1,
  },
  btnPrimaryText: {
    color: 'rgba(6,23,42,0.94)',
    textShadowColor: 'rgba(243,248,255,0.35)',
    textShadowOffset: { width: 0, height: 0.5 },
    textShadowRadius: 4,
  },
  btnCancelText: {
    color: 'rgba(198,216,226,0.92)',
    fontWeight: '700',
  },
  btnDestructiveText: {
    color: 'rgba(254,202,202,0.95)',
    fontWeight: '800',
  },
});
