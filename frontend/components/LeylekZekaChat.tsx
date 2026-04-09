import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  Image,
  InteractionManager,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius, FontSize, Spacing } from '../constants/Colors';
import {
  LEYLEK_ZEKA_QUICK_PROMPTS,
  type LeylekZekaMessage,
  type LeylekZekaReplySource,
} from '../hooks/useLeylekZeka';

const BETA_HINT_KEY = 'leylek_zeka_beta_hint_dismissed_v1';
const LOGO = require('../assets/images/logo.png');

/** Giriş / CTA ile aynı marka gradient’i (app/index — Teklif Gönder vb.) */
const BRAND_GRADIENT = ['#3FA9F5', '#2563EB', '#1D4ED8'] as const;
const BRAND_SKY_TINT = '#EFF6FF';

/** İçerik boyutu değişince scroll — agresif kaydırmada tekilleştir */
const SCROLL_ON_CONTENT_SIZE_DEBOUNCE_MS = 120;
/** Mesaj/typing değişiminden sonra ilk scroll gecikmesi */
const SCROLL_AFTER_UPDATE_MS = 96;

/** Dev: true yapınca scroll/close yaşam döngüsü loglanır; prod’da false */
const __LZ_CHAT_SCROLL_DEBUG__ = false;
function lzChatDebug(...args: unknown[]) {
  if (__DEV__ && __LZ_CHAT_SCROLL_DEBUG__) console.log('[LeylekZekaChat]', ...args);
}

type Props = {
  visible: boolean;
  onClose: () => void;
  messages: LeylekZekaMessage[];
  isTyping: boolean;
  error: string | null;
  onSend: (text: string) => void;
  onClearError: () => void;
  lastReplySource: LeylekZekaReplySource | null;
};

const TypingBars = memo(function TypingBars() {
  const a0 = useRef(new Animated.Value(0)).current;
  const a1 = useRef(new Animated.Value(0)).current;
  const a2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const mk = (v: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(v, {
            toValue: 1,
            duration: 420,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(v, {
            toValue: 0,
            duration: 420,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      );
    const l0 = mk(a0, 0);
    const l1 = mk(a1, 140);
    const l2 = mk(a2, 280);
    l0.start();
    l1.start();
    l2.start();
    return () => {
      l0.stop();
      l1.stop();
      l2.stop();
    };
  }, [a0, a1, a2]);

  const s0 = a0.interpolate({ inputRange: [0, 1], outputRange: [0.38, 1] });
  const s1 = a1.interpolate({ inputRange: [0, 1], outputRange: [0.38, 1] });
  const s2 = a2.interpolate({ inputRange: [0, 1], outputRange: [0.38, 1] });

  return (
    <View style={styles.typingRow}>
      <Animated.View style={[styles.typingBar, { transform: [{ scaleY: s0 }] }]} />
      <Animated.View style={[styles.typingBar, styles.typingBarMid, { transform: [{ scaleY: s1 }] }]} />
      <Animated.View style={[styles.typingBar, { transform: [{ scaleY: s2 }] }]} />
    </View>
  );
});

const Bubble = memo(function Bubble({ item }: { item: LeylekZekaMessage }) {
  const isUser = item.role === 'user';
  if (isUser) {
    return (
      <View style={[styles.bubbleWrap, styles.bubbleWrapUser]}>
        <LinearGradient
          colors={[...BRAND_GRADIENT]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.bubbleUserGrad}
        >
          <Text style={[styles.bubbleText, styles.bubbleTextUser]}>{item.text}</Text>
        </LinearGradient>
      </View>
    );
  }
  return (
    <View style={[styles.bubbleWrap, styles.bubbleWrapAi]}>
      <View style={styles.bubbleAiCard}>
        <View style={styles.bubbleAiAccentStrip}>
          <LinearGradient
            colors={[...BRAND_GRADIENT]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
        </View>
        <View style={styles.bubbleAiContentBody}>
          <Text
            style={[styles.bubbleText, styles.bubbleTextAi]}
            {...Platform.select({
              android: {
                textBreakStrategy: 'simple' as const,
                includeFontPadding: false,
              },
              default: {},
            })}
          >
            {item.text}
          </Text>
        </View>
      </View>
    </View>
  );
});

const QuickChips = memo(function QuickChips({
  onPick,
  disabled,
  activeLabel,
}: {
  onPick: (t: string) => void;
  disabled: boolean;
  activeLabel: string | null;
}) {
  const onChip = useCallback(
    (label: string) => {
      if (disabled) return;
      if (Platform.OS !== 'web') {
        try {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch {
          /* ignore */
        }
      }
      onPick(label);
    },
    [disabled, onPick],
  );

    return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      style={styles.chipsScroll}
      contentContainerStyle={styles.chipsRow}
    >
      {LEYLEK_ZEKA_QUICK_PROMPTS.map((label) => {
        const selected = activeLabel === label;
        return (
          <Pressable
            key={label}
            onPress={() => onChip(label)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityHint="Önerilen soruyu mesaj olarak gönderir."
            accessibilityState={{ disabled, selected }}
            style={({ pressed }) => [
              styles.chip,
              disabled && styles.chipDisabled,
              selected && styles.chipSelected,
              pressed && !disabled && !selected && styles.chipPressed,
            ]}
          >
            <Text style={[styles.chipText, selected && styles.chipTextSelected]} numberOfLines={2}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
});

const EmptyWelcome = memo(function EmptyWelcome() {
  return (
    <View style={styles.emptyState} accessible accessibilityRole="text">
      <View style={styles.emptyIconWrap}>
        <Image source={LOGO} style={styles.emptyLogo} resizeMode="contain" accessibilityIgnoresInvertColors />
      </View>
      <Text style={styles.emptyTitle}>Leylek Zeka</Text>
      <Text style={styles.emptyBody}>
        Merhaba, ben Leylek Zeka. Uygulama içi adımlarda sana yardımcı olabilirim.
      </Text>
    </View>
  );
});

/** Başlık logosu — hafif nefes (scale), spin yok */
const HeaderLogoMark = memo(function HeaderLogoMark({ reduceMotion }: { reduceMotion: boolean }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduceMotion) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reduceMotion]);
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] });
  const floatY = pulse.interpolate({ inputRange: [0, 1], outputRange: [0, -2.5] });
  return (
    <Animated.View
      style={[
        styles.headerLogoWrapCompact,
        !reduceMotion && { transform: [{ translateY: floatY }, { scale }] },
      ]}
    >
      <Image source={LOGO} style={styles.headerLogo} resizeMode="contain" accessibilityIgnoresInvertColors />
    </Animated.View>
  );
});

const LeylekZekaChat = memo(function LeylekZekaChat({
  visible,
  onClose,
  messages,
  isTyping,
  error,
  onSend,
  onClearError,
  lastReplySource,
}: Props) {
  const insets = useSafeAreaInsets();
  const [input, setInput] = useState('');
  const [showBetaHint, setShowBetaHint] = useState(false);
  const [activeChipLabel, setActiveChipLabel] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const wasTypingRef = useRef(false);
  const listRef = useRef<FlatList<LeylekZekaMessage>>(null);
  const scrollRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentSizeScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  /** Modal açık mı — kapanış sonrası async zincirlerde güncel değer */
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  /**
   * Modal kapanınca artırılır; scrollToEnd zincirinde yakalanan nesil uyuşmuyorsa scroll iptal.
   * Kapalı modal / unmount üzerinde scrollToEnd çağrılarını etkisizleştirir.
   */
  const scrollGenRef = useRef(0);

  /** Android: composer yukarı — yalnızca alt padding; iOS: KAV zaten yönetir. */
  const composerBottomPad = useMemo(
    () => Math.max(insets.bottom, Spacing.md) + (Platform.OS === 'android' ? keyboardHeight : 0),
    [insets.bottom, keyboardHeight],
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      scrollGenRef.current += 1;
      if (scrollRetryRef.current) {
        clearTimeout(scrollRetryRef.current);
        scrollRetryRef.current = null;
      }
      if (contentSizeScrollTimerRef.current) {
        clearTimeout(contentSizeScrollTimerRef.current);
        contentSizeScrollTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (!cancelled && mountedRef.current) setReduceMotion(Boolean(v));
    });
    const sub =
      'addEventListener' in AccessibilityInfo
        ? AccessibilityInfo.addEventListener('reduceMotionChanged', (v: boolean) => {
            if (!mountedRef.current) return;
            setReduceMotion(Boolean(v));
          })
        : undefined;
    return () => {
      cancelled = true;
      if (sub && 'remove' in sub && typeof sub.remove === 'function') {
        sub.remove();
      }
    };
  }, []);

  useEffect(() => {
    if (!visible) {
      setKeyboardHeight(0);
      return;
    }
    const showEv = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEv = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEv, (e) => {
      if (!visibleRef.current) return;
      try {
        setKeyboardHeight(e.endCoordinates?.height ?? 0);
      } catch {
        /* native race */
      }
    });
    const hide = Keyboard.addListener(hideEv, () => {
      if (!visibleRef.current) return;
      try {
        setKeyboardHeight(0);
      } catch {
        /* native race */
      }
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [visible]);

  /** Sohbet açılışında hafif geri bildirim (web hariç) */
  useEffect(() => {
    if (!visible || Platform.OS === 'web') return;
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      /* ignore */
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      setActiveChipLabel(null);
      wasTypingRef.current = false;
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const v = await AsyncStorage.getItem(BETA_HINT_KEY);
        if (!cancelled && v !== '1') setShowBetaHint(true);
      } catch {
        if (!cancelled) setShowBetaHint(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible]);

  useEffect(() => {
    if (lastReplySource !== 'claude') return;
    void AsyncStorage.setItem(BETA_HINT_KEY, '1').catch(() => {});
    setShowBetaHint(false);
  }, [lastReplySource]);

  const dismissBetaHint = useCallback(() => {
    setShowBetaHint(false);
    void AsyncStorage.setItem(BETA_HINT_KEY, '1').catch(() => {});
  }, []);

  const onSubmit = useCallback(() => {
    const t = input.trim();
    if (!t || isTyping) return;
    if (Platform.OS !== 'web') {
      try {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {
        /* ignore */
      }
    }
    setActiveChipLabel(null);
    setInput('');
    onSend(t);
  }, [input, isTyping, onSend]);

  const onChip = useCallback(
    (t: string) => {
      if (isTyping) return;
      setActiveChipLabel(t);
      onSend(t);
    },
    [isTyping, onSend],
  );

  useEffect(() => {
    if (isTyping) {
      wasTypingRef.current = true;
      return;
    }
    if (!wasTypingRef.current || !activeChipLabel) return;
    wasTypingRef.current = false;
    const id = setTimeout(() => {
      if (!mountedRef.current || !visibleRef.current) return;
      setActiveChipLabel(null);
    }, 520);
    return () => clearTimeout(id);
  }, [isTyping, activeChipLabel]);

  const scrollToEndSafe = useCallback(() => {
    if (!mountedRef.current || !visibleRef.current) {
      lzChatDebug('scrollToEndSafe skip: not mounted or not visible');
      return;
    }
    const genAtStart = scrollGenRef.current;
    if (scrollRetryRef.current) {
      clearTimeout(scrollRetryRef.current);
      scrollRetryRef.current = null;
    }
    InteractionManager.runAfterInteractions(() => {
      if (
        genAtStart !== scrollGenRef.current ||
        !mountedRef.current ||
        !visibleRef.current
      ) {
        lzChatDebug('scrollToEndSafe abort after interactions', { genAtStart, cur: scrollGenRef.current });
        return;
      }
      requestAnimationFrame(() => {
        if (
          genAtStart !== scrollGenRef.current ||
          !mountedRef.current ||
          !visibleRef.current
        ) {
          return;
        }
        requestAnimationFrame(() => {
          if (
            genAtStart !== scrollGenRef.current ||
            !mountedRef.current ||
            !visibleRef.current
          ) {
            return;
          }
          try {
            listRef.current?.scrollToEnd({ animated: true });
          } catch {
            /* Son savunma: animasyonsuz scroll (nadir native/layout yarışları) */
            lzChatDebug('scrollToEnd animated:true failed, fallback animated:false');
            try {
              if (
                genAtStart !== scrollGenRef.current ||
                !mountedRef.current ||
                !visibleRef.current
              ) {
                return;
              }
              listRef.current?.scrollToEnd({ animated: false });
            } catch {
              /* ignore */
            }
          }
        });
      });
    });
  }, []);

  /** Modal kapanınca: bekleyen scroll zincirlerini iptal et, zamanlayıcıları temizle, klavye kapat */
  useEffect(() => {
    if (visible) return;
    scrollGenRef.current += 1;
    lzChatDebug('modal hidden, scrollGen bump', scrollGenRef.current);
    if (scrollRetryRef.current) {
      clearTimeout(scrollRetryRef.current);
      scrollRetryRef.current = null;
    }
    if (contentSizeScrollTimerRef.current) {
      clearTimeout(contentSizeScrollTimerRef.current);
      contentSizeScrollTimerRef.current = null;
    }
    try {
      Keyboard.dismiss();
    } catch {
      /* ignore */
    }
  }, [visible]);

  const onListContentSizeChange = useCallback(() => {
    if (!mountedRef.current || !visibleRef.current) return;
    if (contentSizeScrollTimerRef.current) {
      clearTimeout(contentSizeScrollTimerRef.current);
      contentSizeScrollTimerRef.current = null;
    }
    contentSizeScrollTimerRef.current = setTimeout(() => {
      contentSizeScrollTimerRef.current = null;
      if (!mountedRef.current || !visibleRef.current) return;
      scrollToEndSafe();
    }, SCROLL_ON_CONTENT_SIZE_DEBOUNCE_MS);
  }, [scrollToEndSafe]);

  useEffect(() => {
    if (!visible) {
      return;
    }
    scrollRetryRef.current = setTimeout(() => {
      scrollRetryRef.current = null;
      scrollToEndSafe();
    }, SCROLL_AFTER_UPDATE_MS);
    return () => {
      if (scrollRetryRef.current) {
        clearTimeout(scrollRetryRef.current);
        scrollRetryRef.current = null;
      }
    };
  }, [visible, messages.length, isTyping, scrollToEndSafe]);

  const renderItem = useCallback(
    ({ item }: { item: LeylekZekaMessage }) => <Bubble item={item} />,
    [],
  );

  const keyExtractor = useCallback((m: LeylekZekaMessage) => m.id, []);

  const modeCaption =
    lastReplySource === 'fallback'
      ? 'Hazır yanıtlarla destekleniyorsunuz.'
      : lastReplySource === 'claude'
        ? 'Yapay zeka yanıtı.'
        : lastReplySource === 'answer_engine'
          ? 'Resmi adım adım yanıt.'
          : null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.modalRoot}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Kapat" />
        <KeyboardAvoidingView
          style={styles.kavRoot}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? Math.max(insets.top, 12) + 8 : 0}
        >
          <View style={styles.sheet}>
            {/* Marka gökyüzü — düşük opaklık, okunabilirlik öncelikli */}
            <LinearGradient
              colors={['#B9E0FB', '#D8EEFC', BRAND_SKY_TINT, '#F8FCFF', '#FFFFFF']}
              locations={[0, 0.22, 0.48, 0.76, 1]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={styles.sheetSkyBase}
              pointerEvents="none"
            />
            {/* iOS: BlurView (premium cam). Android: düşük uç GPU yükü — gradient fallback, blur yok. */}
            {Platform.OS === 'ios' ? (
              <BlurView intensity={22} tint="light" style={styles.sheetBlur} pointerEvents="none" />
            ) : Platform.OS === 'android' ? (
              <LinearGradient
                colors={['rgba(224,242,254,0.48)', 'rgba(255,255,255,0.62)', 'rgba(248,250,252,0.82)']}
                locations={[0, 0.42, 1]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.sheetAndroidSoft}
                pointerEvents="none"
              />
            ) : null}
            <LinearGradient
              colors={['rgba(255,255,255,0.12)', 'rgba(248,252,255,0.82)', 'rgba(255,255,255,0.94)']}
              locations={[0, 0.45, 1]}
              style={styles.sheetVeil}
              pointerEvents="none"
            />
            {/* Yumuşak bulut hissi — düşük opaklık, okunurluğu bastırmaz */}
            <View style={styles.cloudLayer} pointerEvents="none">
              <View style={[styles.cloudBlob, styles.cloudBlob1]} />
              <View style={[styles.cloudBlob, styles.cloudBlob2]} />
              <View style={[styles.cloudBlob, styles.cloudBlob3]} />
            </View>

            <View style={[styles.sheetInner, { paddingTop: Math.max(insets.top, 10) + 6 }]}>
          <LinearGradient
            colors={['rgba(255,255,255,0.97)', 'rgba(236,248,255,0.92)', 'rgba(255,255,255,0.88)']}
            locations={[0, 0.55, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerBar}
          >
            <LinearGradient
              colors={[...BRAND_GRADIENT]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.headerBrandStrip}
              pointerEvents="none"
            />
            <LinearGradient
              colors={['rgba(63,169,245,0.2)', 'rgba(255,255,255,0)', 'rgba(147,197,253,0.12)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.headerBarGlow}
              pointerEvents="none"
            />
            <View style={styles.headerTitleRow}>
              <View style={styles.headerLead}>
                <HeaderLogoMark reduceMotion={reduceMotion} />
                <View style={styles.headerTextCol}>
                  <View style={styles.titleRow}>
                    <Text style={styles.title}>Leylek Zeka</Text>
                    <LinearGradient
                      colors={[...BRAND_GRADIENT]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.aiBadge}
                    >
                      <Text style={styles.aiBadgeText}>AI</Text>
                    </LinearGradient>
                  </View>
                  <Text style={styles.headerSubtitle}>Rehber · Yardım</Text>
                  {modeCaption ? <Text style={styles.modeCaptionInline}>{modeCaption}</Text> : null}
                </View>
              </View>
            </View>
            <Pressable onPress={onClose} hitSlop={14} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#334155" />
            </Pressable>
          </LinearGradient>

          {showBetaHint ? (
            <View style={styles.betaBanner}>
              <Text style={styles.betaText}>
                Leylek Zeka beta destek modunda çalışıyor. Şimdilik size hazır yanıtlarla yardımcı
                oluyoruz; tam yapay zeka desteği kısa süre içinde açılacaktır.
              </Text>
              <Pressable onPress={dismissBetaHint} hitSlop={8} style={styles.betaDismiss}>
                <Ionicons name="close-circle" size={22} color={Colors.gray500} />
              </Pressable>
            </View>
          ) : null}

          {error ? (
            <Pressable onPress={onClearError} style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </Pressable>
          ) : null}

          <View style={[styles.chipsSection, activeChipLabel ? styles.chipsSectionActive : null]}>
            <Text style={styles.chipsLabel}>Önerilen sorular</Text>
            <QuickChips onPick={onChip} disabled={isTyping} activeLabel={activeChipLabel} />
          </View>

          <View style={styles.listWrap}>
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={keyExtractor}
              renderItem={renderItem}
              style={styles.list}
              scrollEnabled={visible}
              scrollEventThrottle={16}
              onContentSizeChange={onListContentSizeChange}
              contentContainerStyle={[
                styles.listContent,
                messages.length === 0 ? styles.listContentEmpty : null,
              ]}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="none"
              showsVerticalScrollIndicator={false}
              removeClippedSubviews={false}
              initialNumToRender={14}
              windowSize={10}
              maxToRenderPerBatch={10}
              updateCellsBatchingPeriod={50}
              ListEmptyComponent={EmptyWelcome}
              ListFooterComponent={
                isTyping ? (
                  <View style={styles.typingBubbleOuter}>
                    <LinearGradient
                      colors={[...BRAND_GRADIENT]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 0, y: 1 }}
                      style={styles.typingAccent}
                    />
                    <View style={styles.typingBubbleInner}>
                      <TypingBars />
                    </View>
                  </View>
                ) : null
              }
            />
          </View>

          <LinearGradient
            colors={['rgba(240,249,255,0.98)', 'rgba(224,242,254,0.96)', 'rgba(219,234,254,0.94)']}
            locations={[0, 0.5, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={[styles.composerBar, { paddingBottom: composerBottomPad }]}
          >
            <Text style={styles.composerLabel}>Mesaj</Text>
            <View style={styles.composerCard}>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="Sorunuzu yazın…"
                placeholderTextColor="#475569"
                value={input}
                onChangeText={setInput}
                editable={!isTyping}
                multiline
                maxLength={2000}
                onSubmitEditing={onSubmit}
                returnKeyType="send"
                accessibilityLabel="Mesaj metni"
                onFocus={() => {
                  if (Platform.OS === 'web' || !visibleRef.current) return;
                  try {
                    void Haptics.selectionAsync();
                  } catch {
                    /* ignore */
                  }
                }}
                {...Platform.select({
                  ios: { keyboardAppearance: 'light' as const },
                  default: {},
                })}
              />
              <Pressable
                onPress={onSubmit}
                accessibilityRole="button"
                accessibilityLabel="Gönder"
                accessibilityState={{ disabled: !input.trim() || isTyping }}
                style={({ pressed }) => [
                  styles.sendBtnOuter,
                  (!input.trim() || isTyping) && styles.sendBtnDisabled,
                  pressed && input.trim() && !isTyping && styles.sendBtnPressed,
                ]}
                disabled={!input.trim() || isTyping}
              >
                <LinearGradient
                  colors={[...BRAND_GRADIENT]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.sendBtnGrad}
                >
                  {isTyping ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Ionicons name="arrow-forward" size={24} color="#fff" />
                  )}
                </LinearGradient>
              </Pressable>
            </View>
            </View>
          </LinearGradient>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
});

export default LeylekZekaChat;

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.38)',
  },
  kavRoot: {
    flex: 1,
    width: '100%',
    maxWidth: '100%',
    justifyContent: 'flex-start',
  },
  sheet: {
    flex: 1,
    position: 'relative',
    width: '100%',
    minHeight: 0,
    backgroundColor: '#F5FAFF',
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    overflow: 'hidden',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(63, 169, 245, 0.22)',
    ...Platform.select({
      ios: {
        shadowColor: '#0c4a6e',
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.14,
        shadowRadius: 28,
      },
      android: { elevation: 20 },
    }),
  },
  sheetSkyBase: {
    ...StyleSheet.absoluteFillObject,
  },
  sheetBlur: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  /** Android: BlurView yerine hafif katman (kasma riskini azaltır) */
  sheetAndroidSoft: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  sheetVeil: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  cloudLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
    overflow: 'hidden',
  },
  cloudBlob: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.38)',
  },
  cloudBlob1: {
    width: 220,
    height: 120,
    borderRadius: 80,
    top: '8%',
    left: '-12%',
    opacity: 0.38,
  },
  cloudBlob2: {
    width: 180,
    height: 95,
    borderRadius: 70,
    top: '22%',
    right: '-8%',
    opacity: 0.28,
  },
  cloudBlob3: {
    width: 260,
    height: 100,
    borderRadius: 90,
    bottom: '12%',
    left: '5%',
    opacity: 0.22,
  },
  sheetInner: {
    flex: 1,
    zIndex: 1,
    paddingHorizontal: Spacing.md,
    paddingBottom: 0,
    minHeight: 0,
  },
  headerBar: {
    borderRadius: BorderRadius.lg,
    paddingTop: Spacing.sm + 6,
    paddingBottom: Spacing.sm + 4,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(63, 169, 245, 0.26)',
    position: 'relative',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#0c4a6e',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.09,
        shadowRadius: 16,
      },
      android: { elevation: 4 },
    }),
  },
  headerBrandStrip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    zIndex: 3,
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
  },
  headerBarGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BorderRadius.lg,
  },
  headerLead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    paddingRight: 36,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  aiBadge: {
    marginLeft: 8,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 9,
    ...Platform.select({
      ios: {
        shadowColor: '#1d4ed8',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: { elevation: 2 },
    }),
  },
  aiBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    textShadowColor: 'rgba(15, 23, 42, 0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    zIndex: 1,
  },
  /** Küçük marka işareti — başlık önde */
  headerLogoWrapCompact: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
    marginTop: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(63, 169, 245, 0.35)',
    ...Platform.select({
      ios: {
        shadowColor: '#3FA9F5',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.12,
        shadowRadius: 4,
      },
      android: { elevation: 1 },
    }),
  },
  headerLogo: {
    width: 22,
    height: 22,
  },
  headerTextCol: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0c4a6e',
    letterSpacing: -0.7,
    flexShrink: 1,
  },
  headerSubtitle: {
    fontSize: FontSize.sm + 1,
    color: '#475569',
    marginTop: 4,
    fontWeight: '600',
    letterSpacing: 0.12,
    lineHeight: 20,
  },
  modeCaptionInline: {
    fontSize: FontSize.xs,
    color: '#64748B',
    marginTop: 6,
    fontWeight: '600',
    letterSpacing: 0.06,
    opacity: 0.88,
  },
  closeBtn: {
    position: 'absolute',
    right: Spacing.sm,
    top: Spacing.sm + 4,
    padding: 10,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(63, 169, 245, 0.35)',
    zIndex: 2,
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
      },
      android: { elevation: 3 },
    }),
  },
  betaBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#EEF6FC',
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(63, 169, 245, 0.28)',
  },
  betaText: {
    flex: 1,
    fontSize: FontSize.sm,
    lineHeight: 20,
    color: Colors.gray700,
    paddingRight: Spacing.sm,
  },
  betaDismiss: {
    paddingTop: 2,
  },
  errorBanner: {
    backgroundColor: '#FFEBEE',
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
  },
  errorText: {
    color: Colors.error,
    fontSize: FontSize.sm,
  },
  chipsSection: {
    marginBottom: Spacing.sm,
    paddingBottom: 2,
  },
  chipsSectionActive: {
    marginHorizontal: -Spacing.xs,
    paddingHorizontal: Spacing.xs,
    paddingTop: Spacing.sm,
    borderRadius: BorderRadius.lg,
    backgroundColor: 'rgba(224, 242, 254, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(63, 169, 245, 0.24)',
  },
  chipsLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: Spacing.sm,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  chipsScroll: {
    maxHeight: 76,
  },
  listWrap: {
    flex: 1,
    minHeight: 0,
    zIndex: 1,
  },
  list: { flex: 1 },
  listContent: { paddingVertical: Spacing.sm + 2, paddingBottom: Spacing.md, flexGrow: 1 },
  listContentEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: Spacing.lg,
  },
  emptyState: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    maxWidth: 320,
    alignSelf: 'center',
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(63, 169, 245, 0.28)',
    ...Platform.select({
      ios: {
        shadowColor: '#3FA9F5',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
  },
  emptyLogo: {
    width: 34,
    height: 34,
  },
  emptyTitle: {
    fontSize: FontSize.xl + 2,
    fontWeight: '800',
    color: '#0c4a6e',
    letterSpacing: -0.4,
  },
  emptyBody: {
    marginTop: Spacing.sm,
    textAlign: 'center',
    lineHeight: 26,
    color: '#334155',
    fontSize: FontSize.lg,
    fontWeight: '500',
    letterSpacing: 0.02,
  },
  bubbleWrap: { marginBottom: Spacing.md + 6, maxWidth: '92%' },
  bubbleWrapUser: { alignSelf: 'flex-end' },
  /** % genişlik: row içinde flex:1 alanı Android’de ölçülebilir olsun (yalnız şerit kalmayı önler) */
  bubbleWrapAi: { alignSelf: 'flex-start', width: '92%' },
  bubbleAiCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    width: '100%',
    minHeight: 44,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.12)',
    ...Platform.select({
      ios: {
        shadowColor: '#0c4a6e',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: { elevation: 3 },
    }),
  },
  /** Sabit genişlik — flex ile metin alanından genişlik çalmaz */
  bubbleAiAccentStrip: {
    width: 5,
    flexGrow: 0,
    flexShrink: 0,
    alignSelf: 'stretch',
    minHeight: 44,
  },
  /** Düz arka plan — gradient katmanı yok; metin her zaman görünür ve ölçülebilir genişlik alır */
  bubbleAiContentBody: {
    flex: 1,
    minWidth: 0,
    alignSelf: 'stretch',
    paddingVertical: Spacing.sm + 6,
    paddingHorizontal: Spacing.md + 4,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
  },
  bubbleUserGrad: {
    paddingHorizontal: Spacing.md + 4,
    paddingVertical: Spacing.sm + 4,
    borderRadius: 20,
    borderBottomRightRadius: 8,
    maxWidth: '100%',
    ...Platform.select({
      ios: {
        shadowColor: '#1e40af',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.28,
        shadowRadius: 10,
      },
      android: { elevation: 4 },
    }),
  },
  bubbleText: {
    fontSize: 17,
    lineHeight: 28,
    letterSpacing: 0.02,
  },
  bubbleTextUser: { color: '#fff', fontWeight: '600' },
  bubbleTextAi: {
    color: '#0f172a',
    fontWeight: '500',
    opacity: 1,
    flexShrink: 0,
    width: '100%',
  },
  typingBubbleOuter: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'stretch',
    marginBottom: Spacing.sm,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.12)',
    maxWidth: '88%',
    ...Platform.select({
      ios: {
        shadowColor: '#0c4a6e',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
      },
      android: { elevation: 2 },
    }),
  },
  typingAccent: {
    width: 5,
    minHeight: 52,
  },
  typingBubbleInner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.md + 2,
    paddingVertical: Spacing.md,
    backgroundColor: 'rgba(255,255,255,0.98)',
  },
  typingRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 16,
    justifyContent: 'center',
  },
  typingBar: {
    width: 4,
    height: 14,
    borderRadius: 2,
    backgroundColor: Colors.primary,
    opacity: 0.88,
  },
  typingBarMid: { marginHorizontal: 5 },
  chipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingLeft: 2,
    paddingRight: Spacing.md,
  },
  chip: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    maxWidth: 280,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderWidth: 1,
    borderColor: 'rgba(63, 169, 245, 0.32)',
    marginRight: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#0c4a6e',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
      },
      android: { elevation: 2 },
    }),
  },
  chipPressed: {
    backgroundColor: '#E0F2FE',
    borderColor: 'rgba(37, 99, 235, 0.45)',
    transform: [{ scale: 0.985 }],
  },
  chipSelected: {
    backgroundColor: '#DBEAFE',
    borderColor: '#2563EB',
    borderWidth: 2,
    ...Platform.select({
      ios: {
        shadowColor: '#2563EB',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.18,
        shadowRadius: 6,
      },
      android: { elevation: 3 },
    }),
  },
  chipDisabled: {
    opacity: 0.45,
  },
  chipText: {
    fontSize: FontSize.md,
    color: '#1e293b',
    fontWeight: '600',
    lineHeight: 22,
    letterSpacing: 0.02,
  },
  chipTextSelected: {
    color: '#1d4ed8',
  },
  composerBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(63, 169, 245, 0.28)',
    marginHorizontal: -Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm + 2,
    ...Platform.select({
      ios: {
        shadowColor: '#0c4a6e',
        shadowOffset: { width: 0, height: -5 },
        shadowOpacity: 0.12,
        shadowRadius: 15,
      },
      android: { elevation: 8 },
    }),
  },
  composerLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    letterSpacing: 0.65,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginLeft: 2,
  },
  composerCard: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(63, 169, 245, 0.22)',
    ...Platform.select({
      ios: {
        shadowColor: '#3FA9F5',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 10,
      },
      android: { elevation: 4 },
    }),
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 0,
  },
  input: {
    flex: 1,
    minHeight: 56,
    maxHeight: 160,
    borderWidth: 1,
    borderColor: 'rgba(100, 116, 139, 0.45)',
    borderRadius: 14,
    paddingHorizontal: Spacing.md + 6,
    paddingVertical: Platform.OS === 'ios' ? 16 : 15,
    fontSize: 17,
    color: '#0f172a',
    backgroundColor: '#FFFFFF',
    marginRight: Spacing.sm,
    fontWeight: '500',
    letterSpacing: 0.02,
  },
  sendBtnOuter: {
    borderRadius: 27,
    overflow: 'hidden',
    marginBottom: 0,
    ...Platform.select({
      ios: {
        shadowColor: '#1d4ed8',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
      },
      android: { elevation: 5 },
    }),
  },
  sendBtnGrad: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.96 }],
  },
  sendBtnDisabled: { opacity: 0.45 },
});
