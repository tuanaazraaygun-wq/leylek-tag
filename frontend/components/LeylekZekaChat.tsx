import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Image,
  InteractionManager,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius, Spacing } from '../constants/Colors';
import {
  type LeylekZekaLearningCandidate,
  type LeylekZekaMessage,
  type LeylekZekaReplySource,
} from '../hooks/useLeylekZeka';

const BETA_HINT_KEY = 'leylek_zeka_beta_hint_dismissed_v1';
const LOGO = require('../assets/images/logo.png');

/** Giriş / CTA ile aynı marka gradient’i (app/index — Teklif Gönder vb.) */
const BRAND_GRADIENT = ['#3FA9F5', '#2563EB', '#1D4ED8'] as const;

/** İçerik boyutu değişince scroll — uzun metin layout sonrası yakalamak için kısa tutulur */
const SCROLL_ON_CONTENT_SIZE_DEBOUNCE_MS = 48;
/** Mesaj/typing değişiminden sonra ilk scroll gecikmesi */
const SCROLL_AFTER_UPDATE_MS = 72;

/** Terminal / HUD hissi — tüm sohbet tipografisi */
const DIGITAL_MONO = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'monospace',
});

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
  pendingLearning?: LeylekZekaLearningCandidate | null;
  onApproveLearning?: () => void;
  onCancelLearning?: () => void;
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
          <Text style={[styles.bubbleText, styles.bubbleTextUser]} selectable>
            {item.text}
          </Text>
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
            selectable
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

/** Arkada hafif 0/1 deseni — pointerEvents yok */
const BinaryPatternBackdrop = memo(function BinaryPatternBackdrop() {
  const shift = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shift, {
          toValue: 1,
          duration: 14000,
          easing: Easing.inOut(Easing.linear),
          useNativeDriver: true,
        }),
        Animated.timing(shift, {
          toValue: 0,
          duration: 14000,
          easing: Easing.inOut(Easing.linear),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [shift]);
  const tx = shift.interpolate({ inputRange: [0, 1], outputRange: [0, -56] });
  const ty = shift.interpolate({ inputRange: [0, 1], outputRange: [0, 24] });
  const rows = ['0 1 0 1 0 1', '1 0 1 0 1 0', '0 1 0 1 0 1', '1 0 1 0 1 0'];
  return (
    <Animated.View
      style={[styles.binaryPatternWrap, { transform: [{ translateX: tx }, { translateY: ty }] }]}
      pointerEvents="none"
    >
      {rows.map((line, i) => (
        <Text key={i} style={styles.binaryPatternLine}>
          {line}
        </Text>
      ))}
    </Animated.View>
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
  pendingLearning = null,
  onApproveLearning,
  onCancelLearning,
}: Props) {
  const insets = useSafeAreaInsets();
  const [input, setInput] = useState('');
  const [showBetaHint, setShowBetaHint] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
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
  /** Android: keyboardDidHide bazen düzen değişince iki kez tetiklenir; anlık sıfırlama odak kaybına yol açabilir */
  const keyboardHideDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Güvenli alan — klavye KAV (iOS) veya alt dolgu (Android) ile taşınır */
  const composerBottomPad = useMemo(() => Math.max(insets.bottom, Spacing.md), [insets.bottom]);

  const panelMaxHeight = useMemo(
    () => Math.round(Dimensions.get('window').height * 0.74),
    [],
  );

  /** Uzun tek mesajda da içerik imzası değişsin; scroll + FlatList extraData */
  const messagesScrollSig = useMemo(
    () => messages.map((m) => `${m.id}:${m.text.length}`).join('\u001e'),
    [messages],
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
      if (keyboardHideDebounceRef.current) {
        clearTimeout(keyboardHideDebounceRef.current);
        keyboardHideDebounceRef.current = null;
      }
      setKeyboardHeight(0);
      return;
    }
    const showEv = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEv = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEv, (e) => {
      if (!visibleRef.current) return;
      if (keyboardHideDebounceRef.current) {
        clearTimeout(keyboardHideDebounceRef.current);
        keyboardHideDebounceRef.current = null;
      }
      try {
        setKeyboardHeight(e.endCoordinates?.height ?? 0);
      } catch {
        /* native race */
      }
    });
    const hide = Keyboard.addListener(hideEv, () => {
      if (!visibleRef.current) return;
      if (keyboardHideDebounceRef.current) {
        clearTimeout(keyboardHideDebounceRef.current);
        keyboardHideDebounceRef.current = null;
      }
      /** Klavye gizlenince kısa gecikme: layout yarışında odak korunur (özellikle Android). */
      keyboardHideDebounceRef.current = setTimeout(() => {
        keyboardHideDebounceRef.current = null;
        if (!visibleRef.current) return;
        try {
          setKeyboardHeight(0);
        } catch {
          /* native race */
        }
      }, Platform.OS === 'android' ? 140 : 0);
    });
    return () => {
      show.remove();
      hide.remove();
      if (keyboardHideDebounceRef.current) {
        clearTimeout(keyboardHideDebounceRef.current);
        keyboardHideDebounceRef.current = null;
      }
    };
  }, [visible]);

  useEffect(() => {
    if (!visible) {
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
    if (lastReplySource !== 'openai' && lastReplySource !== 'kb') return;
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
    setInput('');
    onSend(t);
  }, [input, isTyping, onSend]);

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
    /** onLayout ile scrollToEnd birlikte layout/content yarışına yol açmasın — yalnızca içerik imzası + debounce. */
    const delays = [
      SCROLL_AFTER_UPDATE_MS,
      SCROLL_AFTER_UPDATE_MS + 180,
      SCROLL_AFTER_UPDATE_MS + 400,
    ];
    const ids = delays.map((ms) =>
      setTimeout(() => {
        scrollToEndSafe();
      }, ms),
    );
    return () => {
      ids.forEach(clearTimeout);
    };
  }, [visible, messagesScrollSig, isTyping, scrollToEndSafe]);

  const renderItem = useCallback(
    ({ item }: { item: LeylekZekaMessage }) => <Bubble item={item} />,
    [],
  );

  const keyExtractor = useCallback((m: LeylekZekaMessage) => m.id, []);

  const modeCaption =
    lastReplySource === 'fallback'
      ? 'Hazır yanıtlarla destekleniyorsunuz.'
      : lastReplySource === 'openai' || lastReplySource === 'kb'
        ? 'Yapay zeka yanıtı (Leylek AI).'
        : lastReplySource === 'answer_engine'
          ? 'Resmi adım adım yanıt.'
          : null;

  const closeWithHaptic = useCallback(() => {
    if (Platform.OS !== 'web') {
      try {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {
        /* ignore */
      }
    }
    onClose();
  }, [onClose]);

  const kavOffset = useMemo(() => {
    if (Platform.OS === 'ios') {
      return Math.max(insets.top, 12) + 8;
    }
    const sb = StatusBar.currentHeight;
    return typeof sb === 'number' && sb > 0 ? sb : 0;
  }, [insets.top]);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={closeWithHaptic}
      statusBarTranslucent
    >
      <View style={styles.modalRoot}>
        <Pressable
          style={styles.backdrop}
          onPress={closeWithHaptic}
          accessibilityRole="button"
          accessibilityLabel="Kapat"
        />
        <KeyboardAvoidingView
          style={styles.kavRoot}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={kavOffset}
        >
          <View
            style={[
              styles.kavCenterFill,
              Platform.OS === 'android' && keyboardHeight > 0
                ? { paddingBottom: keyboardHeight }
                : null,
            ]}
          >
          <View style={[styles.sheet, { height: panelMaxHeight, maxHeight: panelMaxHeight }]}>
            {/* Açık mavi → açık mor, düşük opaklık */}
            <LinearGradient
              colors={['rgba(186, 230, 253, 0.55)', 'rgba(199, 210, 254, 0.42)', 'rgba(233, 213, 255, 0.38)', 'rgba(250, 245, 255, 0.5)']}
              locations={[0, 0.35, 0.7, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.sheetSkyBase}
              pointerEvents="none"
            />
            <BinaryPatternBackdrop />
            {Platform.OS === 'ios' ? (
              <BlurView intensity={28} tint="light" style={styles.sheetBlur} pointerEvents="none" />
            ) : Platform.OS === 'android' ? (
              <LinearGradient
                colors={['rgba(186, 230, 253, 0.35)', 'rgba(221, 214, 254, 0.28)', 'rgba(250, 245, 255, 0.45)']}
                locations={[0, 0.5, 1]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.sheetAndroidSoft}
                pointerEvents="none"
              />
            ) : null}
            <LinearGradient
              colors={['rgba(255,255,255,0.1)', 'rgba(248,250,255,0.75)', 'rgba(255,255,255,0.9)']}
              locations={[0, 0.45, 1]}
              style={styles.sheetVeil}
              pointerEvents="none"
            />
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
            <Pressable onPress={closeWithHaptic} hitSlop={14} style={styles.closeBtn}>
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

          {pendingLearning && onApproveLearning && onCancelLearning ? (
            <View style={styles.learningApprovalBar} accessibilityRole="toolbar">
              <Text style={styles.learningApprovalHint}>Patron onayı bekliyorum.</Text>
              <View style={styles.learningApprovalRow}>
                <Pressable
                  onPress={() => {
                    void Haptics.selectionAsync();
                    onApproveLearning();
                  }}
                  style={({ pressed }) => [styles.learningBtn, styles.learningBtnApprove, pressed && { opacity: 0.88 }]}
                  accessibilityRole="button"
                  accessibilityLabel="Onayla"
                >
                  <Text style={styles.learningBtnText}>Onayla ✅</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    void Haptics.selectionAsync();
                    onCancelLearning();
                  }}
                  style={({ pressed }) => [styles.learningBtn, styles.learningBtnCancel, pressed && { opacity: 0.88 }]}
                  accessibilityRole="button"
                  accessibilityLabel="İptal"
                >
                  <Text style={styles.learningBtnTextDark}>İptal ❌</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          <View style={styles.listWrap}>
            <FlatList
              ref={listRef}
              data={messages}
              extraData={messagesScrollSig}
              keyExtractor={keyExtractor}
              renderItem={renderItem}
              style={styles.list}
              scrollEnabled={visible}
              nestedScrollEnabled
              scrollEventThrottle={16}
              onContentSizeChange={onListContentSizeChange}
              contentContainerStyle={[
                styles.listContent,
                messages.length === 0 ? styles.listContentEmpty : null,
              ]}
              keyboardShouldPersistTaps="always"
              keyboardDismissMode="none"
              showsVerticalScrollIndicator
              removeClippedSubviews={false}
              bounces
              overScrollMode="always"
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
                blurOnSubmit={false}
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
                  ios: { keyboardAppearance: 'light' as const, submitBehavior: 'newline' as const },
                  android: { submitBehavior: 'newline' as const },
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
                    <Ionicons name="arrow-forward" size={20} color="#fff" />
                  )}
                </LinearGradient>
              </Pressable>
            </View>
            </View>
          </LinearGradient>
            </View>
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
  },
  kavCenterFill: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  sheet: {
    position: 'relative',
    width: '100%',
    maxWidth: 440,
    minHeight: 300,
    minWidth: 0,
    flexShrink: 1,
    alignSelf: 'center',
    backgroundColor: '#EEF8FF',
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(14, 165, 233, 0.72)',
    ...Platform.select({
      ios: {
        shadowColor: '#0c4a6e',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.2,
        shadowRadius: 28,
      },
      android: { elevation: 20 },
    }),
  },
  sheetSkyBase: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  binaryPatternWrap: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
    overflow: 'hidden',
    opacity: 0.16,
    paddingTop: 24,
    paddingLeft: 12,
  },
  binaryPatternLine: {
    fontFamily: DIGITAL_MONO,
    fontSize: 11,
    lineHeight: 18,
    fontWeight: '300',
    letterSpacing: 4,
    color: 'rgba(59, 130, 246, 0.5)',
    fontVariant: ['tabular-nums'],
  },
  sheetBlur: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },
  /** Android: BlurView yerine hafif katman (kasma riskini azaltır) */
  sheetAndroidSoft: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },
  sheetVeil: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },
  cloudLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
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
    zIndex: 10,
    paddingHorizontal: Spacing.sm + 2,
    paddingBottom: 0,
    minHeight: 0,
  },
  headerBar: {
    borderRadius: BorderRadius.lg,
    paddingTop: Spacing.sm + 2,
    paddingBottom: Spacing.sm + 2,
    paddingHorizontal: Spacing.sm + 2,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.42)',
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
    marginLeft: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
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
    fontFamily: DIGITAL_MONO,
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
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
    fontFamily: DIGITAL_MONO,
    fontSize: 14,
    fontWeight: '800',
    color: '#0c4a6e',
    letterSpacing: 0.15,
    flexShrink: 1,
  },
  headerSubtitle: {
    fontFamily: DIGITAL_MONO,
    fontSize: 10,
    color: '#475569',
    marginTop: 2,
    fontWeight: '600',
    letterSpacing: 0.12,
    lineHeight: 14,
  },
  modeCaptionInline: {
    fontFamily: DIGITAL_MONO,
    fontSize: 9,
    color: '#64748B',
    marginTop: 5,
    fontWeight: '600',
    letterSpacing: 0.08,
    opacity: 0.92,
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
    fontFamily: DIGITAL_MONO,
    fontSize: 10,
    lineHeight: 15,
    color: Colors.gray700,
    paddingRight: Spacing.sm,
  },
  betaDismiss: {
    paddingTop: 2,
  },
  learningApprovalBar: {
    marginBottom: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    backgroundColor: 'rgba(224, 242, 254, 0.96)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.35)',
  },
  learningApprovalHint: {
    fontFamily: DIGITAL_MONO,
    fontSize: 11,
    lineHeight: 16,
    color: '#0f172a',
    marginBottom: Spacing.sm,
    fontWeight: '600',
  },
  learningApprovalRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  learningBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: BorderRadius.sm,
    minWidth: 112,
    alignItems: 'center',
  },
  learningBtnApprove: {
    backgroundColor: '#2563EB',
  },
  learningBtnCancel: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.8)',
  },
  learningBtnText: {
    fontFamily: DIGITAL_MONO,
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  learningBtnTextDark: {
    fontFamily: DIGITAL_MONO,
    color: '#0f172a',
    fontWeight: '700',
    fontSize: 12,
  },
  errorBanner: {
    backgroundColor: '#FFEBEE',
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
  },
  errorText: {
    fontFamily: DIGITAL_MONO,
    color: Colors.error,
    fontSize: 11,
    lineHeight: 16,
  },
  listWrap: {
    flex: 1,
    minHeight: 0,
    zIndex: 1,
    marginTop: 2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.38)',
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  list: { flex: 1 },
  listContent: {
    paddingVertical: Spacing.sm,
    paddingBottom: Spacing.lg + 12,
    flexGrow: 1,
  },
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
    fontFamily: DIGITAL_MONO,
    fontSize: 13,
    fontWeight: '800',
    color: '#0c4a6e',
    letterSpacing: 0.12,
  },
  emptyBody: {
    fontFamily: DIGITAL_MONO,
    marginTop: Spacing.sm,
    textAlign: 'center',
    lineHeight: 17,
    color: '#334155',
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.04,
  },
  bubbleWrap: { marginBottom: Spacing.md, maxWidth: '92%' },
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
    borderColor: 'rgba(59, 130, 246, 0.35)',
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
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.sm + 4,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
  },
  bubbleUserGrad: {
    paddingHorizontal: Spacing.sm + 4,
    paddingVertical: Spacing.sm + 2,
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
    fontFamily: DIGITAL_MONO,
    fontSize: 13,
    lineHeight: 19,
    letterSpacing: 0.04,
  },
  bubbleTextUser: { color: '#fff', fontWeight: '600' },
  bubbleTextAi: {
    color: '#0f172a',
    fontWeight: '500',
    opacity: 1,
    flexShrink: 1,
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
  composerBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(63, 169, 245, 0.28)',
    marginHorizontal: -(Spacing.sm + 2),
    paddingHorizontal: Spacing.sm + 2,
    paddingTop: Spacing.sm,
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
    fontFamily: DIGITAL_MONO,
    fontSize: 9,
    fontWeight: '700',
    color: '#475569',
    letterSpacing: 0.55,
    textTransform: 'uppercase',
    marginBottom: 6,
    marginLeft: 2,
  },
  composerCard: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 16,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.4)',
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
    minHeight: 40,
    maxHeight: 140,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.38)',
    borderRadius: 14,
    paddingHorizontal: Spacing.sm + 4,
    paddingVertical: Platform.OS === 'ios' ? 9 : 8,
    fontFamily: DIGITAL_MONO,
    fontSize: 12,
    lineHeight: 17,
    color: '#0f172a',
    backgroundColor: '#FFFFFF',
    marginRight: Spacing.sm,
    fontWeight: '500',
    letterSpacing: 0.04,
  },
  sendBtnOuter: {
    borderRadius: 22,
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
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.96 }],
  },
  sendBtnDisabled: { opacity: 0.45 },
});
