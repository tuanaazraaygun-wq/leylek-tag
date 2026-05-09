import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import * as Speech from 'expo-speech';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  AppState,
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
import { useLeylekZekaChrome } from '../contexts/LeylekZekaChromeContext';
import {
  type LeylekZekaMessage,
  type LeylekZekaReplySource,
  type LeylekZekaSendOptions,
} from '../hooks/useLeylekZeka';
import { getLeylekZekaContextCopy } from '../lib/leylekZekaUxCopy';

const BETA_HINT_KEY = 'leylek_zeka_beta_hint_dismissed_v1';
const LOGO = require('../assets/images/logo.png');

/** Giriş / CTA ile aynı marka gradient’i (app/index — Teklif Gönder vb.) */
const BRAND_GRADIENT = ['#3FA9F5', '#2563EB', '#1D4ED8'] as const;

/** İçerik boyutu değişince scroll — uzun metin layout sonrası yakalamak için kısa tutulur */
const SCROLL_ON_CONTENT_SIZE_DEBOUNCE_MS = 48;
/** Mesaj/typing değişiminden sonra ilk scroll gecikmesi */
const SCROLL_AFTER_UPDATE_MS = 72;
/** Android speech provider final result'ı stop/end sonrasında gecikmeli gönderebilir. */
const VOICE_TRANSCRIPT_SUBMIT_DELAY_MS = 680;
/** Çok kısa basışlar çoğunlukla recognizer başlamadan stop aldığı için boş sonuç üretir. */
const VOICE_MIN_HOLD_MS = 800;
/** Yanlışlıkla gelen erken onPressOut olaylarında recognizer start'a kısa pencere tanır. */
const VOICE_RELEASE_DEBOUNCE_MS = 160;
/** Backend streaming yokken düşük maliyetli kelime grubu typewriter hissi. */
const TYPEWRITER_INTERVAL_MS = 58;
const TYPEWRITER_SHORT_CHUNK_WORDS = 5;
const TYPEWRITER_LONG_CHUNK_WORDS = 8;

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

function sanitizeSpeechText(text: string): string {
  const normalized = text
    .replace(/\*\*([^*\n][\s\S]*?[^*\n])\*\*/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/[^\p{L}\p{N}\s.,!?;:()/%+-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (normalized.length <= 900) return normalized;
  return `${normalized.slice(0, 900).trim()}... Devamını ekrandan okuyabilirsiniz.`;
}

function buildTypewriterFrames(text: string): string[] {
  const tokens = text.match(/\S+\s*/g) ?? [text];
  const chunkSize =
    text.length > 650 ? TYPEWRITER_LONG_CHUNK_WORDS : TYPEWRITER_SHORT_CHUNK_WORDS;
  const frames: string[] = [];
  for (let i = chunkSize; i < tokens.length; i += chunkSize) {
    frames.push(tokens.slice(0, i).join('').trimEnd());
  }
  frames.push(text);
  return frames;
}

type Props = {
  visible: boolean;
  onClose: () => void;
  messages: LeylekZekaMessage[];
  isTyping: boolean;
  error: string | null;
  onSend: (text: string, options?: LeylekZekaSendOptions) => void;
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

const Bubble = memo(function Bubble({
  item,
  displayText,
}: {
  item: LeylekZekaMessage;
  displayText?: string;
}) {
  const isUser = item.role === 'user';
  const text = displayText ?? item.text;
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
            {text}
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
            {text}
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

const EmptyWelcome = memo(function EmptyWelcome({
  title,
  body,
  operationTitle,
  operationBody,
  safeChecklist,
  prompts,
  disabled,
  onPromptPress,
}: {
  title: string;
  body: string;
  operationTitle: string;
  operationBody: string;
  safeChecklist: string[];
  prompts: string[];
  disabled: boolean;
  onPromptPress: (prompt: string) => void;
}) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconWrap}>
        <Image source={LOGO} style={styles.emptyLogo} resizeMode="contain" accessibilityIgnoresInvertColors />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
      <View style={styles.operationGuideCard}>
        <Text style={styles.operationGuideTitle}>{operationTitle}</Text>
        <Text style={styles.operationGuideBody}>{operationBody}</Text>
        <View style={styles.operationChecklist}>
          {safeChecklist.slice(0, 4).map((item) => (
            <View key={item} style={styles.operationChecklistRow}>
              <Ionicons name="checkmark-circle" size={13} color="#2563EB" />
              <Text style={styles.operationChecklistText}>{item}</Text>
            </View>
          ))}
        </View>
      </View>
      <Text style={styles.emptyPromptTitle}>Sorabileceğin başlıklar</Text>
      <View style={styles.emptyPromptGrid}>
        {prompts.map((prompt) => (
          <Pressable
            key={prompt}
            onPress={() => onPromptPress(prompt)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={prompt}
            style={({ pressed }) => [
              styles.emptyPromptChip,
              disabled && styles.emptyPromptChipDisabled,
              pressed && !disabled && styles.emptyPromptChipPressed,
            ]}
          >
            <Text style={styles.emptyPromptText}>{prompt}</Text>
          </Pressable>
        ))}
      </View>
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
  const { homeFlowScreen, flowHint } = useLeylekZekaChrome();
  const [input, setInput] = useState('');
  const [showBetaHint, setShowBetaHint] = useState(false);
  const [speechEnabled, setSpeechEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [hasSpeakableAssistant, setHasSpeakableAssistant] = useState(false);
  const [displayedAssistantTextById, setDisplayedAssistantTextById] = useState<Record<string, string>>({});
  const [activeTypingMessageId, setActiveTypingMessageId] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [partialTranscript, setPartialTranscript] = useState('');
  const [voiceInputError, setVoiceInputError] = useState('');
  const [voiceDebugText, setVoiceDebugText] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const listRef = useRef<FlatList<LeylekZekaMessage>>(null);
  const scrollRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentSizeScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typewriterIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);
  const voicePulse = useRef(new Animated.Value(0)).current;
  const voiceWave = useRef(new Animated.Value(0)).current;
  /** Modal açık mı — kapanış sonrası async zincirlerde güncel değer */
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  /**
   * Modal kapanınca artırılır; scrollToEnd zincirinde yakalanan nesil uyuşmuyorsa scroll iptal.
   * Kapalı modal / unmount üzerinde scrollToEnd çağrılarını etkisizleştirir.
   */
  const scrollGenRef = useRef(0);
  const lastAssistantSpeechIdRef = useRef<string | null>(null);
  const lastTypewriterAssistantIdRef = useRef<string | null>(null);
  const lastSpeakableAssistantTextRef = useRef('');
  const prevVisibleForSpeechRef = useRef(visible);
  const finalTranscriptRef = useRef('');
  const lastTranscriptRef = useRef('');
  const partialTranscriptRef = useRef('');
  const pressActiveRef = useRef(false);
  const holdStartedAtRef = useRef<number | null>(null);
  const recognitionStartedRef = useRef(false);
  const suppressNextVoiceErrorRef = useRef(false);
  const voiceSubmitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voiceReleaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voiceStartInFlightRef = useRef(false);
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
  const typewriterRenderSig = useMemo(
    () =>
      activeTypingMessageId
        ? `${activeTypingMessageId}:${displayedAssistantTextById[activeTypingMessageId]?.length ?? 0}`
        : '',
    [activeTypingMessageId, displayedAssistantTextById],
  );
  const latestAssistantId = useMemo(
    () => [...messages].reverse().find((m) => m.role === 'assistant')?.id ?? null,
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
      if (typewriterIntervalRef.current) {
        clearInterval(typewriterIntervalRef.current);
        typewriterIntervalRef.current = null;
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
    if (!isListening || reduceMotion) {
      voicePulse.stopAnimation();
      voicePulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(voicePulse, {
          toValue: 1,
          duration: 920,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(voicePulse, {
          toValue: 0,
          duration: 920,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isListening, reduceMotion, voicePulse]);

  useEffect(() => {
    if (!isListening || reduceMotion) {
      voiceWave.stopAnimation();
      voiceWave.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(voiceWave, {
          toValue: 1,
          duration: 720,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(voiceWave, {
          toValue: 0,
          duration: 720,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isListening, reduceMotion, voiceWave]);

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

  const stopSpeech = useCallback(() => {
    setIsSpeaking(false);
    if (Platform.OS === 'web') return;
    try {
      Speech.stop();
    } catch {
      /* speech engine race */
    }
  }, []);

  const clearTypewriter = useCallback((resetDisplayed = false) => {
    if (typewriterIntervalRef.current) {
      clearInterval(typewriterIntervalRef.current);
      typewriterIntervalRef.current = null;
    }
    setActiveTypingMessageId(null);
    if (resetDisplayed) {
      setDisplayedAssistantTextById({});
    }
  }, []);

  const interruptAssistantOutputForVoice = useCallback(() => {
    stopSpeech();
    const typingId = activeTypingMessageId;
    if (!typingId) return;

    const activeAssistant = messages.find((m) => m.id === typingId && m.role === 'assistant');
    clearTypewriter(false);
    if (!activeAssistant) return;

    setDisplayedAssistantTextById((prev) => ({
      ...prev,
      [activeAssistant.id]: activeAssistant.text,
    }));
    lastAssistantSpeechIdRef.current = activeAssistant.id;
  }, [activeTypingMessageId, clearTypewriter, messages, stopSpeech]);

  const clearVoiceSubmitTimer = useCallback(() => {
    if (voiceSubmitTimerRef.current) {
      clearTimeout(voiceSubmitTimerRef.current);
      voiceSubmitTimerRef.current = null;
    }
  }, []);

  const clearVoiceReleaseTimer = useCallback(() => {
    if (voiceReleaseTimerRef.current) {
      clearTimeout(voiceReleaseTimerRef.current);
      voiceReleaseTimerRef.current = null;
    }
  }, []);

  const resetVoiceInputState = useCallback(() => {
    finalTranscriptRef.current = '';
    lastTranscriptRef.current = '';
    partialTranscriptRef.current = '';
    holdStartedAtRef.current = null;
    setPartialTranscript('');
    setVoiceInputError('');
  }, []);

  const abortVoiceInput = useCallback(() => {
    clearVoiceSubmitTimer();
    clearVoiceReleaseTimer();
    const hadVoiceSession =
      pressActiveRef.current || recognitionStartedRef.current || Boolean(partialTranscriptRef.current);
    pressActiveRef.current = false;
    voiceStartInFlightRef.current = false;
    recognitionStartedRef.current = false;
    if (hadVoiceSession) suppressNextVoiceErrorRef.current = true;
    try {
      ExpoSpeechRecognitionModule.abort();
    } catch {
      /* recognizer may already be inactive */
    }
    setIsListening(false);
    resetVoiceInputState();
  }, [clearVoiceReleaseTimer, clearVoiceSubmitTimer, resetVoiceInputState]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'background') return;
      abortVoiceInput();
      stopSpeech();
      clearTypewriter(true);
    });
    return () => sub.remove();
  }, [abortVoiceInput, clearTypewriter, stopSpeech]);

  const submitVoiceTranscript = useCallback(() => {
    clearVoiceSubmitTimer();
    const transcript = (
      finalTranscriptRef.current ||
      lastTranscriptRef.current ||
      partialTranscriptRef.current
    ).trim();
    finalTranscriptRef.current = '';
    lastTranscriptRef.current = '';
    partialTranscriptRef.current = '';
    holdStartedAtRef.current = null;
    recognitionStartedRef.current = false;
    if (!mountedRef.current || !visibleRef.current) return;
    setPartialTranscript('');
    if (!transcript) {
      setVoiceInputError('Ses algılanamadı, tekrar deneyin.');
      return;
    }
    setVoiceInputError('');
    onSend(transcript, { voiceMode: true, inputMode: 'voice' });
  }, [clearVoiceSubmitTimer, onSend]);

  const scheduleVoiceTranscriptSubmit = useCallback(() => {
    clearVoiceSubmitTimer();
    voiceSubmitTimerRef.current = setTimeout(() => {
      voiceSubmitTimerRef.current = null;
      submitVoiceTranscript();
    }, VOICE_TRANSCRIPT_SUBMIT_DELAY_MS);
  }, [clearVoiceSubmitTimer, submitVoiceTranscript]);

  useSpeechRecognitionEvent('start', () => {
    setVoiceDebugText('debug: recognizer started');
    recognitionStartedRef.current = true;
    setIsListening(true);
    setVoiceInputError('');
  });

  useSpeechRecognitionEvent('end', () => {
    setVoiceDebugText('debug: recognizer ended');
    setIsListening(false);
    if (!pressActiveRef.current && recognitionStartedRef.current) {
      scheduleVoiceTranscriptSubmit();
    }
  });

  useSpeechRecognitionEvent('result', (event) => {
    setVoiceDebugText('debug: result received');
    const transcript = (event.results?.[0]?.transcript ?? '').trim();
    if (!transcript) return;
    partialTranscriptRef.current = transcript;
    lastTranscriptRef.current = transcript;
    setPartialTranscript(transcript);
    if (event.isFinal) {
      finalTranscriptRef.current = transcript;
    }
  });

  useSpeechRecognitionEvent('error', (event) => {
    setVoiceDebugText(`debug: error: ${event.error || 'unknown'}`);
    if (suppressNextVoiceErrorRef.current || event.error === 'aborted') {
      suppressNextVoiceErrorRef.current = false;
      return;
    }
    recognitionStartedRef.current = false;
    holdStartedAtRef.current = null;
    setIsListening(false);
    if (lastTranscriptRef.current.trim()) {
      scheduleVoiceTranscriptSubmit();
      return;
    }
    const message =
      event.error === 'not-allowed'
        ? 'Mikrofon izni olmadan bas-konuş kullanılamaz.'
        : 'Ses algılanamadı, tekrar deneyin.';
    setVoiceInputError(message);
  });

  useEffect(() => {
    return () => {
      clearTypewriter(true);
      abortVoiceInput();
      stopSpeech();
    };
  }, [abortVoiceInput, clearTypewriter, stopSpeech]);

  useEffect(() => {
    const wasVisible = prevVisibleForSpeechRef.current;
    prevVisibleForSpeechRef.current = visible;
    if (!visible) {
      clearTypewriter(true);
      abortVoiceInput();
      stopSpeech();
      return;
    }
    if (!wasVisible) {
      lastAssistantSpeechIdRef.current = latestAssistantId;
      lastTypewriterAssistantIdRef.current = latestAssistantId;
    }
  }, [abortVoiceInput, clearTypewriter, latestAssistantId, stopSpeech, visible]);

  const speakAssistantText = useCallback((rawText: string) => {
    if (Platform.OS === 'web') return;
    const text = sanitizeSpeechText(rawText);
    if (!text) return;
    try {
      Speech.stop();
      Speech.speak(text, {
        language: 'tr-TR',
        rate: 1.0,
        pitch: 1.0,
        onStart: () => setIsSpeaking(true),
        onDone: () => setIsSpeaking(false),
        onStopped: () => setIsSpeaking(false),
        onError: () => setIsSpeaking(false),
      });
    } catch {
      setIsSpeaking(false);
      /* Sesli cevap desteklenmeyen cihazlarda chat yazılı kalır. */
    }
  }, []);

  useEffect(() => {
    const latest = messages[messages.length - 1];
    if (!latest || latest.role !== 'assistant') return;
    lastSpeakableAssistantTextRef.current = latest.text;
    setHasSpeakableAssistant(Boolean(sanitizeSpeechText(latest.text)));
    if (lastTypewriterAssistantIdRef.current === latest.id) return;
    lastTypewriterAssistantIdRef.current = latest.id;
    clearTypewriter(false);

    const speakAfterDisplay = () => {
      if (lastAssistantSpeechIdRef.current === latest.id) return;
      lastAssistantSpeechIdRef.current = latest.id;
      if (!visible || !speechEnabled) return;
      speakAssistantText(latest.text);
    };

    if (!visible || reduceMotion) {
      setDisplayedAssistantTextById((prev) => ({ ...prev, [latest.id]: latest.text }));
      speakAfterDisplay();
      return;
    }

    const frames = buildTypewriterFrames(latest.text);
    let index = 0;
    setActiveTypingMessageId(latest.id);
    setDisplayedAssistantTextById((prev) => ({ ...prev, [latest.id]: frames[0] ?? latest.text }));
    typewriterIntervalRef.current = setInterval(() => {
      index += 1;
      const next = frames[index];
      if (!next) {
        clearTypewriter(false);
        setDisplayedAssistantTextById((prev) => ({ ...prev, [latest.id]: latest.text }));
        speakAfterDisplay();
        return;
      }
      setDisplayedAssistantTextById((prev) => ({ ...prev, [latest.id]: next }));
    }, TYPEWRITER_INTERVAL_MS);
  }, [clearTypewriter, messages, reduceMotion, speakAssistantText, speechEnabled, visible]);

  const toggleSpeechEnabled = useCallback(() => {
    setSpeechEnabled((v) => {
      if (v) stopSpeech();
      return !v;
    });
  }, [stopSpeech]);

  const replayLastAssistantSpeech = useCallback(() => {
    const text = lastSpeakableAssistantTextRef.current;
    if (!text) return;
    speakAssistantText(text);
  }, [speakAssistantText]);

  const startVoiceInput = useCallback(async () => {
    interruptAssistantOutputForVoice();
    clearVoiceReleaseTimer();
    if (isTyping) {
      setVoiceDebugText('debug: blocked isTyping');
      return;
    }
    if (voiceStartInFlightRef.current) {
      setVoiceDebugText('debug: blocked start in flight');
      return;
    }
    if (pressActiveRef.current || recognitionStartedRef.current) {
      setVoiceDebugText('debug: blocked active session');
      return;
    }
    voiceStartInFlightRef.current = true;
    clearVoiceSubmitTimer();
    resetVoiceInputState();
    suppressNextVoiceErrorRef.current = false;
    pressActiveRef.current = true;
    holdStartedAtRef.current = Date.now();
    try {
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permission.granted) {
        pressActiveRef.current = false;
        voiceStartInFlightRef.current = false;
        holdStartedAtRef.current = null;
        setIsListening(false);
        setVoiceDebugText('debug: permission denied');
        setVoiceInputError('Mikrofon izni olmadan bas-konuş kullanılamaz.');
        return;
      }
      if (!pressActiveRef.current) {
        setVoiceDebugText('debug: press cancelled before start');
        return;
      }
      setVoiceDebugText('debug: starting recognizer');
      ExpoSpeechRecognitionModule.start({
        lang: 'tr-TR',
        interimResults: true,
        continuous: false,
      });
      setVoiceDebugText('debug: recognizer start called');
    } catch {
      pressActiveRef.current = false;
      voiceStartInFlightRef.current = false;
      setIsListening(false);
      setVoiceInputError('Bas-konuş başlatılamadı. Cihazınızda konuşma tanıma desteklenmeyebilir.');
    } finally {
      voiceStartInFlightRef.current = false;
    }
  }, [clearVoiceReleaseTimer, clearVoiceSubmitTimer, interruptAssistantOutputForVoice, isTyping, resetVoiceInputState]);

  const stopVoiceInput = useCallback(() => {
    clearVoiceReleaseTimer();
    if (!pressActiveRef.current && !isListening && !recognitionStartedRef.current) return;
    const holdDuration = holdStartedAtRef.current ? Date.now() - holdStartedAtRef.current : 0;
    pressActiveRef.current = false;
    if (holdDuration > 0 && holdDuration < VOICE_MIN_HOLD_MS) {
      clearVoiceSubmitTimer();
      holdStartedAtRef.current = null;
      finalTranscriptRef.current = '';
      lastTranscriptRef.current = '';
      partialTranscriptRef.current = '';
      setPartialTranscript('');
      setIsListening(false);
      setVoiceInputError('Biraz daha basılı tutup konuşun.');
      if (recognitionStartedRef.current || isListening) {
        recognitionStartedRef.current = false;
        suppressNextVoiceErrorRef.current = true;
        try {
          ExpoSpeechRecognitionModule.abort();
        } catch {
          /* recognizer may already be inactive */
        }
      }
      return;
    }
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {
      setIsListening(false);
      scheduleVoiceTranscriptSubmit();
      return;
    }
    scheduleVoiceTranscriptSubmit();
  }, [clearVoiceReleaseTimer, clearVoiceSubmitTimer, isListening, scheduleVoiceTranscriptSubmit]);

  const scheduleStopVoiceInput = useCallback(() => {
    clearVoiceReleaseTimer();
    voiceReleaseTimerRef.current = setTimeout(() => {
      voiceReleaseTimerRef.current = null;
      stopVoiceInput();
    }, VOICE_RELEASE_DEBOUNCE_MS);
  }, [clearVoiceReleaseTimer, stopVoiceInput]);

  const onSubmit = useCallback(() => {
    const t = input.trim();
    if (!t || isTyping) return;
    clearTypewriter(true);
    abortVoiceInput();
    stopSpeech();
    if (Platform.OS !== 'web') {
      try {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {
        /* ignore */
      }
    }
    setInput('');
    onSend(t, { voiceMode: speechEnabled, inputMode: 'text' });
  }, [abortVoiceInput, clearTypewriter, input, isTyping, onSend, speechEnabled, stopSpeech]);

  const contextCopy = useMemo(
    () => getLeylekZekaContextCopy(homeFlowScreen ?? null, flowHint),
    [homeFlowScreen, flowHint],
  );

  const onStarterPromptPress = useCallback(
    (prompt: string) => {
      if (isTyping) return;
      clearTypewriter(true);
      abortVoiceInput();
      stopSpeech();
      if (Platform.OS !== 'web') {
        try {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch {
          /* ignore */
        }
      }
      onSend(prompt, { voiceMode: speechEnabled, inputMode: 'text' });
    },
    [abortVoiceInput, clearTypewriter, isTyping, onSend, speechEnabled, stopSpeech],
  );

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
    ({ item }: { item: LeylekZekaMessage }) => (
      <Bubble
        item={item}
        displayText={item.role === 'assistant' ? displayedAssistantTextById[item.id] : undefined}
      />
    ),
    [displayedAssistantTextById],
  );

  const keyExtractor = useCallback((m: LeylekZekaMessage) => m.id, []);

  const modeCaption =
    lastReplySource === 'fallback'
      ? 'Hazır yanıtlarla destekleniyorsunuz.'
      : lastReplySource === 'openai' || lastReplySource === 'kb'
        ? 'Yapay zeka yanıtı (Leylek AI).'
        : lastReplySource === 'answer_engine' || lastReplySource === 'admin_kb'
          ? 'Resmi adım adım yanıt.'
          : null;

  const headerSubtitle = `${contextCopy.stageLabel} · Rehber`;
  const voiceStatusTitle = voiceInputError
    ? 'Bas-konuş durdu'
    : isListening
      ? 'Dinleniyor'
      : 'Basılı tut ve konuş';
  const voiceStatusBody = voiceInputError
    ? voiceInputError
    : isListening
      ? 'Bırakınca gönderilecek'
      : 'Mikrofona basılı tutarak sorunuzu söyleyin.';
  const voicePulseStyle = {
    opacity: voicePulse.interpolate({ inputRange: [0, 1], outputRange: [0.22, 0.58] }),
    transform: [
      {
        scale: voicePulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.42] }),
      },
    ],
  };
  const voiceWaveBars = useMemo(
    () =>
      [
        [0.42, 0.92, 0.58, 1, 0.48],
        [0.72, 0.44, 1, 0.52, 0.86],
        [0.5, 1, 0.46, 0.9, 0.62],
        [0.86, 0.56, 0.96, 0.42, 0.78],
        [0.48, 0.84, 0.54, 1, 0.44],
      ].map((outputRange) => ({
        opacity: voiceWave.interpolate({
          inputRange: [0, 0.25, 0.5, 0.75, 1],
          outputRange: outputRange.map((v) => 0.42 + v * 0.42),
        }),
        transform: [
          {
            scaleY: voiceWave.interpolate({
              inputRange: [0, 0.25, 0.5, 0.75, 1],
              outputRange,
            }),
          },
        ],
      })),
    [voiceWave],
  );

  const closeWithHaptic = useCallback(() => {
    abortVoiceInput();
    stopSpeech();
    if (Platform.OS !== 'web') {
      try {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {
        /* ignore */
      }
    }
    onClose();
  }, [abortVoiceInput, onClose, stopSpeech]);

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
                  <Text style={styles.headerSubtitle} numberOfLines={1}>
                    {headerSubtitle}
                  </Text>
                  {modeCaption ? <Text style={styles.modeCaptionInline}>{modeCaption}</Text> : null}
                  <View style={styles.speechControlsRow}>
                    <Pressable
                      onPress={toggleSpeechEnabled}
                      accessibilityRole="switch"
                      accessibilityState={{ checked: speechEnabled }}
                      accessibilityLabel="Sesli cevap"
                      style={({ pressed }) => [
                        styles.speechToggle,
                        speechEnabled && styles.speechToggleOn,
                        pressed && styles.speechTogglePressed,
                      ]}
                    >
                      <Ionicons
                        name={speechEnabled ? 'volume-high' : 'volume-mute'}
                        size={12}
                        color={speechEnabled ? '#1D4ED8' : '#64748B'}
                      />
                      <Text style={[styles.speechToggleText, speechEnabled && styles.speechToggleTextOn]}>
                        Sesli cevap {speechEnabled ? 'açık' : 'kapalı'}
                      </Text>
                    </Pressable>
                    {isSpeaking ? (
                      <Pressable
                        onPress={stopSpeech}
                        accessibilityRole="button"
                        accessibilityLabel="Sesli cevabı durdur"
                        style={({ pressed }) => [
                          styles.speechMiniControl,
                          styles.speechMiniControlStop,
                          pressed && styles.speechMiniControlPressed,
                        ]}
                      >
                        <Ionicons name="stop-circle" size={12} color="#B91C1C" />
                        <Text style={[styles.speechMiniControlText, styles.speechMiniControlTextStop]}>
                          Durdur
                        </Text>
                      </Pressable>
                    ) : null}
                    {hasSpeakableAssistant ? (
                      <Pressable
                        onPress={replayLastAssistantSpeech}
                        accessibilityRole="button"
                        accessibilityLabel="Son Leylek Zeka cevabını tekrar oku"
                        style={({ pressed }) => [
                          styles.speechMiniControl,
                          pressed && styles.speechMiniControlPressed,
                        ]}
                      >
                        <Ionicons name="refresh" size={12} color="#1D4ED8" />
                        <Text style={styles.speechMiniControlText}>Tekrar oku</Text>
                      </Pressable>
                    ) : null}
                  </View>
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
                Leylek Zeka yanınızda 🚀{'\n\n'}
                Yolculuk eşleşmeleri, Leylek Teklifi, güvenli kullanım ve uygulama adımları
                hakkında anlık rehberlik alabilirsiniz.{'\n'}
                Sürücüler için kullanım önerileri, yolcular için yolculuk desteği burada.
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

          <View style={styles.listWrap}>
            <FlatList
              ref={listRef}
              data={messages}
              extraData={`${messagesScrollSig}:${typewriterRenderSig}`}
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
              ListEmptyComponent={
                <EmptyWelcome
                  title={contextCopy.emptyTitle}
                  body={contextCopy.emptyBody}
                  operationTitle={contextCopy.operationAwarenessTitle}
                  operationBody={contextCopy.operationAwarenessBody}
                  safeChecklist={contextCopy.safeChecklist}
                  prompts={contextCopy.starterPrompts}
                  disabled={isTyping}
                  onPromptPress={onStarterPromptPress}
                />
              }
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
                      <View style={styles.thinkingHeaderRow}>
                        <Ionicons name="sparkles" size={13} color="#2563EB" />
                        <Text style={styles.thinkingTitle}>Leylek Zeka düşünüyor</Text>
                      </View>
                      <Text style={styles.thinkingSubtitle}>Yanıt hazırlanıyor...</Text>
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
                placeholder={contextCopy.placeholder}
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
                onPressIn={() => {
                  setVoiceDebugText('debug: press in');
                  void startVoiceInput();
                }}
                onPressOut={scheduleStopVoiceInput}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel="Bas-konuş"
                accessibilityHint="Basılı tutarak konuşun, bırakınca Leylek Zeka'ya gönderilir."
                accessibilityState={{ disabled: isTyping }}
                style={({ pressed }) => [
                  styles.micBtn,
                  isListening && styles.micBtnListening,
                  isTyping && styles.micBtnDisabled,
                  pressed && !isTyping && styles.micBtnPressed,
                ]}
                disabled={isTyping}
              >
                <View style={styles.micBtnContent}>
                  {isListening && !reduceMotion ? (
                    <Animated.View
                      pointerEvents="none"
                      style={[styles.micPulseRing, voicePulseStyle]}
                    />
                  ) : null}
                  <Ionicons
                    name={isListening ? 'mic' : 'mic-outline'}
                    size={19}
                    color={isListening ? '#FFFFFF' : '#2563EB'}
                  />
                </View>
              </Pressable>
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
            <View
              style={[
                styles.voiceStatusCard,
                isListening ? styles.voiceStatusCardListening : null,
                voiceInputError ? styles.voiceStatusCardError : null,
              ]}
            >
              <View style={styles.voiceStatusHeader}>
                <View
                  style={[
                    styles.voiceStatusDot,
                    isListening ? styles.voiceStatusDotListening : null,
                    voiceInputError ? styles.voiceStatusDotError : null,
                  ]}
                />
                <Text
                  style={[
                    styles.voiceStatusTitle,
                    voiceInputError ? styles.voiceStatusTitleError : null,
                  ]}
                  numberOfLines={1}
                >
                  {voiceStatusTitle}
                </Text>
              </View>
              <Text
                style={[
                  styles.voiceStatusBody,
                  voiceInputError ? styles.voiceStatusBodyError : null,
                ]}
                numberOfLines={1}
              >
                {voiceStatusBody}
              </Text>
              {isListening ? (
                <View style={styles.voiceWaveformRow} pointerEvents="none">
                  {voiceWaveBars.map((barStyle, index) =>
                    reduceMotion ? (
                      <View
                        key={`voice-wave-${index}`}
                        style={[
                          styles.voiceWaveformBar,
                          index % 2 === 0 ? styles.voiceWaveformBarTall : null,
                        ]}
                      />
                    ) : (
                      <Animated.View
                        key={`voice-wave-${index}`}
                        style={[styles.voiceWaveformBar, barStyle]}
                      />
                    ),
                  )}
                </View>
              ) : null}
              {partialTranscript && !voiceInputError ? (
                <Text style={styles.voicePartialText} numberOfLines={2}>
                  {partialTranscript}
                </Text>
              ) : null}
              {voiceDebugText ? (
                <Text style={styles.voiceDebugText} numberOfLines={1}>
                  {voiceDebugText}
                </Text>
              ) : null}
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
  speechControlsRow: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 6,
  },
  speechToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.78)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(100, 116, 139, 0.28)',
  },
  speechToggleOn: {
    backgroundColor: 'rgba(219, 234, 254, 0.92)',
    borderColor: 'rgba(37, 99, 235, 0.32)',
  },
  speechTogglePressed: {
    opacity: 0.82,
  },
  speechToggleText: {
    fontFamily: DIGITAL_MONO,
    fontSize: 9,
    lineHeight: 12,
    color: '#64748B',
    fontWeight: '700',
    letterSpacing: 0.04,
  },
  speechToggleTextOn: {
    color: '#1D4ED8',
  },
  speechMiniControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(239, 246, 255, 0.9)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(37, 99, 235, 0.24)',
  },
  speechMiniControlStop: {
    backgroundColor: 'rgba(254, 242, 242, 0.92)',
    borderColor: 'rgba(185, 28, 28, 0.24)',
  },
  speechMiniControlPressed: {
    opacity: 0.82,
  },
  speechMiniControlText: {
    fontFamily: DIGITAL_MONO,
    fontSize: 9,
    lineHeight: 12,
    color: '#1D4ED8',
    fontWeight: '800',
  },
  speechMiniControlTextStop: {
    color: '#B91C1C',
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
  operationGuideCard: {
    width: '100%',
    marginTop: Spacing.md,
    paddingVertical: 10,
    paddingHorizontal: 11,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(239, 246, 255, 0.86)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(37, 99, 235, 0.26)',
  },
  operationGuideTitle: {
    fontFamily: DIGITAL_MONO,
    fontSize: 10,
    lineHeight: 14,
    color: '#1d4ed8',
    fontWeight: '800',
    textAlign: 'center',
  },
  operationGuideBody: {
    fontFamily: DIGITAL_MONO,
    marginTop: 5,
    fontSize: 10,
    lineHeight: 14,
    color: '#334155',
    fontWeight: '500',
    textAlign: 'center',
  },
  operationChecklist: {
    marginTop: 8,
    gap: 6,
  },
  operationChecklistRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  operationChecklistText: {
    flex: 1,
    fontFamily: DIGITAL_MONO,
    fontSize: 10,
    lineHeight: 14,
    color: '#0f172a',
    fontWeight: '600',
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
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    backgroundColor: 'rgba(255,255,255,0.98)',
  },
  thinkingHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  thinkingTitle: {
    fontFamily: DIGITAL_MONO,
    fontSize: 11,
    lineHeight: 15,
    color: '#1D4ED8',
    fontWeight: '800',
    letterSpacing: 0.08,
  },
  thinkingSubtitle: {
    fontFamily: DIGITAL_MONO,
    fontSize: 10,
    lineHeight: 13,
    color: '#475569',
    fontWeight: '600',
    marginBottom: 7,
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
  micBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.42)',
    backgroundColor: '#EFF6FF',
  },
  micBtnContent: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micPulseRing: {
    position: 'absolute',
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.65)',
    backgroundColor: 'rgba(37, 99, 235, 0.16)',
  },
  micBtnListening: {
    backgroundColor: '#2563EB',
    borderColor: '#1D4ED8',
  },
  micBtnPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.96 }],
  },
  micBtnDisabled: {
    opacity: 0.34,
    borderColor: 'rgba(100, 116, 139, 0.32)',
  },
  voiceStatusCard: {
    marginTop: 7,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.18)',
    backgroundColor: 'rgba(239, 246, 255, 0.72)',
  },
  voiceStatusCardListening: {
    borderColor: 'rgba(37, 99, 235, 0.42)',
    backgroundColor: 'rgba(219, 234, 254, 0.86)',
  },
  voiceStatusCardError: {
    borderColor: 'rgba(185, 28, 28, 0.28)',
    backgroundColor: 'rgba(254, 242, 242, 0.86)',
  },
  voiceStatusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  voiceStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
    backgroundColor: '#2563EB',
    opacity: 0.72,
  },
  voiceStatusDotListening: {
    backgroundColor: '#1D4ED8',
    opacity: 1,
  },
  voiceStatusDotError: {
    backgroundColor: '#B91C1C',
    opacity: 1,
  },
  voiceStatusTitle: {
    fontFamily: DIGITAL_MONO,
    fontSize: 10,
    lineHeight: 14,
    color: '#1D4ED8',
    fontWeight: '800',
    letterSpacing: 0.08,
  },
  voiceStatusTitleError: {
    color: '#B91C1C',
  },
  voiceStatusBody: {
    fontFamily: DIGITAL_MONO,
    fontSize: 10,
    lineHeight: 13,
    color: '#334155',
    fontWeight: '600',
  },
  voiceStatusBodyError: {
    color: '#991B1B',
  },
  voiceWaveformRow: {
    height: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    marginBottom: 1,
  },
  voiceWaveformBar: {
    width: 4,
    height: 16,
    borderRadius: 3,
    backgroundColor: '#2563EB',
    opacity: 0.72,
  },
  voiceWaveformBarTall: {
    height: 18,
    opacity: 0.86,
  },
  voicePartialText: {
    marginTop: 5,
    fontFamily: DIGITAL_MONO,
    fontSize: 10,
    lineHeight: 14,
    color: '#0F172A',
    fontWeight: '700',
  },
  voiceDebugText: {
    marginTop: 4,
    fontFamily: DIGITAL_MONO,
    fontSize: 9,
    lineHeight: 12,
    color: '#64748B',
    fontWeight: '600',
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
