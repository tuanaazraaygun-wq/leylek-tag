/**
 * ChatBubble.tsx — REST-first matched trip chat; Supabase Broadcast optional accelerator.
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  Animated,
  Dimensions,
  Platform,
  Keyboard,
  Vibration,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Audio } from 'expo-av';
import { API_BASE_URL } from '../lib/backendConfig';
import { getSupabase } from '../lib/supabase';
import { BOARDING_COMMS_CLOSED_USER_MSG, BOARDING_COMM_CLOSED_CODE } from '../lib/boardingCommsClosed';
import { useTheme } from '../hooks/useTheme';
import { lightThemeEnabled } from '../lib/featureFlags';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const MERGE_TS_WINDOW_MS = 5000;
const ANDROID_KEYBOARD_HIDE_DEBOUNCE_MS = 180;
/** REST poll while chat sheet open (ms) */
const CHAT_REST_POLL_MS = 4000;

interface Message {
  id: string;
  text: string;
  sender: 'me' | 'other';
  timestamp: Date;
  senderName?: string;
}

interface ChatBubbleProps {
  visible: boolean;
  onClose: () => void;
  isDriver: boolean;
  otherUserName: string;
  /** Eşleşme sırasında gösterilecek kendi adınız (yalnızca ilk isim kullanılır) */
  currentUserName?: string;
  userId: string;
  otherUserId: string;
  tagId: string;
  onSendMessage?: (text: string, receiverId: string) => void;
  incomingMessage?: { text: string; senderId: string; timestamp: number } | null;
  /** Parent incomingMessage state temizliği (duplicate inject önleme) */
  onIncomingMessageHandled?: () => void;
  /** Biniş doğrulandı — yeni mesaj gönderimi kapalı (yayın + REST) */
  tripCommsLocked?: boolean;
}

type ApiChatRow = {
  id?: string;
  message?: string;
  sender_id?: string;
  created_at?: string;
};

function isDuplicateMessage(existing: Message, candidate: Message): boolean {
  if (existing.id && candidate.id && existing.id === candidate.id) return true;
  if (
    existing.text.trim() === candidate.text.trim() &&
    existing.sender === candidate.sender &&
    Math.abs(existing.timestamp.getTime() - candidate.timestamp.getTime()) < MERGE_TS_WINDOW_MS
  ) {
    return true;
  }
  return false;
}

function mergeMessages(prev: Message[], incoming: Message[]): Message[] {
  const next = [...prev];
  for (const cand of incoming) {
    if (next.some((m) => isDuplicateMessage(m, cand))) continue;
    next.push(cand);
  }
  next.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  return next;
}

function apiRowToMessage(row: ApiChatRow, selfUserId: string, otherLabel: string): Message | null {
  const text = String(row.message || '').trim();
  if (!text) return null;
  const sid = String(row.sender_id || '').trim().toLowerCase();
  const self = String(selfUserId || '').trim().toLowerCase();
  const tsRaw = row.created_at ? new Date(row.created_at) : new Date();
  const timestamp = Number.isNaN(tsRaw.getTime()) ? new Date() : tsRaw;
  return {
    id: String(row.id || `db-${sid}-${timestamp.getTime()}`),
    text,
    sender: sid === self ? 'me' : 'other',
    timestamp,
    senderName: sid === self ? undefined : otherLabel,
  };
}

function firstNameOnly(full: string | undefined, fallback: string): string {
  const t = (full || '').trim();
  if (!t) return fallback;
  return t.split(/\s+/)[0];
}

// Öneri mesajları
const PASSENGER_SUGGESTIONS = [
  "Ne zamana gelirsiniz?",
  "Bekliyorum",
  "Neredesiniz?",
  "Geldiniz mi?",
];

const DRIVER_SUGGESTIONS = [
  "2 dk geliyorum",
  "Yoldayım",
  "Birazdan oradayım",
  "Trafikte kaldım",
  "Geldim, bekliyorum",
];

// 🆕 Küfür filtresi - Türkçe yasaklı kelimeler
const BANNED_WORDS = [
  'amk', 'aq', 'oç', 'orospu', 'piç', 'sik', 'yarrak', 'göt', 'meme',
  'sikerim', 'sikeyim', 'sikim', 'amına', 'ananı', 'anasını', 'pezevenk',
  'kaltak', 'fahişe', 'ibne', 'puşt', 'mk', 'aw', 'sktr', 'sg',
  'fuck', 'shit', 'bitch', 'asshole', 'dick'
];

// Küfür kontrolü
const containsBannedWord = (text: string): boolean => {
  const lowerText = text.toLowerCase().replace(/[^a-zA-ZğüşöçıİĞÜŞÖÇ0-9\s]/g, '');
  return BANNED_WORDS.some(word => lowerText.includes(word));
};

export default function ChatBubble({
  visible,
  onClose,
  isDriver,
  otherUserName,
  currentUserName = '',
  userId,
  otherUserId,
  tagId,
  incomingMessage = null,
  onIncomingMessageHandled,
  tripCommsLocked = false,
}: ChatBubbleProps) {
  const otherFirst = useMemo(
    () => firstNameOnly(otherUserName, isDriver ? 'Yolcu' : 'Sürücü'),
    [otherUserName, isDriver],
  );
  const myFirst = useMemo(
    () => firstNameOnly(currentUserName, isDriver ? 'Sürücü' : 'Yolcu'),
    [currentUserName, isDriver],
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  /** REST history/send/poll succeeded at least once — release-safe fallback active */
  const [restFallbackActive, setRestFallbackActive] = useState(false);
  const [lastMessageTime, setLastMessageTime] = useState(0); // 🆕 Spam koruması
  const [spamWarning, setSpamWarning] = useState(''); // 🆕 Uyarı mesajı
  const [keyboardPad, setKeyboardPad] = useState(0);
  const insets = useSafeAreaInsets();
  const { isLight, tokens } = useTheme();
  const isChatLight = lightThemeEnabled && isLight;

  const chatLt = useMemo(() => {
    if (!isChatLight) return null;
    const t = tokens;
    return {
      backdrop: 'rgba(15,23,42,0.28)',
      sheetBorder: t.border.default,
      sheetShadow: t.shadow.modal,
      headerBg: t.bg.elevated,
      headerBorder: t.border.default,
      headerName: t.text.primary,
      headerIcon: t.accent.primary,
      headerBtn: t.text.muted,
      onlineConnected: t.accent.primary,
      onlinePending: t.text.muted,
      myBubbleBg: t.accent.primary,
      myBubbleBorder: t.accent.primaryHover,
      myLabel: 'rgba(255,255,255,0.92)',
      myText: t.text.inverse,
      myTime: 'rgba(255,255,255,0.78)',
      otherBubbleBg: t.bg.canvasMid,
      otherBubbleBorder: t.border.card,
      otherLabel: t.accent.secondary,
      otherText: t.text.primary,
      otherTime: t.text.muted,
      emptyIcon: t.accent.primary,
      emptyTitle: t.text.primary,
      emptySub: t.text.muted,
      suggestionsBg: t.bg.elevated,
      suggestionsBorder: t.border.default,
      chipBg: t.bg.canvas,
      chipBorder: t.border.default,
      chipText: t.text.primary,
      composerBg: t.bg.elevated,
      composerBorder: t.border.default,
      inputBg: t.bg.canvas,
      inputBorder: t.border.default,
      inputText: t.text.primary,
      placeholder: t.text.muted,
      sendBg: t.accent.primary,
      sendBorder: t.accent.primaryHover,
      sendIcon: t.text.inverse,
      sendDisabledBg: t.bg.canvasMid,
      sendDisabledIcon: t.text.muted,
      warningBg: 'rgba(220,38,38,0.08)',
      warningBorder: 'rgba(220,38,38,0.22)',
      warningText: t.status.error,
      minimizedBg: t.accent.primary,
      minimizedIcon: t.text.inverse,
    };
  }, [isChatLight, tokens]);

  const sheetHeight = useMemo(() => {
    const base = SCREEN_HEIGHT * 0.6;
    if (keyboardPad <= 0) return base;
    const aboveKeyboard = SCREEN_HEIGHT - keyboardPad - 8;
    return Math.min(base, Math.max(aboveKeyboard, SCREEN_HEIGHT * 0.38));
  }, [keyboardPad]);

  const composerBottomPad =
    keyboardPad > 0
      ? Platform.OS === 'ios'
        ? 10
        : 8
      : Math.max(insets.bottom, Platform.OS === 'ios' ? 16 : 12);

  const scaleAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const flatListRef = useRef<FlatList>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const keyboardHideDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastIncomingKeyRef = useRef<string | null>(null);
  const historyFetchTagRef = useRef<string | null>(null);

  const scrollToBottom = useCallback((animated = true) => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated });
    }, 100);
  }, []);

  const visibleRef = useRef(visible);
  const isMinimizedRef = useRef(isMinimized);
  const otherFirstRef = useRef(otherFirst);
  const userIdRef = useRef(userId);
  const scrollToBottomRef = useRef(scrollToBottom);

  useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);

  useEffect(() => {
    isMinimizedRef.current = isMinimized;
  }, [isMinimized]);

  useEffect(() => {
    otherFirstRef.current = otherFirst;
  }, [otherFirst]);

  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  useEffect(() => {
    scrollToBottomRef.current = scrollToBottom;
  }, [scrollToBottom]);

  const suggestions = isDriver ? DRIVER_SUGGESTIONS : PASSENGER_SUGGESTIONS;

  const fetchMessagesFromRest = useCallback(async (): Promise<{
    ok: boolean;
    rows: ApiChatRow[];
  }> => {
    if (!tagId) return { ok: false, rows: [] };
    try {
      const res = await fetch(
        `${API_BASE_URL}/chat/messages?tag_id=${encodeURIComponent(tagId)}&limit=50`,
      );
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        messages?: ApiChatRow[];
      };
      if (Array.isArray(json.messages)) {
        return { ok: true, rows: json.messages };
      }
      return { ok: res.ok, rows: [] };
    } catch {
      return { ok: false, rows: [] };
    }
  }, [tagId]);

  const applyRestRows = useCallback(
    (rows: ApiChatRow[], scroll = false): number => {
      const hydrated = rows
        .map((row) => apiRowToMessage(row, userId, otherFirst))
        .filter((m): m is Message => m != null);
      if (hydrated.length === 0) return 0;
      let added = 0;
      setMessages((prev) => {
        const before = prev.length;
        const next = mergeMessages(prev, hydrated);
        added = next.length - before;
        return next;
      });
      if (scroll && added > 0) scrollToBottom(false);
      return added;
    },
    [userId, otherFirst, scrollToBottom],
  );

  const headerStatusText = useMemo(() => {
    if (isConnected) return 'Bağlı';
    if (restFallbackActive) return 'Canlı değil · mesajlar yenileniyor';
    return 'Bağlanıyor...';
  }, [isConnected, restFallbackActive]);

  // ═══════════════════════════════════════════════════════════════
  // SUPABASE REALTIME BROADCAST (optional — REST remains source of truth)
  // ═══════════════════════════════════════════════════════════════

  useEffect(() => {
    if (!tagId || !userId) return;

    const supabase = getSupabase();
    if (!supabase) {
      console.warn('[ChatBubble] Supabase yapılandırması eksik; anlık sohbet kanalı bağlanmadı');
      setIsConnected(false);
      return;
    }

    console.log('[ChatBubble] realtime status', { phase: 'starting', tagId, userId });

    const channel = supabase.channel(`chat-broadcast-${tagId}`, {
      config: {
        broadcast: {
          self: false,
        },
      },
    });

    channel
      .on('broadcast', { event: 'new-message' }, (payload) => {
        const msg = payload.payload;
        if (msg.senderId === userIdRef.current) return;

        const newMessage: Message = {
          id: `msg-${Date.now()}-${Math.random()}`,
          text: msg.text,
          sender: 'other',
          timestamp: new Date(msg.timestamp),
          senderName: firstNameOnly(msg.senderName, otherFirstRef.current),
        };

        setMessages((prev) => mergeMessages(prev, [newMessage]));
        Vibration.vibrate(200);

        if (!visibleRef.current || isMinimizedRef.current) {
          setUnreadCount((prev) => prev + 1);
        } else {
          scrollToBottomRef.current(true);
        }
      })
      .subscribe((status, err) => {
        console.log('[ChatBubble] realtime status', { status, error: err?.message ?? null });
        setIsConnected(status === 'SUBSCRIBED');
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        getSupabase()?.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setIsConnected(false);
    };
  }, [tagId, userId]);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const subShow = Keyboard.addListener(showEvt, (e) => {
      if (keyboardHideDebounceRef.current) {
        clearTimeout(keyboardHideDebounceRef.current);
        keyboardHideDebounceRef.current = null;
      }
      const h = e.endCoordinates?.height ?? 0;
      setKeyboardPad(h > 0 ? h : 0);
    });
    const subHide = Keyboard.addListener(hideEvt, () => {
      if (Platform.OS === 'ios') {
        setKeyboardPad(0);
        return;
      }
      if (keyboardHideDebounceRef.current) {
        clearTimeout(keyboardHideDebounceRef.current);
      }
      keyboardHideDebounceRef.current = setTimeout(() => {
        keyboardHideDebounceRef.current = null;
        setKeyboardPad(0);
      }, ANDROID_KEYBOARD_HIDE_DEBOUNCE_MS);
    });
    return () => {
      subShow.remove();
      subHide.remove();
      if (keyboardHideDebounceRef.current) {
        clearTimeout(keyboardHideDebounceRef.current);
        keyboardHideDebounceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (keyboardPad <= 0) return;
    scrollToBottom(true);
  }, [keyboardPad, scrollToBottom]);

  useEffect(() => {
    if (visible && !isMinimized) {
      scrollToBottom(false);
    }
  }, [visible, isMinimized, scrollToBottom]);

  useEffect(() => {
    if (!visible) {
      setIsMinimized(false);
      setUnreadCount(0);
      historyFetchTagRef.current = null;
    }
  }, [visible]);

  useEffect(() => {
    setMessages([]);
    setInputText('');
    setIsMinimized(false);
    setUnreadCount(0);
    setSpamWarning('');
    setRestFallbackActive(false);
    lastIncomingKeyRef.current = null;
    historyFetchTagRef.current = null;
  }, [tagId]);

  useEffect(() => {
    if (!visible || !tagId) return;
    const fetchKey = `${tagId}`;
    if (historyFetchTagRef.current === fetchKey) return;
    historyFetchTagRef.current = fetchKey;

    let cancelled = false;
    void (async () => {
      const { ok, rows } = await fetchMessagesFromRest();
      if (cancelled) return;
      if (ok) setRestFallbackActive(true);
      const added = applyRestRows(rows, true);
      if (ok) {
        console.log('[ChatBubble] polling sync count', { source: 'history', added, total: rows.length });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visible, tagId, fetchMessagesFromRest, applyRestRows]);

  useEffect(() => {
    if (!visible || isMinimized || !tagId) return;

    let cancelled = false;
    const tick = async () => {
      const { ok, rows } = await fetchMessagesFromRest();
      if (cancelled || !ok) return;
      setRestFallbackActive(true);
      const added = applyRestRows(rows, true);
      console.log('[ChatBubble] polling sync count', {
        source: 'poll',
        added,
        fetched: rows.length,
      });
    };

    const intervalId = setInterval(() => {
      void tick();
    }, CHAT_REST_POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [visible, isMinimized, tagId, fetchMessagesFromRest, applyRestRows]);

  useEffect(() => {
    const text = String(incomingMessage?.text || '').trim();
    if (!text) return;

    const incKey = `${incomingMessage?.senderId || ''}|${incomingMessage?.timestamp || 0}|${text}`;
    if (lastIncomingKeyRef.current === incKey) return;
    lastIncomingKeyRef.current = incKey;

    const sid = String(incomingMessage?.senderId || '').trim().toLowerCase();
    const self = String(userId || '').trim().toLowerCase();
    if (sid && sid === self) {
      onIncomingMessageHandled?.();
      return;
    }

    const msg: Message = {
      id: `incoming-${incomingMessage?.timestamp || Date.now()}`,
      text,
      sender: 'other',
      timestamp: new Date(incomingMessage?.timestamp || Date.now()),
      senderName: otherFirst,
    };

    setMessages((prev) => mergeMessages(prev, [msg]));

    if (!visible || isMinimized) {
      setUnreadCount((prev) => prev + 1);
    } else {
      scrollToBottom(true);
    }

    onIncomingMessageHandled?.();
  }, [
    incomingMessage,
    userId,
    otherFirst,
    visible,
    isMinimized,
    onIncomingMessageHandled,
    scrollToBottom,
  ]);

  // ═══════════════════════════════════════════════════════════════
  // MESAJ GÖNDER — REST source of truth; broadcast best-effort
  // ═══════════════════════════════════════════════════════════════

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim()) return;

      if (tripCommsLocked) {
        setSpamWarning(BOARDING_COMMS_CLOSED_USER_MSG);
        setTimeout(() => setSpamWarning(''), 5000);
        return;
      }

      if (!tagId || !userId || !otherUserId) {
        console.warn('[ChatBubble] rest send fail', { reason: 'missing_ids', tagId, userId, otherUserId });
        return;
      }

      const trimmedText = text.trim();
      const now = Date.now();

      if (now - lastMessageTime < 2000) {
        setSpamWarning('⏳ Çok hızlı! 2 saniye bekleyin.');
        setTimeout(() => setSpamWarning(''), 2000);
        return;
      }

      if (containsBannedWord(trimmedText)) {
        setSpamWarning('⚠️ Uygunsuz içerik tespit edildi!');
        setTimeout(() => setSpamWarning(''), 3000);
        return;
      }

      setLastMessageTime(now);
      setSpamWarning('');

      const newMessage: Message = {
        id: `msg-${Date.now()}-${Math.random()}`,
        text: trimmedText,
        sender: 'me',
        timestamp: new Date(),
        senderName: myFirst,
      };
      setMessages((prev) => mergeMessages(prev, [newMessage]));
      setInputText('');
      scrollToBottom(true);

      try {
        const res = await fetch(`${API_BASE_URL}/chat/send-message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tag_id: tagId,
            sender_id: userId,
            receiver_id: otherUserId,
            message: trimmedText,
            sender_name: myFirst,
          }),
        });
        const j = (await res.json().catch(() => ({}))) as {
          success?: boolean;
          detail?: string;
          error?: string;
        };
        if (res.ok && j.success !== false) {
          setRestFallbackActive(true);
          console.log('[ChatBubble] rest send ok', { tagId, userId });
          const ch = channelRef.current;
          if (ch) {
            try {
              await ch.send({
                type: 'broadcast',
                event: 'new-message',
                payload: {
                  text: trimmedText,
                  senderId: userId,
                  senderName: myFirst,
                  receiverId: otherUserId,
                  timestamp: new Date().toISOString(),
                },
              });
            } catch (error) {
              console.warn('[ChatBubble] realtime status', {
                phase: 'broadcast_send_failed',
                error: error instanceof Error ? error.message : String(error),
              });
            }
          }
        } else {
          const d = String(j.detail ?? j.error ?? '');
          console.warn('[ChatBubble] rest send fail', { tagId, status: res.status, detail: d });
          if (d === BOARDING_COMM_CLOSED_CODE) {
            setMessages((prev) => prev.filter((m) => m.id !== newMessage.id));
            setSpamWarning(BOARDING_COMMS_CLOSED_USER_MSG);
            setTimeout(() => setSpamWarning(''), 5000);
          }
        }
      } catch (e) {
        console.warn('[ChatBubble] rest send fail', {
          tagId,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    },
    [tagId, userId, otherUserId, lastMessageTime, myFirst, tripCommsLocked, scrollToBottom],
  );

  // ═══════════════════════════════════════════════════════════════
  // ANİMASYONLAR
  // ═══════════════════════════════════════════════════════════════
  
  useEffect(() => {
    if (visible) {
      if (isMinimized) {
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }).start();
      } else {
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }
    } else {
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 200,
        useNativeDriver: true,
      }).start();
      scaleAnim.setValue(0);
    }
  }, [visible, isMinimized]);

  // Minimize/Maximize toggle
  const toggleMinimize = () => {
    if (isMinimized) {
      setIsMinimized(false);
      setUnreadCount(0);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      setIsMinimized(true);
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }).start();
      });
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════
  
  if (!visible) return null;

  // Minimized bubble
  if (isMinimized) {
    return (
      <Animated.View
        style={[
          styles.minimizedBubble,
          isChatLight &&
            chatLt && {
              backgroundColor: chatLt.minimizedBg,
              borderColor: chatLt.sendBorder,
              shadowColor: tokens.shadow.ambient,
            },
          { transform: [{ scale: scaleAnim }] },
        ]}
      >
        <TouchableOpacity
          style={styles.minimizedContent}
          onPress={toggleMinimize}
          activeOpacity={0.8}
        >
          <Ionicons
            name="chatbubble-ellipses"
            size={24}
            color={isChatLight && chatLt ? chatLt.minimizedIcon : '#08111F'}
          />
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  }

  // Tam panel — Modal + backdrop (dışarı dokununca kapanır; eşleşme bitince parent visible=false)
  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.modalRoot}>
        <Pressable
          style={[styles.sheetBackdrop, isChatLight && chatLt && { backgroundColor: chatLt.backdrop }]}
          onPress={onClose}
          accessibilityLabel="Sohbeti kapat"
        />
        <Animated.View
          style={[
            styles.container,
            {
              transform: [{ translateY: slideAnim }],
              marginBottom: keyboardPad,
              height: sheetHeight,
              maxHeight: sheetHeight,
            },
            isChatLight &&
              chatLt && {
                backgroundColor: chatLt.headerBg,
                borderColor: chatLt.sheetBorder,
                shadowColor: chatLt.sheetShadow,
              },
          ]}
        >
          {!isChatLight ? (
            <>
              <LinearGradient
                colors={['#101A2B', '#0B1220', '#08111F']}
                locations={[0, 0.52, 1]}
                pointerEvents="none"
                style={styles.sheetGlassFill}
              />
              <LinearGradient
                colors={['transparent', 'rgba(34,211,238,0.06)', 'transparent']}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 1, y: 1 }}
                pointerEvents="none"
                style={styles.sheetEdgeLight}
              />
            </>
          ) : null}
          <View style={styles.keyboardView}>
            {/* Header */}
            <View
              style={[
                styles.header,
                isChatLight &&
                  chatLt && {
                    backgroundColor: chatLt.headerBg,
                    borderBottomColor: chatLt.headerBorder,
                  },
              ]}
            >
              <View style={styles.headerLeft}>
                <Ionicons
                  name="person-circle"
                  size={32}
                  color={isChatLight && chatLt ? chatLt.headerIcon : '#22D3EE'}
                />
                <View style={styles.headerInfo}>
                  <Text
                    style={[
                      styles.headerName,
                      isChatLight && chatLt && { color: chatLt.headerName },
                    ]}
                  >
                    {otherFirst}
                  </Text>
                  <View style={styles.onlineStatus}>
                    <View
                      style={[
                        styles.onlineDot,
                        {
                          backgroundColor: isConnected
                            ? isChatLight && chatLt
                              ? chatLt.onlineConnected
                              : '#22D3EE'
                            : isChatLight && chatLt
                              ? chatLt.onlinePending
                              : 'rgba(186,201,222,0.45)',
                        },
                      ]}
                    />
                    <Text
                      style={[
                        styles.onlineText,
                        {
                          color: isConnected
                            ? isChatLight && chatLt
                              ? chatLt.onlineConnected
                              : '#22D3EE'
                            : isChatLight && chatLt
                              ? chatLt.onlinePending
                              : 'rgba(186,201,222,0.75)',
                        },
                      ]}
                    >
                      {headerStatusText}
                    </Text>
                  </View>
                </View>
              </View>
              <View style={styles.headerButtons}>
                <TouchableOpacity onPress={toggleMinimize} style={styles.headerBtn}>
                  <Ionicons
                    name="remove"
                    size={24}
                    color={isChatLight && chatLt ? chatLt.headerBtn : 'rgba(186,201,222,0.82)'}
                  />
                </TouchableOpacity>
                <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
                  <Ionicons
                    name="close"
                    size={24}
                    color={isChatLight && chatLt ? chatLt.headerBtn : 'rgba(186,201,222,0.82)'}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Messages */}
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item.id}
              style={styles.messageList}
              contentContainerStyle={styles.messageListContent}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              onContentSizeChange={() => scrollToBottom(false)}
              renderItem={({ item }) => {
                const isMe = item.sender === 'me';
                return (
                  <View
                    style={[
                      styles.messageBubble,
                      isMe ? styles.myMessage : styles.otherMessage,
                      isChatLight &&
                        chatLt &&
                        (isMe
                          ? {
                              backgroundColor: chatLt.myBubbleBg,
                              borderColor: chatLt.myBubbleBorder,
                              shadowColor: chatLt.sheetShadow,
                            }
                          : {
                              backgroundColor: chatLt.otherBubbleBg,
                              borderColor: chatLt.otherBubbleBorder,
                              shadowColor: chatLt.sheetShadow,
                            }),
                    ]}
                  >
                    <Text
                      style={[
                        styles.senderLabel,
                        isMe ? styles.mySenderLabel : styles.otherSenderLabel,
                        isChatLight &&
                          chatLt &&
                          (isMe ? { color: chatLt.myLabel } : { color: chatLt.otherLabel }),
                      ]}
                    >
                      {isMe ? myFirst : firstNameOnly(item.senderName, otherFirst)}
                    </Text>
                    <Text
                      style={[
                        styles.messageText,
                        isMe ? styles.myMessageText : styles.otherMessageText,
                        isChatLight &&
                          chatLt &&
                          (isMe ? { color: chatLt.myText } : { color: chatLt.otherText }),
                      ]}
                    >
                      {item.text}
                    </Text>
                    <Text
                      style={[
                        styles.messageTime,
                        isMe ? styles.myMessageTime : styles.otherMessageTime,
                        isChatLight &&
                          chatLt &&
                          (isMe ? { color: chatLt.myTime } : { color: chatLt.otherTime }),
                      ]}
                    >
                      {item.timestamp.toLocaleTimeString('tr-TR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons
                    name="chatbubbles-outline"
                    size={48}
                    color={isChatLight && chatLt ? chatLt.emptyIcon : 'rgba(34,211,238,0.42)'}
                  />
                  <Text
                    style={[
                      styles.emptyText,
                      isChatLight && chatLt && { color: chatLt.emptyTitle },
                    ]}
                  >
                    Henüz mesaj yok
                  </Text>
                  <Text
                    style={[
                      styles.emptySubtext,
                      isChatLight && chatLt && { color: chatLt.emptySub },
                    ]}
                  >
                    Bir mesaj göndererek sohbeti başlatın
                  </Text>
                </View>
              }
            />

            {/* Quick suggestions */}
            <View
              style={[
                styles.suggestionsContainer,
                isChatLight &&
                  chatLt && {
                    backgroundColor: chatLt.suggestionsBg,
                    borderTopColor: chatLt.suggestionsBorder,
                  },
              ]}
            >
              <FlatList
                horizontal
                data={suggestions}
                keyExtractor={(item) => item}
                showsHorizontalScrollIndicator={false}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.suggestionChip,
                      tripCommsLocked && { opacity: 0.45 },
                      isChatLight &&
                        chatLt && {
                          backgroundColor: chatLt.chipBg,
                          borderColor: chatLt.chipBorder,
                        },
                    ]}
                    onPress={() => sendMessage(item)}
                    disabled={tripCommsLocked}
                  >
                    <Text
                      style={[
                        styles.suggestionText,
                        isChatLight && chatLt && { color: chatLt.chipText },
                      ]}
                    >
                      {item}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            </View>

            {spamWarning ? (
              <View
                style={[
                  styles.warningContainer,
                  isChatLight &&
                    chatLt && {
                      backgroundColor: chatLt.warningBg,
                      borderColor: chatLt.warningBorder,
                    },
                ]}
              >
                <Text
                  style={[
                    styles.warningText,
                    isChatLight && chatLt && { color: chatLt.warningText },
                  ]}
                >
                  {spamWarning}
                </Text>
              </View>
            ) : null}

            <View
              style={[
                styles.inputContainer,
                { paddingBottom: composerBottomPad },
                isChatLight &&
                  chatLt && {
                    backgroundColor: chatLt.composerBg,
                    borderTopColor: chatLt.composerBorder,
                  },
              ]}
            >
              <TextInput
                style={[
                  styles.input,
                  isChatLight &&
                    chatLt && {
                      backgroundColor: chatLt.inputBg,
                      borderColor: chatLt.inputBorder,
                      color: chatLt.inputText,
                    },
                ]}
                placeholder="Mesajınızı yazın..."
                placeholderTextColor={
                  isChatLight && chatLt ? chatLt.placeholder : 'rgba(186,201,222,0.55)'
                }
                value={inputText}
                onChangeText={setInputText}
                multiline
                maxLength={500}
                editable={!tripCommsLocked}
                textAlignVertical="center"
              />
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  (!inputText.trim() || tripCommsLocked) && styles.sendButtonDisabled,
                  isChatLight &&
                    chatLt &&
                    (inputText.trim() && !tripCommsLocked
                      ? {
                          backgroundColor: chatLt.sendBg,
                          borderColor: chatLt.sendBorder,
                        }
                      : {
                          backgroundColor: chatLt.sendDisabledBg,
                          borderColor: chatLt.inputBorder,
                          shadowOpacity: 0,
                          elevation: 0,
                        }),
                ]}
                onPress={() => sendMessage(inputText)}
                disabled={!inputText.trim() || tripCommsLocked}
              >
                <Ionicons
                  name="send"
                  size={20}
                  color={
                    !inputText.trim() || tripCommsLocked
                      ? isChatLight && chatLt
                        ? chatLt.sendDisabledIcon
                        : 'rgba(186,201,222,0.42)'
                      : isChatLight && chatLt
                        ? chatLt.sendIcon
                        : '#08111F'
                  }
                />
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8,17,31,0.68)',
  },
  sheetGlassFill: {
    ...StyleSheet.absoluteFillObject,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  sheetEdgeLight: {
    ...StyleSheet.absoluteFillObject,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  container: {
    width: '100%',
    maxHeight: SCREEN_HEIGHT * 0.6,
    height: SCREEN_HEIGHT * 0.6,
    backgroundColor: 'transparent',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    borderColor: '#1E3A5F',
    shadowColor: '#22D3EE',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 12,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth + 1,
    borderBottomColor: 'rgba(30,58,95,0.65)',
    backgroundColor: 'rgba(8,17,31,0.42)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerInfo: {
    marginLeft: 10,
  },
  headerName: {
    fontSize: 16,
    fontWeight: '700',
    color: 'rgba(243,248,255,0.94)',
    letterSpacing: 0.2,
  },
  onlineStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
  },
  onlineText: {
    fontSize: 12,
    fontWeight: '600',
  },
  headerButtons: {
    flexDirection: 'row',
  },
  headerBtn: {
    padding: 8,
    marginLeft: 8,
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    padding: 16,
    paddingBottom: 8,
  },
  senderLabel: {
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 4,
    letterSpacing: 0.2,
  },
  mySenderLabel: {
    color: 'rgba(241,249,255,0.88)',
  },
  otherSenderLabel: {
    color: 'rgba(34,211,238,0.88)',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth + 1,
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(14,165,233,0.92)',
    borderBottomRightRadius: 4,
    borderColor: 'rgba(34,211,238,0.45)',
    shadowColor: '#22D3EE',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(16,26,43,0.88)',
    borderBottomLeftRadius: 4,
    borderColor: 'rgba(30,58,95,0.92)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  myMessageText: {
    color: 'rgba(243,248,255,0.96)',
    fontWeight: '500',
  },
  otherMessageText: {
    color: 'rgba(243,248,255,0.92)',
    fontWeight: '500',
  },
  messageTime: {
    fontSize: 10,
    marginTop: 4,
  },
  myMessageTime: {
    color: 'rgba(241,249,255,0.72)',
    textAlign: 'right',
  },
  otherMessageTime: {
    color: 'rgba(186,201,222,0.82)',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(243,248,255,0.88)',
    marginTop: 12,
    letterSpacing: 0.2,
  },
  emptySubtext: {
    fontSize: 13,
    color: 'rgba(186,201,222,0.78)',
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 28,
    lineHeight: 18,
  },
  suggestionsContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(30,58,95,0.55)',
    backgroundColor: 'rgba(8,17,31,0.28)',
  },
  suggestionChip: {
    backgroundColor: 'rgba(16,26,43,0.72)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(30,58,95,0.75)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  suggestionText: {
    fontSize: 13,
    color: 'rgba(243,248,255,0.9)',
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth + 1,
    borderTopColor: 'rgba(30,58,95,0.55)',
    backgroundColor: 'rgba(8,17,31,0.52)',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: 'rgba(16,26,43,0.68)',
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(30,58,95,0.65)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: 'rgba(243,248,255,0.94)',
    marginRight: 8,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#22D3EE',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(125,211,252,0.55)',
    shadowColor: '#22D3EE',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.36,
    shadowRadius: 8,
    elevation: 8,
  },
  sendButtonDisabled: {
    backgroundColor: 'rgba(26,38,61,0.85)',
    borderColor: '#1E3A5F',
    shadowOpacity: 0,
    elevation: 0,
  },
  // 🆕 Spam/Küfür Uyarı Stili
  warningContainer: {
    backgroundColor: 'rgba(127,29,29,0.22)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 12,
    marginBottom: 4,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth + 1,
    borderColor: 'rgba(248,113,113,0.4)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  warningText: {
    color: 'rgba(254,226,226,0.94)',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
  },
  minimizedBubble: {
    position: 'absolute',
    bottom: 100,
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(34,211,238,0.98)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(125,211,252,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#22D3EE',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 12,
  },
  minimizedContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
});
