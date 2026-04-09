import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Image,
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

const SHEET_RATIO = 0.7;
/** Sheet çok küçülmesin; klavye + liste çakışmasını önler */
const MIN_SHEET_HEIGHT = 300;
const BETA_HINT_KEY = 'leylek_zeka_beta_hint_dismissed_v1';
const LOGO = require('../assets/images/logo.png');

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
  return (
    <View style={[styles.bubbleWrap, isUser ? styles.bubbleWrapUser : styles.bubbleWrapAi]}>
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAi]}>
        <Text style={[styles.bubbleText, isUser ? styles.bubbleTextUser : styles.bubbleTextAi]}>
          {item.text}
        </Text>
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
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
      nestedScrollEnabled
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
            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
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
  const wasTypingRef = useRef(false);
  const listRef = useRef<FlatList<LeylekZekaMessage>>(null);
  const scrollRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sheetHeight = useMemo(() => {
    const h = Dimensions.get('window').height;
    const base = Math.round(h * SHEET_RATIO);
    if (Platform.OS === 'ios' || keyboardHeight <= 0) {
      return base;
    }
    const avail = h - keyboardHeight - 16;
    return Math.max(MIN_SHEET_HEIGHT, Math.min(base, avail));
  }, [keyboardHeight]);

  useEffect(() => {
    if (!visible) {
      setKeyboardHeight(0);
      return;
    }
    const showEv = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEv = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEv, (e) => {
      setKeyboardHeight(e.endCoordinates?.height ?? 0);
    });
    const hide = Keyboard.addListener(hideEv, () => setKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
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
    setShowBetaHint(false);
    void AsyncStorage.setItem(BETA_HINT_KEY, '1').catch(() => {});
  }, [lastReplySource]);

  const dismissBetaHint = useCallback(() => {
    setShowBetaHint(false);
    void AsyncStorage.setItem(BETA_HINT_KEY, '1').catch(() => {});
  }, []);

  const onSubmit = useCallback(() => {
    const t = input.trim();
    if (!t || isTyping) return;
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
    const id = setTimeout(() => setActiveChipLabel(null), 520);
    return () => clearTimeout(id);
  }, [isTyping, activeChipLabel]);

  const scrollToEndSafe = useCallback(() => {
    if (scrollRetryRef.current) {
      clearTimeout(scrollRetryRef.current);
      scrollRetryRef.current = null;
    }
    requestAnimationFrame(() => {
      try {
        const r = listRef.current;
        if (!r) return;
        r.scrollToEnd({ animated: true });
      } catch {
        /* FlatList henüz layout’ta değilse veya unmount race */
      }
    });
  }, []);

  useEffect(() => {
    if (!visible) {
      if (scrollRetryRef.current) {
        clearTimeout(scrollRetryRef.current);
        scrollRetryRef.current = null;
      }
      return;
    }
    scrollRetryRef.current = setTimeout(() => {
      scrollRetryRef.current = null;
      scrollToEndSafe();
    }, 96);
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
      animationType="slide"
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
          <View style={[styles.sheet, { height: sheetHeight }]}>
            <View style={styles.sheetInner}>
          <View style={styles.handle} />

          <LinearGradient
            colors={['#E8F4FD', '#F0F4F8', '#FFFFFF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerBar}
          >
            <View style={styles.headerTitleRow}>
              <View style={styles.headerIconWrap}>
                <Image source={LOGO} style={styles.headerLogo} resizeMode="contain" />
              </View>
              <View style={styles.headerTextCol}>
                <Text style={styles.title}>Leylek Zeka</Text>
                <Text style={styles.headerSubtitle}>Uygulama içi yardım asistanı</Text>
                {modeCaption ? <Text style={styles.modeCaptionInline}>{modeCaption}</Text> : null}
              </View>
            </View>
            <Pressable onPress={onClose} hitSlop={14} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={Colors.gray600} />
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

          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            style={styles.list}
            contentContainerStyle={[
              styles.listContent,
              messages.length === 0 ? styles.listContentEmpty : null,
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={<EmptyWelcome />}
            ListFooterComponent={
              isTyping ? (
                <View style={styles.typingBubble}>
                  <TypingBars />
                </View>
              ) : null
            }
          />

          <View
            style={[
              styles.composerBar,
              { paddingBottom: Math.max(insets.bottom, Spacing.md) },
            ]}
          >
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="Mesajınızı yazın…"
                placeholderTextColor={Colors.gray400}
                value={input}
                onChangeText={setInput}
                editable={!isTyping}
                multiline
                maxLength={2000}
                onSubmitEditing={onSubmit}
                returnKeyType="send"
                accessibilityLabel="Mesaj metni"
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
                  styles.sendBtn,
                  (!input.trim() || isTyping) && styles.sendBtnDisabled,
                  pressed && input.trim() && !isTyping && styles.sendBtnPressed,
                ]}
                disabled={!input.trim() || isTyping}
              >
                {isTyping ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Ionicons name="arrow-forward" size={22} color="#fff" />
                )}
              </Pressable>
            </View>
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
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.42)',
  },
  kavRoot: {
    flex: 1,
    width: '100%',
    maxWidth: '100%',
    justifyContent: 'flex-end',
  },
  sheet: {
    width: '100%',
    backgroundColor: Colors.background,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    overflow: 'hidden',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(63, 169, 245, 0.18)',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: -8 },
        shadowOpacity: 0.12,
        shadowRadius: 24,
      },
      android: { elevation: 18 },
    }),
  },
  sheetInner: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xs,
    paddingBottom: 0,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.gray200,
    marginBottom: Spacing.sm,
    marginTop: Spacing.xs,
  },
  headerBar: {
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(63, 169, 245, 0.2)',
    position: 'relative',
    ...Platform.select({
      ios: {
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 40,
  },
  headerIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(63, 169, 245, 0.25)',
  },
  headerLogo: {
    width: 28,
    height: 28,
  },
  headerTextCol: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.gray500,
    marginTop: 3,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  modeCaptionInline: {
    fontSize: FontSize.xs,
    color: Colors.gray500,
    marginTop: 4,
  },
  closeBtn: {
    position: 'absolute',
    right: Spacing.sm,
    top: Spacing.md,
    padding: Spacing.xs,
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
    paddingBottom: Spacing.xs,
  },
  chipsSectionActive: {
    marginHorizontal: -Spacing.xs,
    paddingHorizontal: Spacing.xs,
    paddingTop: Spacing.xs,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(232, 244, 253, 0.55)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(63, 169, 245, 0.22)',
  },
  chipsLabel: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.gray500,
    marginBottom: Spacing.xs,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  list: { flex: 1, minHeight: 120 },
  listContent: { paddingVertical: Spacing.xs, paddingBottom: Spacing.sm },
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
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(63, 169, 245, 0.22)',
  },
  emptyLogo: {
    width: 32,
    height: 32,
  },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: -0.2,
  },
  emptyBody: {
    marginTop: Spacing.sm,
    textAlign: 'center',
    lineHeight: 22,
    color: Colors.gray600,
    fontSize: FontSize.sm,
  },
  bubbleWrap: { marginBottom: Spacing.sm, maxWidth: '88%' },
  bubbleWrapUser: { alignSelf: 'flex-end' },
  bubbleWrapAi: { alignSelf: 'flex-start' },
  bubble: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
  },
  bubbleUser: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: BorderRadius.sm,
    ...Platform.select({
      ios: {
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
      },
      android: { elevation: 3 },
    }),
  },
  bubbleAi: {
    backgroundColor: Colors.gray50,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderBottomLeftRadius: BorderRadius.sm,
  },
  bubbleText: { fontSize: FontSize.md, lineHeight: 22 },
  bubbleTextUser: { color: '#fff' },
  bubbleTextAi: { color: Colors.text },
  typingBubble: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.gray50,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(63, 169, 245, 0.15)',
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
    paddingVertical: 6,
    paddingRight: Spacing.xs,
  },
  chip: {
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(63, 169, 245, 0.38)',
    marginRight: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 3,
      },
      android: { elevation: 1 },
    }),
  },
  chipPressed: {
    backgroundColor: '#E8F4FD',
    borderColor: 'rgba(63, 169, 245, 0.55)',
    transform: [{ scale: 0.98 }],
  },
  chipSelected: {
    backgroundColor: '#E8F4FD',
    borderColor: Colors.primary,
    borderWidth: 1.5,
    ...Platform.select({
      ios: {
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 4,
      },
      android: { elevation: 2 },
    }),
  },
  chipDisabled: {
    opacity: 0.45,
  },
  chipText: {
    fontSize: FontSize.sm,
    color: Colors.gray700,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: Colors.primary,
  },
  composerBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(63, 169, 245, 0.22)',
    backgroundColor: '#EDF5FC',
    marginHorizontal: -Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 3 },
    }),
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingBottom: 2,
  },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(63, 169, 245, 0.38)',
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 14 : Spacing.sm,
    fontSize: FontSize.md,
    color: Colors.text,
    backgroundColor: '#FFFFFF',
    marginRight: Spacing.sm,
  },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.35)',
    ...Platform.select({
      ios: {
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
      },
      android: { elevation: 4 },
    }),
  },
  sendBtnPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.96 }],
  },
  sendBtnDisabled: { opacity: 0.45 },
});
