/**
 * Uygulama genelinde Alert.alert yerine modern, tutarlı uyarı kartı.
 * appAlert(...) — Alert.alert ile aynı imza (title, message?, buttons?, options?).
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  View,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassSurface, PremiumText } from '../design-system/primitives';
import { useTheme } from '../hooks/useTheme';
import { lightThemeEnabled } from '../lib/featureFlags';
import { LDS_BORDER_COLOR, LDS_BORDER_WIDTH } from '../design-system/tokens/border';
import { LDS_COLOR_ERROR } from '../design-system/tokens/color';
import { LDS_ELEVATION } from '../design-system/tokens/elevation';
import { LDS_RADIUS } from '../design-system/tokens/radius';
import { LDS_SPACING } from '../design-system/tokens/spacing';

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
  chipLabel: string;
} {
  switch (tone) {
    case 'success':
      return {
        iconName: 'checkmark-circle-outline',
        subtleBorder: 'rgba(52,211,153,0.38)',
        iconColor: 'rgba(52,211,153,0.92)',
        chipLabel: 'İşlem tamam',
      };
    case 'warning':
      return {
        iconName: 'warning-outline',
        subtleBorder: 'rgba(251,191,36,0.42)',
        iconColor: 'rgba(253,224,71,0.92)',
        chipLabel: 'Dikkat',
      };
    case 'error':
      return {
        iconName: 'close-circle-outline',
        subtleBorder: 'rgba(239,68,68,0.38)',
        iconColor: 'rgba(248,113,113,0.92)',
        chipLabel: 'Hata',
      };
    default:
      return {
        iconName: 'information-circle-outline',
        subtleBorder: 'rgba(34,211,238,0.32)',
        iconColor: 'rgba(34,211,238,0.92)',
        chipLabel: 'Bilgi',
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
      return 'rgba(243,248,255,0.94)';
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
  const { isLight, tokens } = useTheme();
  const isAlertLight = lightThemeEnabled && isLight;
  const cardMax = Math.min(360, width - LDS_SPACING.xl);

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

  const lightStyles = useMemo(() => {
    if (!isAlertLight) return null;
    const t = tokens;
    return {
      overlay: { backgroundColor: t.shadow.modal },
      toneIconOrb: { backgroundColor: t.bg.glassMuted },
      guardianChip: {
        backgroundColor: t.bg.glassMuted,
        borderColor: t.border.default,
        borderTopColor: t.borderColors.cardTopCyan,
      },
      chipIconColor: t.accent.secondary,
      guardianChipText: { color: t.text.primary },
      btnPrimaryTouchable: {
        backgroundColor: t.accent.primary,
        borderColor: t.borderColors.selected,
        borderTopColor: t.borderColors.selectedTop,
      },
      btnPrimaryText: { color: t.text.inverse },
      btnCancelTouchable: {
        backgroundColor: t.bg.glassMuted,
        borderColor: t.border.default,
      },
      btnCancelText: { color: t.text.primary },
      btnDestructiveTouchable: {
        backgroundColor: 'rgba(220,38,38,0.08)',
        borderColor: 'rgba(220,38,38,0.28)',
        borderTopColor: 'rgba(220,38,38,0.18)',
      },
      btnDestructiveText: { color: t.status.error },
    };
  }, [isAlertLight, tokens]);

  const displayToneMeta = useMemo(() => {
    if (!isAlertLight) return toneMeta;
    const t = tokens;
    switch (effectiveTone) {
      case 'success':
        return {
          ...toneMeta,
          subtleBorder: 'rgba(5,150,105,0.35)',
          iconColor: t.status.success,
        };
      case 'warning':
        return {
          ...toneMeta,
          subtleBorder: 'rgba(217,119,6,0.35)',
          iconColor: t.status.warning,
        };
      case 'error':
        return {
          ...toneMeta,
          subtleBorder: 'rgba(220,38,38,0.35)',
          iconColor: t.status.error,
        };
      default:
        return {
          ...toneMeta,
          subtleBorder: t.borderColors.cardTopCyan,
          iconColor: t.accent.secondary,
        };
    }
  }, [isAlertLight, toneMeta, effectiveTone, tokens]);

  const displayTitleColor = useMemo(() => {
    if (!isAlertLight) return titleColor;
    const t = tokens;
    switch (effectiveTone) {
      case 'success':
        return t.status.success;
      case 'warning':
        return t.status.warning;
      case 'error':
        return t.status.error;
      default:
        return t.text.primary;
    }
  }, [isAlertLight, titleColor, effectiveTone, tokens]);

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
          style={[styles.overlay, lightStyles?.overlay]}
          onPress={() => {
            if (cancelable) closeCurrent();
          }}
        >
          <Pressable
            style={[
              styles.cardWrap,
              {
                maxWidth: cardMax,
                marginTop: Math.max(insets.top, LDS_SPACING.sm),
                marginBottom: Math.max(insets.bottom, LDS_SPACING.sm),
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <GlassSurface
              variant="panel"
              borderRadius={LDS_RADIUS.xl}
              style={[styles.card, { borderLeftColor: displayToneMeta.subtleBorder }]}
            >
              <View style={styles.toneRow}>
                <View
                  style={[
                    styles.toneIconOrb,
                    { borderColor: displayToneMeta.subtleBorder },
                    lightStyles?.toneIconOrb,
                  ]}
                >
                  <Ionicons name={displayToneMeta.iconName} size={22} color={displayToneMeta.iconColor} />
                </View>
                <View style={styles.titleCol}>
                  <GlassSurface
                    variant="plain"
                    style={[styles.guardianChip, lightStyles?.guardianChip]}
                    borderRadius={LDS_RADIUS.full}
                  >
                    <Ionicons
                      name="shield-checkmark-outline"
                      size={13}
                      color={lightStyles?.chipIconColor ?? 'rgba(34,211,238,0.82)'}
                    />
                    <PremiumText
                      variant="caption"
                      style={[styles.guardianChipText, lightStyles?.guardianChipText]}
                    >
                      {displayToneMeta.chipLabel}
                    </PremiumText>
                  </GlassSurface>
                  <PremiumText variant="title" style={[styles.title, { color: displayTitleColor }]}>
                    {current.title}
                  </PremiumText>
                </View>
              </View>

              {current.message ? (
                <ScrollView style={styles.messageScroll} keyboardShouldPersistTaps="handled">
                  <PremiumText variant="body" muted style={styles.message}>
                    {current.message}
                  </PremiumText>
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
                          isPrimary && lightStyles?.btnPrimaryTouchable,
                          isCancel && styles.btnCancelTouchable,
                          isCancel && lightStyles?.btnCancelTouchable,
                          isDest && styles.btnDestructiveTouchable,
                          isDest && lightStyles?.btnDestructiveTouchable,
                        ]}
                        onPress={async () => {
                          try {
                            await btn.onPress?.();
                          } finally {
                            closeCurrent();
                          }
                        }}
                      >
                        <PremiumText
                          variant="body"
                          muted={isCancel && !isAlertLight}
                          style={[
                            styles.btnTextBase,
                            isPrimary && styles.btnPrimaryText,
                            isPrimary && lightStyles?.btnPrimaryText,
                            isCancel && lightStyles?.btnCancelText,
                            isDest && styles.btnDestructiveText,
                            isDest && lightStyles?.btnDestructiveText,
                          ]}
                          numberOfLines={2}
                        >
                          {btn.text}
                        </PremiumText>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : null}
            </GlassSurface>
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
    backgroundColor: 'rgba(8,17,31,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: LDS_SPACING.md,
  },
  cardWrap: {
    width: '100%',
    alignSelf: 'center',
  },
  card: {
    width: '100%',
    paddingVertical: LDS_SPACING.lg,
    paddingHorizontal: LDS_SPACING.lg,
    ...LDS_ELEVATION.cockpit,
  },
  toneRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: LDS_SPACING.sm,
    marginBottom: LDS_SPACING.sm,
    zIndex: 1,
  },
  toneIconOrb: {
    width: 44,
    height: 44,
    borderRadius: LDS_RADIUS.orb,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(5,11,24,0.55)',
    borderWidth: LDS_BORDER_WIDTH.standard,
    ...LDS_ELEVATION.flat,
  },
  titleCol: {
    flex: 1,
    minWidth: 0,
    gap: LDS_SPACING.xxs,
  },
  guardianChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: LDS_SPACING.xxs,
    paddingHorizontal: LDS_SPACING.sm,
    paddingVertical: LDS_SPACING.xxs,
    backgroundColor: 'rgba(5,11,24,0.55)',
    borderColor: LDS_BORDER_COLOR.card,
    borderTopColor: LDS_BORDER_COLOR.cardTopCyan,
    ...LDS_ELEVATION.flat,
  },
  guardianChipText: {
    fontWeight: '700',
    letterSpacing: 0.2,
    color: 'rgba(186, 230, 253, 0.92)',
  },
  title: {
    paddingTop: LDS_SPACING.xxs,
  },
  messageScroll: {
    maxHeight: 220,
    marginBottom: LDS_SPACING.md,
    zIndex: 1,
  },
  message: {
    lineHeight: 22,
  },
  buttonColumn: {
    gap: LDS_SPACING.sm,
    zIndex: 1,
  },
  btnTouchable: {
    overflow: 'hidden',
    borderRadius: LDS_RADIUS.md,
    minHeight: 50,
    paddingVertical: LDS_SPACING.sm + 2,
    paddingHorizontal: LDS_SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryTouchable: {
    backgroundColor: 'rgba(16,26,43,0.9)',
    borderWidth: LDS_BORDER_WIDTH.emphasis,
    borderColor: LDS_BORDER_COLOR.selected,
    borderTopColor: LDS_BORDER_COLOR.selectedTop,
    ...LDS_ELEVATION.cta,
  },
  btnCancelTouchable: {
    backgroundColor: 'rgba(8,17,31,0.55)',
    borderWidth: LDS_BORDER_WIDTH.standard,
    borderColor: LDS_BORDER_COLOR.card,
    ...LDS_ELEVATION.flat,
  },
  btnDestructiveTouchable: {
    backgroundColor: 'rgba(55,10,22,0.55)',
    borderWidth: LDS_BORDER_WIDTH.standard,
    borderColor: 'rgba(248,113,113,0.38)',
    borderTopColor: 'rgba(239,68,68,0.22)',
    ...LDS_ELEVATION.flat,
  },
  btnTextBase: {
    textAlign: 'center',
    zIndex: 1,
  },
  btnPrimaryText: {
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  btnDestructiveText: {
    color: LDS_COLOR_ERROR,
    fontWeight: '800',
  },
});
