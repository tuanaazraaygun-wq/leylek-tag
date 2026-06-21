import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
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
  type GestureResponderEvent,
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
import { useTheme } from '../hooks/useTheme';
import {
  type LeylekZekaMessage,
  type LeylekZekaReplySource,
  type LeylekZekaSendOptions,
} from '../hooks/useLeylekZeka';
import { getLeylekZekaContextCopy } from '../lib/leylekZekaUxCopy';
import LeylekEye, { LEYLEK_EYE_CHAT_HEADER_SIZE } from '../design-system/leylek-eye/LeylekEye';

const BETA_HINT_KEY = 'leylek_zeka_beta_hint_dismissed_v1';
const LOGO = require('../assets/images/leylek-logo-premium.png');

/** Giriş / CTA ile aynı marka gradient’i (app/index — Teklif Gönder vb.) */
const BRAND_GRADIENT = ['#3FA9F5', '#2563EB', '#1D4ED8'] as const;
const COCKPIT_CYAN = '#22D3EE';
const COCKPIT_HERO_GRADIENT = ['#0A1628', '#0F2744', '#081018'] as const;

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
/** iOS/Android: Speech.speak öncesi audio mode yenileme aralığı */
const TTS_AUDIO_PREP_TTL_MS = 4000;
const IOS_TTS_SPEECH_RATE = 0.92;

let leylekTtsAudioPreparedAt = 0;

/** expo-speech öncesi playback oturumu (sessiz mod + Agora/InCall sonrası düşük ses). */
async function prepareLeylekZekaTtsAudioMode(): Promise<void> {
  if (Platform.OS === 'web') return;
  const now = Date.now();
  if (now - leylekTtsAudioPreparedAt < TTS_AUDIO_PREP_TTL_MS) return;
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
      interruptionModeIOS: InterruptionModeIOS.DuckOthers,
      interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
    });
    leylekTtsAudioPreparedAt = now;
  } catch {
    /* TTS yine yazılı kalır */
  }
}
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
  isLightShell = false,
}: {
  item: LeylekZekaMessage;
  displayText?: string;
  isLightShell?: boolean;
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
      <View style={[styles.bubbleAiCard, isLightShell && styles.bubbleAiCardLight]}>
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
            style={[styles.bubbleText, styles.bubbleTextAi, isLightShell && styles.bubbleTextAiLight]}
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

const EmptyWelcome = memo(function EmptyWelcome({
  title,
  body,
  operationTitle,
  operationBody: _operationBody,
  safeChecklist,
  prompts,
  disabled,
  onPromptPress,
  isLightShell = false,
}: {
  title: string;
  body: string;
  operationTitle: string;
  operationBody: string;
  safeChecklist: string[];
  prompts: string[];
  disabled: boolean;
  onPromptPress: (prompt: string) => void;
  isLightShell?: boolean;
}) {
  return (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIconWrap, isLightShell && styles.emptyIconWrapLight]}>
        <Image source={LOGO} style={styles.emptyLogo} resizeMode="contain" accessibilityIgnoresInvertColors />
      </View>
      <Text style={[styles.emptyTitle, isLightShell && styles.emptyTitleLight]}>{title}</Text>
      <Text style={[styles.emptyBody, isLightShell && styles.emptyBodyLight]} numberOfLines={2}>
        {body}
      </Text>
      <View style={[styles.operationGuideCard, isLightShell && styles.operationGuideCardLight]}>
        <View style={styles.operationGuideHeader}>
          <Ionicons name="shield-checkmark" size={14} color={isLightShell ? '#0D9488' : COCKPIT_CYAN} />
          <Text style={[styles.operationGuideTitle, isLightShell && styles.operationGuideTitleLight]}>
            {operationTitle}
          </Text>
        </View>
        <View style={styles.operationChecklist}>
          {safeChecklist.slice(0, 2).map((item) => (
            <View key={item} style={styles.operationChecklistRow}>
              <Ionicons name="checkmark-circle" size={12} color={isLightShell ? '#0D9488' : COCKPIT_CYAN} />
              <Text style={[styles.operationChecklistText, isLightShell && styles.operationChecklistTextLight]}>
                {item}
              </Text>
            </View>
          ))}
        </View>
      </View>
      <Text style={[styles.emptyPromptTitle, isLightShell && styles.emptyPromptTitleLight]}>Hızlı başlangıç</Text>
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
              isLightShell && styles.emptyPromptChipLight,
              disabled && styles.emptyPromptChipDisabled,
              pressed && !disabled && styles.emptyPromptChipPressed,
            ]}
          >
            <Text style={[styles.emptyPromptText, isLightShell && styles.emptyPromptTextLight]}>{prompt}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
});

/** Başlık logosu — canonical LeylekEye (SVG + guardian motion). */
const HeaderLogoMark = memo(function HeaderLogoMark({
  reduceMotion,
  isLightShell = false,
}: {
  reduceMotion: boolean;
  isLightShell?: boolean;
}) {
  return (
    <View style={styles.headerLogoSlot}>
      <LeylekEye
        size={LEYLEK_EYE_CHAT_HEADER_SIZE}
        chromeTone="subtle"
        themeVariant={isLightShell ? 'light' : 'dark'}
        motionProfile="guardian"
        reduceMotion={reduceMotion}
        accessibilityLabel="Leylek Zeka"
      />
    </View>
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
  const { resolvedTheme, tokens } = useTheme();
  const isLightShell = resolvedTheme === 'light';
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
  const voiceStopRequestedBeforeStartRef = useRef(false);
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
    voiceStopRequestedBeforeStartRef.current = false;
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
    recognitionStartedRef.current = true;
    setIsListening(true);
    setVoiceInputError('');
    if (voiceStopRequestedBeforeStartRef.current) {
      voiceStopRequestedBeforeStartRef.current = false;
      scheduleStopVoiceInput();
    }
  });

  useSpeechRecognitionEvent('end', () => {
    setIsListening(false);
    if (!pressActiveRef.current && recognitionStartedRef.current) {
      scheduleVoiceTranscriptSubmit();
    }
  });

  useSpeechRecognitionEvent('result', (event) => {
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
      if (speechEnabled && Platform.OS !== 'web') {
        void prepareLeylekZekaTtsAudioMode();
      }
    }
  }, [abortVoiceInput, clearTypewriter, latestAssistantId, speechEnabled, stopSpeech, visible]);

  const speakAssistantText = useCallback(async (rawText: string) => {
    if (Platform.OS === 'web') return;
    if (AppState.currentState !== 'active') return;
    if (pressActiveRef.current || recognitionStartedRef.current || isListening) return;
    const text = sanitizeSpeechText(rawText);
    if (!text) return;
    try {
      await prepareLeylekZekaTtsAudioMode();
      Speech.stop();
      Speech.speak(text, {
        language: 'tr-TR',
        rate: Platform.OS === 'ios' ? IOS_TTS_SPEECH_RATE : 1.0,
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
  }, [isListening]);

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
      void speakAssistantText(latest.text);
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
    void speakAssistantText(text);
  }, [speakAssistantText]);

  const startVoiceInput = useCallback(async () => {
    interruptAssistantOutputForVoice();
    clearVoiceReleaseTimer();
    if (isTyping) {
      return;
    }
    if (voiceStartInFlightRef.current) {
      return;
    }
    if (pressActiveRef.current || recognitionStartedRef.current) {
      return;
    }
    voiceStartInFlightRef.current = true;
    clearVoiceSubmitTimer();
    resetVoiceInputState();
    suppressNextVoiceErrorRef.current = false;
    voiceStopRequestedBeforeStartRef.current = false;
    pressActiveRef.current = true;
    holdStartedAtRef.current = Date.now();
    try {
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permission.granted) {
        pressActiveRef.current = false;
        voiceStartInFlightRef.current = false;
        holdStartedAtRef.current = null;
        setIsListening(false);
        setVoiceInputError('Mikrofon izni olmadan bas-konuş kullanılamaz.');
        return;
      }
      if (!mountedRef.current || !visibleRef.current) {
        return;
      }
      ExpoSpeechRecognitionModule.start({
        lang: 'tr-TR',
        interimResults: true,
        continuous: false,
      });
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
    if (!recognitionStartedRef.current && voiceStartInFlightRef.current) {
      voiceStopRequestedBeforeStartRef.current = true;
      return;
    }
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

  const handleVoiceTouchStart = useCallback((event: GestureResponderEvent) => {
    event.stopPropagation();
    clearVoiceReleaseTimer();
    void startVoiceInput();
  }, [clearVoiceReleaseTimer, startVoiceInput]);

  const handleVoiceTouchEnd = useCallback((event: GestureResponderEvent) => {
    event.stopPropagation();
    scheduleStopVoiceInput();
  }, [scheduleStopVoiceInput]);

  const handleVoiceTouchCancel = useCallback((event: GestureResponderEvent) => {
    event.stopPropagation();
    if (recognitionStartedRef.current) {
      scheduleStopVoiceInput();
    }
  }, [scheduleStopVoiceInput]);

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
        isLightShell={isLightShell}
      />
    ),
    [displayedAssistantTextById, isLightShell],
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

  const headerSubtitle = contextCopy.stageLabel;
  const headerHeroTagline = 'AI kontrol merkezi';
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

  const sheetGradient = isLightShell
    ? (['#F8FAFC', '#F4F7FB', '#EEF2F7'] as const)
    : COCKPIT_HERO_GRADIENT;
  const sheetBorderColor = isLightShell ? 'rgba(0,212,170,0.28)' : 'rgba(34, 211, 238, 0.38)';
  const backdropBg = isLightShell ? 'rgba(15,23,42,0.28)' : 'rgba(2, 6, 14, 0.72)';
  const headerBarColors = isLightShell
    ? (['rgba(255,255,255,0.98)', 'rgba(244,247,251,0.96)', 'rgba(238,242,247,0.94)'] as const)
    : (['rgba(10, 22, 40, 0.98)', 'rgba(8, 18, 34, 0.94)', 'rgba(6, 14, 28, 0.9)'] as const);
  const headerBarBorder = isLightShell ? 'rgba(0,212,170,0.22)' : 'rgba(34, 211, 238, 0.28)';

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
          style={[styles.backdrop, { backgroundColor: backdropBg }]}
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
          <View
            style={[
              styles.sheet,
              isLightShell && styles.sheetLight,
              { height: panelMaxHeight, maxHeight: panelMaxHeight, borderColor: sheetBorderColor },
            ]}
          >
            <LinearGradient
              colors={[...sheetGradient]}
              locations={[0, 0.55, 1]}
              start={{ x: 0.15, y: 0 }}
              end={{ x: 0.9, y: 1 }}
              style={styles.sheetSkyBase}
              pointerEvents="none"
            />
            {Platform.OS === 'ios' ? (
              <BlurView
                intensity={isLightShell ? 28 : 42}
                tint={isLightShell ? 'light' : 'dark'}
                style={styles.sheetBlur}
                pointerEvents="none"
              />
            ) : (
              <LinearGradient
                colors={
                  isLightShell
                    ? (['rgba(255,255,255,0.72)', 'rgba(244,247,251,0.88)'] as const)
                    : (['rgba(8, 18, 32, 0.55)', 'rgba(6, 14, 26, 0.88)'] as const)
                }
                locations={[0, 1]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.sheetAndroidSoft}
                pointerEvents="none"
              />
            )}
            <LinearGradient
              colors={
                isLightShell
                  ? (['rgba(0,212,170,0.06)', 'transparent', 'rgba(14,165,233,0.04)'] as const)
                  : (['rgba(34, 211, 238, 0.08)', 'transparent', 'rgba(37, 99, 235, 0.06)'] as const)
              }
              locations={[0, 0.45, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.sheetVeil}
              pointerEvents="none"
            />

            <View style={[styles.sheetInner, { paddingTop: Math.max(insets.top, 10) + 6 }]}>
          <LinearGradient
            colors={[...headerBarColors]}
            locations={[0, 0.5, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.headerBar, styles.headerBarCompact, { borderColor: headerBarBorder }]}
          >
            <LinearGradient
              colors={[COCKPIT_CYAN, '#3FA9F5', '#2563EB']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.headerBrandStrip}
              pointerEvents="none"
            />
            <LinearGradient
              colors={
                isLightShell
                  ? (['rgba(0,212,170,0.05)', 'transparent', 'rgba(14,165,233,0.03)'] as const)
                  : (['rgba(34, 211, 238, 0.14)', 'transparent', 'rgba(37, 99, 235, 0.1)'] as const)
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.headerBarGlow}
              pointerEvents="none"
            />
            <View style={styles.headerTitleRow}>
              <View style={styles.headerLead}>
                <HeaderLogoMark reduceMotion={reduceMotion} isLightShell={isLightShell} />
                <View style={styles.headerTextCol}>
                  <Text style={[styles.heroEyebrow, styles.heroEyebrowCompact, isLightShell && { color: tokens.accent.primary }]}>
                    {headerHeroTagline}
                  </Text>
                  <View style={styles.titleRow}>
                    <Text
                      style={[styles.title, styles.titleCompact, isLightShell && { color: tokens.text.primary }]}
                      numberOfLines={1}
                    >
                      Leylek Zeka
                    </Text>
                    <LinearGradient
                      colors={[...BRAND_GRADIENT]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.aiBadge}
                    >
                      <Text style={styles.aiBadgeText}>AI</Text>
                    </LinearGradient>
                  </View>
                  <Text
                    style={[styles.headerSubtitle, styles.headerSubtitleCompact, isLightShell && { color: tokens.text.muted }]}
                    numberOfLines={1}
                  >
                    {headerSubtitle}
                    {modeCaption ? ` · ${modeCaption}` : ''}
                  </Text>
                  <View style={styles.speechControlsRow}>
                    <Pressable
                      onPress={toggleSpeechEnabled}
                      accessibilityRole="switch"
                      accessibilityState={{ checked: speechEnabled }}
                      accessibilityLabel="Sesli cevap"
                      style={({ pressed }) => [
                        styles.speechToggle,
                        isLightShell && styles.speechToggleLight,
                        speechEnabled && styles.speechToggleOn,
                        speechEnabled && isLightShell && styles.speechToggleOnLight,
                        !speechEnabled && isLightShell && styles.speechToggleOffLight,
                        pressed && styles.speechTogglePressed,
                      ]}
                    >
                      <Ionicons
                        name={speechEnabled ? 'volume-high' : 'volume-mute'}
                        size={12}
                        color={
                          speechEnabled
                            ? isLightShell
                              ? tokens.accent.primary
                              : '#1D4ED8'
                            : isLightShell
                              ? tokens.text.muted
                              : '#64748B'
                        }
                      />
                      <Text
                        style={[
                          styles.speechToggleText,
                          isLightShell && styles.speechToggleTextLight,
                          speechEnabled && styles.speechToggleTextOn,
                          speechEnabled && isLightShell && styles.speechToggleTextOnLight,
                          !speechEnabled && isLightShell && styles.speechToggleTextOffLight,
                        ]}
                      >
                        Sesli {speechEnabled ? 'açık' : 'kapalı'}
                      </Text>
                    </Pressable>
                    {isSpeaking ? (
                      <Pressable
                        onPress={stopSpeech}
                        accessibilityRole="button"
                        accessibilityLabel="Sesli cevabı durdur"
                        style={({ pressed }) => [
                          styles.speechMiniControl,
                          isLightShell && styles.speechMiniControlLight,
                          styles.speechMiniControlStop,
                          isLightShell && styles.speechMiniControlStopLight,
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
                          isLightShell && styles.speechMiniControlLight,
                          pressed && styles.speechMiniControlPressed,
                        ]}
                      >
                        <Ionicons name="refresh" size={12} color={isLightShell ? tokens.accent.primary : '#1D4ED8'} />
                        <Text
                          style={[
                            styles.speechMiniControlText,
                            isLightShell && styles.speechMiniControlTextLight,
                          ]}
                        >
                          Tekrar oku
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              </View>
            </View>
            <Pressable
              onPress={closeWithHaptic}
              hitSlop={14}
              style={[styles.closeBtn, styles.closeBtnCompact, isLightShell && styles.closeBtnLight]}
            >
              <Ionicons
                name="close"
                size={22}
                color={isLightShell ? tokens.text.muted : 'rgba(226, 232, 240, 0.92)'}
              />
            </Pressable>
          </LinearGradient>

          {showBetaHint ? (
            <View style={[styles.betaBanner, isLightShell && styles.betaBannerLight]}>
              <Text style={[styles.betaText, isLightShell && styles.betaTextLight]}>
                Akıllı rehber aktif · Güvenli akış kontrol altında · Yazı veya sesli sorabilirsiniz.
              </Text>
              <Pressable onPress={dismissBetaHint} hitSlop={8} style={styles.betaDismiss}>
                <Ionicons name="close-circle" size={22} color={Colors.gray500} />
              </Pressable>
            </View>
          ) : null}

          {error ? (
            <Pressable onPress={onClearError} style={[styles.errorBanner, isLightShell && styles.errorBannerLight]}>
              <Text style={[styles.errorText, isLightShell && styles.errorTextLight]}>{error}</Text>
            </Pressable>
          ) : null}

          <View style={[styles.listWrap, isLightShell && styles.listWrapLight]}>
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
                  isLightShell={isLightShell}
                />
              }
              ListFooterComponent={
                isTyping ? (
                  <View style={[styles.typingBubbleOuter, isLightShell && styles.typingBubbleOuterLight]}>
                    <LinearGradient
                      colors={[...BRAND_GRADIENT]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 0, y: 1 }}
                      style={styles.typingAccent}
                    />
                    <View style={[styles.typingBubbleInner, isLightShell && styles.typingBubbleInnerLight]}>
                      <View style={styles.thinkingHeaderRow}>
                        <Ionicons name="sparkles" size={13} color={isLightShell ? '#2563EB' : '#2563EB'} />
                        <Text style={[styles.thinkingTitle, isLightShell && styles.thinkingTitleLight]}>
                          Leylek Zeka düşünüyor
                        </Text>
                      </View>
                      <Text style={[styles.thinkingSubtitle, isLightShell && styles.thinkingSubtitleLight]}>
                        Yanıt hazırlanıyor...
                      </Text>
                      <TypingBars />
                    </View>
                  </View>
                ) : null
              }
            />
          </View>

          <LinearGradient
            colors={
              isLightShell
                ? (['rgba(255,255,255,0.98)', 'rgba(244,247,251,0.98)'] as const)
                : (['rgba(8, 18, 32, 0.97)', 'rgba(6, 14, 26, 0.98)'] as const)
            }
            locations={[0, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={[
              styles.composerBar,
              isLightShell && styles.composerBarLight,
              { paddingBottom: composerBottomPad },
            ]}
          >
            <View style={[styles.composerCard, isLightShell && styles.composerCardLight]}>
              <Pressable
                onTouchStart={handleVoiceTouchStart}
                onTouchEnd={handleVoiceTouchEnd}
                onTouchCancel={handleVoiceTouchCancel}
                accessibilityRole="button"
                accessibilityLabel="Basılı tut ve konuş"
                accessibilityHint="Alanı basılı tutarak konuşun; bırakınca Leylek Zeka'ya gönderilir."
                accessibilityState={{ disabled: isTyping }}
                disabled={isTyping}
                style={({ pressed }) => [
                  styles.voiceHoldZone,
                  isLightShell && styles.voiceHoldZoneLight,
                  isListening && styles.voiceHoldZoneListening,
                  voiceInputError ? styles.voiceHoldZoneError : null,
                  voiceInputError && isLightShell ? styles.voiceHoldZoneErrorLight : null,
                  isTyping && styles.voiceHoldZoneDisabled,
                  pressed && !isTyping && styles.voiceHoldZonePressed,
                ]}
              >
                {isListening ? (
                  <LinearGradient
                    colors={['#2563EB', '#1D4ED8', '#1E40AF']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFillObject}
                    pointerEvents="none"
                  />
                ) : null}
                <View style={styles.voiceHoldInner}>
                  <View style={[styles.voiceHoldIconWrap, isLightShell && !isListening && styles.voiceHoldIconWrapLight]}>
                    {isListening && !reduceMotion ? (
                      <Animated.View
                        pointerEvents="none"
                        style={[styles.voiceHoldPulseRing, voicePulseStyle]}
                      />
                    ) : null}
                    <Ionicons
                      name={isListening ? 'mic' : 'mic-outline'}
                      size={28}
                      color={isListening ? '#FFFFFF' : isLightShell ? tokens.accent.primary : COCKPIT_CYAN}
                    />
                  </View>
                  <View style={styles.voiceHoldTextCol}>
                    <View style={styles.voiceStatusHeader}>
                      <View
                        style={[
                          styles.voiceStatusDot,
                          isListening ? styles.voiceStatusDotListening : null,
                          voiceInputError ? styles.voiceStatusDotError : null,
                          isListening ? styles.voiceStatusDotOnDark : null,
                        ]}
                      />
                      <Text
                        style={[
                          styles.voiceStatusTitle,
                          isListening ? styles.voiceStatusTitleOnDark : null,
                          !isListening && isLightShell ? styles.voiceStatusTitleLight : null,
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
                        isListening ? styles.voiceStatusBodyOnDark : null,
                        !isListening && isLightShell ? styles.voiceStatusBodyLight : null,
                        voiceInputError ? styles.voiceStatusBodyError : null,
                      ]}
                      numberOfLines={2}
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
                                styles.voiceWaveformBarOnDark,
                                index % 2 === 0 ? styles.voiceWaveformBarTall : null,
                              ]}
                            />
                          ) : (
                            <Animated.View
                              key={`voice-wave-${index}`}
                              style={[
                                styles.voiceWaveformBar,
                                styles.voiceWaveformBarOnDark,
                                barStyle,
                              ]}
                            />
                          ),
                        )}
                      </View>
                    ) : null}
                    {partialTranscript && !voiceInputError ? (
                      <Text
                        style={[
                          styles.voicePartialText,
                          isListening ? styles.voicePartialTextOnDark : null,
                        ]}
                        numberOfLines={2}
                      >
                        {partialTranscript}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </Pressable>
              <Text style={[styles.composerLabel, isLightShell && { color: tokens.text.muted }]}>
                Mesaj
              </Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={[styles.input, isLightShell && styles.inputLight]}
                  placeholder={contextCopy.placeholder}
                  placeholderTextColor={isLightShell ? tokens.text.muted : 'rgba(148, 163, 184, 0.75)'}
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
    backgroundColor: 'rgba(2, 6, 14, 0.72)',
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
    backgroundColor: '#070D18',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(34, 211, 238, 0.38)',
    ...Platform.select({
      ios: {
        shadowColor: COCKPIT_CYAN,
        shadowOffset: { width: 0, height: 14 },
        shadowOpacity: 0.22,
        shadowRadius: 32,
      },
      android: { elevation: 22 },
    }),
  },
  sheetLight: {
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      ios: {
        shadowColor: 'rgba(15,23,42,0.12)',
        shadowOpacity: 0.18,
      },
      android: { elevation: 16 },
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
  sheetInner: {
    flex: 1,
    zIndex: 10,
    paddingHorizontal: Spacing.sm + 2,
    paddingBottom: 0,
    minHeight: 0,
  },
  headerBar: {
    borderRadius: BorderRadius.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm + 4,
    paddingHorizontal: Spacing.sm + 4,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.28)',
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
  headerBarCompact: {
    paddingTop: Spacing.sm + 2,
    paddingBottom: Spacing.xs + 2,
    marginBottom: Spacing.xs + 2,
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
    paddingRight: 34,
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
  heroEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: COCKPIT_CYAN,
    marginBottom: 4,
  },
  heroEyebrowCompact: {
    fontSize: 9,
    letterSpacing: 0.9,
    marginBottom: 2,
  },
  headerLogoSlot: {
    marginRight: Spacing.sm,
    marginTop: 0,
    flexShrink: 0,
  },
  headerTextCol: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#F0F9FF',
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  titleCompact: {
    fontSize: 17,
    lineHeight: 21,
    letterSpacing: -0.22,
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(186, 230, 253, 0.82)',
    marginTop: 3,
    fontWeight: '600',
    letterSpacing: 0.02,
    lineHeight: 16,
  },
  headerSubtitleCompact: {
    fontSize: 11,
    lineHeight: 14,
    marginTop: 2,
  },
  modeCaptionInline: {
    fontFamily: DIGITAL_MONO,
    fontSize: 9,
    color: 'rgba(148, 163, 184, 0.9)',
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
    gap: 4,
    marginTop: 4,
  },
  speechToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(15, 30, 52, 0.72)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(34, 211, 238, 0.22)',
  },
  speechToggleLight: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderColor: 'rgba(15,23,42,0.12)',
  },
  speechToggleOn: {
    backgroundColor: 'rgba(37, 99, 235, 0.35)',
    borderColor: 'rgba(34, 211, 238, 0.45)',
  },
  speechToggleOnLight: {
    backgroundColor: 'rgba(0,212,170,0.14)',
    borderColor: 'rgba(0,212,170,0.42)',
  },
  speechToggleOffLight: {
    backgroundColor: 'rgba(241,245,249,0.98)',
    borderColor: 'rgba(100,116,139,0.28)',
  },
  speechTogglePressed: {
    opacity: 0.82,
  },
  speechToggleText: {
    fontFamily: DIGITAL_MONO,
    fontSize: 9,
    lineHeight: 12,
    color: 'rgba(186, 230, 253, 0.72)',
    fontWeight: '700',
    letterSpacing: 0.04,
  },
  speechToggleTextLight: {
    color: 'rgba(71,85,105,0.92)',
  },
  speechToggleTextOn: {
    color: COCKPIT_CYAN,
  },
  speechToggleTextOnLight: {
    color: '#0F766E',
    fontWeight: '800',
  },
  speechToggleTextOffLight: {
    color: 'rgba(100,116,139,0.92)',
  },
  speechMiniControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(12, 24, 42, 0.82)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(34, 211, 238, 0.22)',
  },
  speechMiniControlLight: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderColor: 'rgba(15,23,42,0.10)',
  },
  speechMiniControlStop: {
    backgroundColor: 'rgba(48, 18, 24, 0.88)',
    borderColor: 'rgba(248, 113, 113, 0.35)',
  },
  speechMiniControlStopLight: {
    backgroundColor: 'rgba(254,242,242,0.98)',
    borderColor: 'rgba(248,113,113,0.35)',
  },
  speechMiniControlPressed: {
    opacity: 0.82,
  },
  speechMiniControlText: {
    fontFamily: DIGITAL_MONO,
    fontSize: 9,
    lineHeight: 12,
    color: COCKPIT_CYAN,
    fontWeight: '800',
  },
  speechMiniControlTextLight: {
    color: '#0D9488',
  },
  speechMiniControlTextStop: {
    color: '#FCA5A5',
  },
  closeBtn: {
    position: 'absolute',
    right: Spacing.sm,
    top: Spacing.sm + 4,
    padding: 10,
    borderRadius: 22,
    backgroundColor: 'rgba(12, 24, 42, 0.88)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(34, 211, 238, 0.28)',
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
  closeBtnCompact: {
    top: Spacing.xs + 2,
    padding: 8,
    borderRadius: 18,
  },
  closeBtnLight: {
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderColor: 'rgba(15,23,42,0.10)',
  },
  betaBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(15, 30, 52, 0.72)',
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(34, 211, 238, 0.28)',
  },
  betaBannerLight: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderColor: 'rgba(0,212,170,0.22)',
  },
  betaText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
    color: 'rgba(186, 230, 253, 0.88)',
    paddingRight: Spacing.sm,
    fontWeight: '600',
  },
  betaTextLight: {
    color: 'rgba(51,65,85,0.92)',
  },
  betaDismiss: {
    paddingTop: 2,
  },
  errorBanner: {
    backgroundColor: 'rgba(48, 18, 24, 0.75)',
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.28)',
  },
  errorBannerLight: {
    backgroundColor: 'rgba(254,242,242,0.96)',
    borderColor: 'rgba(248,113,113,0.32)',
  },
  errorText: {
    fontFamily: DIGITAL_MONO,
    color: '#FCA5A5',
    fontSize: 11,
    lineHeight: 16,
  },
  errorTextLight: {
    color: '#B91C1C',
  },
  listWrap: {
    flex: 1,
    minHeight: 0,
    zIndex: 1,
    marginTop: 2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.18)',
    overflow: 'hidden',
    backgroundColor: 'rgba(6, 12, 22, 0.78)',
  },
  listWrapLight: {
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderColor: 'rgba(15,23,42,0.10)',
  },
  list: {
    flex: 1,
    backgroundColor: 'transparent',
  },
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
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: 'rgba(12, 24, 42, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.32)',
    ...Platform.select({
      ios: {
        shadowColor: COCKPIT_CYAN,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
      },
      android: { elevation: 4 },
    }),
  },
  emptyIconWrapLight: {
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderColor: 'rgba(0,212,170,0.24)',
    ...Platform.select({
      ios: {
        shadowColor: 'rgba(15,23,42,0.08)',
      },
      android: { elevation: 2 },
    }),
  },
  emptyLogo: {
    width: 40,
    height: 40,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#F0F9FF',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  emptyTitleLight: {
    color: 'rgba(15,23,42,0.92)',
  },
  emptyBody: {
    marginTop: Spacing.sm,
    textAlign: 'center',
    lineHeight: 18,
    color: 'rgba(186, 230, 253, 0.78)',
    fontSize: 13,
    fontWeight: '500',
  },
  emptyBodyLight: {
    color: 'rgba(71,85,105,0.88)',
  },
  operationGuideCard: {
    width: '100%',
    marginTop: Spacing.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(12, 24, 42, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.22)',
  },
  operationGuideCardLight: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderColor: 'rgba(15,23,42,0.10)',
  },
  operationGuideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 6,
  },
  operationGuideTitle: {
    fontSize: 11,
    lineHeight: 15,
    color: COCKPIT_CYAN,
    fontWeight: '800',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  operationGuideTitleLight: {
    color: '#0F766E',
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
    fontSize: 11,
    lineHeight: 15,
    color: 'rgba(226, 232, 240, 0.9)',
    fontWeight: '600',
  },
  operationChecklistTextLight: {
    color: 'rgba(51,65,85,0.92)',
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
    borderColor: 'rgba(34, 211, 238, 0.22)',
    backgroundColor: 'rgba(12, 24, 42, 0.88)',
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
  bubbleAiCardLight: {
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(15,23,42,0.10)',
    ...Platform.select({
      ios: {
        shadowColor: 'rgba(15,23,42,0.08)',
      },
      android: { elevation: 2 },
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
    backgroundColor: 'transparent',
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
    color: 'rgba(240, 249, 255, 0.95)',
    fontWeight: '500',
    opacity: 1,
    flexShrink: 1,
    width: '100%',
  },
  bubbleTextAiLight: {
    color: 'rgba(13,17,23,0.90)',
  },
  emptyPromptTitle: {
    marginTop: Spacing.md,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: 'rgba(148, 163, 184, 0.9)',
    alignSelf: 'flex-start',
    width: '100%',
  },
  emptyPromptTitleLight: {
    color: 'rgba(100,116,139,0.92)',
  },
  emptyPromptGrid: {
    width: '100%',
    marginTop: 8,
    gap: 8,
  },
  emptyPromptChip: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(12, 24, 42, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.2)',
  },
  emptyPromptChipLight: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderColor: 'rgba(15,23,42,0.10)',
  },
  emptyPromptChipPressed: {
    opacity: 0.88,
    borderColor: 'rgba(34, 211, 238, 0.45)',
  },
  emptyPromptChipDisabled: {
    opacity: 0.4,
  },
  emptyPromptText: {
    fontSize: 12,
    lineHeight: 16,
    color: 'rgba(226, 232, 240, 0.92)',
    fontWeight: '600',
  },
  emptyPromptTextLight: {
    color: 'rgba(51,65,85,0.92)',
  },
  typingBubbleOuter: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'stretch',
    marginBottom: Spacing.sm,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.2)',
    backgroundColor: 'rgba(12, 24, 42, 0.88)',
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
  typingBubbleOuterLight: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderColor: 'rgba(15,23,42,0.10)',
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
    backgroundColor: 'rgba(12, 24, 42, 0.92)',
  },
  typingBubbleInnerLight: {
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
    color: COCKPIT_CYAN,
    fontWeight: '800',
    letterSpacing: 0.08,
  },
  thinkingSubtitle: {
    fontFamily: DIGITAL_MONO,
    fontSize: 10,
    lineHeight: 13,
    color: 'rgba(186, 230, 253, 0.72)',
    fontWeight: '600',
    marginBottom: 7,
  },
  thinkingTitleLight: {
    color: '#2563EB',
  },
  thinkingSubtitleLight: {
    color: 'rgba(71,85,105,0.82)',
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
  composerBarLight: {
    borderTopColor: 'rgba(15,23,42,0.08)',
    ...Platform.select({
      ios: {
        shadowColor: 'rgba(15,23,42,0.06)',
      },
      android: { elevation: 4 },
    }),
  },
  composerLabel: {
    fontFamily: DIGITAL_MONO,
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(148, 163, 184, 0.85)',
    letterSpacing: 0.55,
    textTransform: 'uppercase',
    marginBottom: 6,
    marginTop: 4,
    marginLeft: 2,
  },
  composerCard: {
    backgroundColor: 'rgba(10, 20, 36, 0.92)',
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.28)',
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
  composerCardLight: {
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(15,23,42,0.10)',
    ...Platform.select({
      ios: {
        shadowColor: 'rgba(15,23,42,0.06)',
      },
      android: { elevation: 2 },
    }),
  },
  voiceHoldZone: {
    minHeight: 88,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(34, 211, 238, 0.38)',
    backgroundColor: 'rgba(12, 28, 48, 0.82)',
    marginBottom: 10,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#2563EB',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.14,
        shadowRadius: 8,
      },
      android: { elevation: 3 },
    }),
  },
  voiceHoldZoneLight: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderColor: 'rgba(0,212,170,0.28)',
    ...Platform.select({
      ios: {
        shadowColor: 'rgba(15,23,42,0.08)',
        shadowOpacity: 0.1,
      },
      android: { elevation: 2 },
    }),
  },
  voiceHoldZoneListening: {
    borderColor: 'rgba(29, 78, 216, 0.72)',
  },
  voiceHoldZoneError: {
    borderColor: 'rgba(248, 113, 113, 0.4)',
    backgroundColor: 'rgba(48, 18, 24, 0.72)',
  },
  voiceHoldZoneErrorLight: {
    backgroundColor: 'rgba(254,242,242,0.96)',
    borderColor: 'rgba(248,113,113,0.35)',
  },
  voiceHoldZoneDisabled: {
    opacity: 0.42,
  },
  voiceHoldZonePressed: {
    opacity: 0.94,
    transform: [{ scale: 0.985 }],
  },
  voiceHoldInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 12,
  },
  voiceHoldIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(8, 18, 32, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.35)',
  },
  voiceHoldIconWrapLight: {
    backgroundColor: 'rgba(0,212,170,0.08)',
    borderColor: 'rgba(0,212,170,0.24)',
  },
  voiceHoldPulseRing: {
    position: 'absolute',
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 1.5,
    borderColor: 'rgba(34, 211, 238, 0.28)',
    backgroundColor: 'rgba(34, 211, 238, 0.16)',
  },
  voiceHoldTextCol: {
    flex: 1,
    minWidth: 0,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 0,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 140,
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.22)',
    borderRadius: 14,
    paddingHorizontal: Spacing.sm + 4,
    paddingVertical: Platform.OS === 'ios' ? 10 : 9,
    fontSize: 14,
    lineHeight: 19,
    color: '#F0F9FF',
    backgroundColor: 'rgba(8, 16, 28, 0.65)',
    marginRight: Spacing.sm,
    fontWeight: '500',
    letterSpacing: 0.04,
  },
  inputLight: {
    color: 'rgba(13,17,23,0.92)',
    backgroundColor: 'rgba(238,242,247,0.88)',
    borderColor: 'rgba(15,23,42,0.10)',
  },
  voiceStatusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  voiceStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 7,
    backgroundColor: '#2563EB',
    opacity: 0.72,
  },
  voiceStatusDotListening: {
    backgroundColor: '#1D4ED8',
    opacity: 1,
  },
  voiceStatusDotOnDark: {
    backgroundColor: '#FFFFFF',
    opacity: 0.95,
  },
  voiceStatusDotError: {
    backgroundColor: '#B91C1C',
    opacity: 1,
  },
  voiceStatusTitle: {
    fontFamily: DIGITAL_MONO,
    fontSize: 14,
    lineHeight: 19,
    color: '#BAE6FD',
    fontWeight: '800',
    letterSpacing: 0.04,
  },
  voiceStatusTitleLight: {
    color: 'rgba(15,23,42,0.92)',
  },
  voiceStatusTitleOnDark: {
    color: '#FFFFFF',
  },
  voiceStatusTitleError: {
    color: '#B91C1C',
  },
  voiceStatusBody: {
    fontFamily: DIGITAL_MONO,
    fontSize: 12,
    lineHeight: 16,
    color: 'rgba(186, 230, 253, 0.75)',
    fontWeight: '600',
    marginTop: 2,
  },
  voiceStatusBodyLight: {
    color: 'rgba(71,85,105,0.82)',
  },
  voiceStatusBodyOnDark: {
    color: 'rgba(255, 255, 255, 0.92)',
  },
  voiceStatusBodyError: {
    color: '#991B1B',
  },
  voiceWaveformRow: {
    height: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    marginBottom: 2,
  },
  voiceWaveformBar: {
    width: 4,
    height: 16,
    borderRadius: 3,
    backgroundColor: '#2563EB',
    opacity: 0.72,
  },
  voiceWaveformBarOnDark: {
    backgroundColor: '#FFFFFF',
    opacity: 0.88,
  },
  voiceWaveformBarTall: {
    height: 18,
    opacity: 0.86,
  },
  voicePartialText: {
    marginTop: 6,
    fontFamily: DIGITAL_MONO,
    fontSize: 11,
    lineHeight: 15,
    color: 'rgba(226, 242, 255, 0.86)',
    fontWeight: '700',
  },
  voicePartialTextOnDark: {
    color: 'rgba(255, 255, 255, 0.95)',
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
