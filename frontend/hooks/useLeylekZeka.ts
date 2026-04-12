import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useSegments } from 'expo-router';
import { useLeylekZekaChrome } from '../contexts/LeylekZekaChromeContext';
import { getLeylekZekaApproveLearningUrl, getLeylekZekaChatUrl } from '../lib/backendConfig';

export type LeylekZekaMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
};

export type LeylekZekaReplySource = 'openai' | 'fallback' | 'answer_engine' | 'kb';

export type LeylekZekaLearningCandidate = {
  question: string;
  answer: string;
};

const LEYLEK_ZEKA_FETCH_TIMEOUT_MS = 28_000;

async function readStoredAccessToken(): Promise<string | null> {
  try {
    const raw =
      (await AsyncStorage.getItem('user')) || (await AsyncStorage.getItem('leylek_user'));
    if (!raw) return null;
    const u = JSON.parse(raw) as { access_token?: string; accessToken?: string };
    const t = u.access_token ?? u.accessToken;
    return typeof t === 'string' && t.length > 8 ? t : null;
  } catch {
    return null;
  }
}

function normalizeReplySource(raw: string | undefined): LeylekZekaReplySource {
  if (raw === 'openai' || raw === 'answer_engine' || raw === 'fallback' || raw === 'kb') {
    return raw;
  }
  if (raw === 'claude') {
    return 'openai';
  }
  return 'fallback';
}

export const LEYLEK_ZEKA_QUICK_PROMPTS = [
  'Eşleşme nasıl çalışır?',
  'Teklif nasıl gönderilir?',
  'Motor mu araba mı?',
  'Güvenli mi?',
] as const;

type HistoryItem = { role: 'user' | 'assistant'; content: string };

type LeylekZekaApiJson = {
  ok?: boolean;
  reply?: string;
  source?: string;
  requires_approval?: boolean;
  learning_candidate?: { question?: string; answer?: string };
  message?: string;
  detail?: string | { detail?: string };
};

function buildHistory(prev: LeylekZekaMessage[]): HistoryItem[] {
  return prev.map((m) => ({ role: m.role, content: m.text }));
}

export function useLeylekZeka(options?: { isAdmin?: boolean }) {
  const segments = useSegments();
  const isAdminUser = options?.isAdmin === true || segments[0] === 'admin';
  const { homeFlowScreen, flowHint } = useLeylekZekaChrome();

  const leylekContext = useMemo(() => {
    const o: Record<string, string | boolean> = {};
    if (homeFlowScreen) o.screen = homeFlowScreen;
    if (flowHint) o.flowHint = flowHint;
    const pass = Boolean(flowHint?.startsWith('passenger'));
    const drv = Boolean(flowHint?.startsWith('driver'));
    if (pass) o.isPassenger = true;
    if (drv) o.isDriver = true;
    if (flowHint === 'passenger_matching' || flowHint === 'passenger_offer_waiting') {
      o.isWaitingMatch = true;
    }
    if (
      flowHint === 'passenger_offer_waiting' ||
      flowHint === 'driver_offer_list' ||
      flowHint === 'driver_offer_compose'
    ) {
      o.hasActiveOffer = true;
    }
    return Object.keys(o).length ? o : undefined;
  }, [homeFlowScreen, flowHint]);

  const [messages, setMessages] = useState<LeylekZekaMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastReplySource, setLastReplySource] = useState<LeylekZekaReplySource | null>(null);
  const [pendingLearning, setPendingLearning] = useState<LeylekZekaLearningCandidate | null>(null);
  const inFlightRef = useRef(false);
  const approveInFlightRef = useRef(false);

  const clearError = useCallback(() => setError(null), []);

  const cancelPendingLearning = useCallback(() => {
    setPendingLearning(null);
  }, []);

  const approvePendingLearning = useCallback(async () => {
    if (!pendingLearning || approveInFlightRef.current) return;
    const token = await readStoredAccessToken();
    if (!token) {
      setError('Oturum bulunamadı; tekrar giriş yapıp deneyin.');
      return;
    }
    approveInFlightRef.current = true;
    setIsTyping(true);
    setError(null);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), LEYLEK_ZEKA_FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(getLeylekZekaApproveLearningUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          question: pendingLearning.question,
          answer: pendingLearning.answer,
        }),
        signal: controller.signal,
      });
      const bodyText = await res.text();
      let data: LeylekZekaApiJson | null = null;
      try {
        data = bodyText ? (JSON.parse(bodyText) as LeylekZekaApiJson) : null;
      } catch {
        data = null;
      }
      if (!res.ok) {
        const detail = data?.detail;
        const msg =
          typeof detail === 'string'
            ? detail
            : typeof detail === 'object' && detail && 'detail' in detail
              ? String((detail as { detail?: string }).detail)
              : `Onay başarısız (${res.status}).`;
        setError(msg);
        return;
      }
      const ack =
        typeof data?.message === 'string' && data.message.trim()
          ? data.message.trim()
          : 'Bunu kayda geçirdim patron.';
      setPendingLearning(null);
      const assistantMsg: LeylekZekaMessage = {
        id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        role: 'assistant',
        text: ack,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'name' in e && (e as { name?: string }).name === 'AbortError') {
        setError('İstek zaman aşımına uğradı.');
      } else {
        setError('Onay isteği gönderilemedi.');
      }
    } finally {
      clearTimeout(timeoutId);
      setIsTyping(false);
      approveInFlightRef.current = false;
    }
  }, [pendingLearning]);

  const sendMessage = useCallback(
    async (raw: string) => {
      const text = isAdminUser && raw.trim() === '' ? '' : raw.trim();
      if ((!text && !isAdminUser) || inFlightRef.current) return;
      inFlightRef.current = true;
      setPendingLearning(null);

      const userMsg: LeylekZekaMessage = {
        id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        role: 'user',
        text: text || raw,
      };

      let historyPayload: HistoryItem[] = [];
      setMessages((prev) => {
        historyPayload = buildHistory(prev);
        return text ? [...prev, userMsg] : prev;
      });

      setError(null);
      setIsTyping(true);

      const chatUrl = getLeylekZekaChatUrl();
      const message = text;
      const history = historyPayload;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), LEYLEK_ZEKA_FETCH_TIMEOUT_MS);
      try {
        const payload: Record<string, unknown> = { message, history };
        if (leylekContext) payload.context = leylekContext;
        if (isAdminUser) payload.is_admin = true;

        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        const token = await readStoredAccessToken();
        if (token) headers.Authorization = `Bearer ${token}`;

        const res = await fetch(chatUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        const bodyText = await res.text();
        let data: LeylekZekaApiJson | null = null;
        try {
          data = bodyText ? (JSON.parse(bodyText) as LeylekZekaApiJson) : null;
        } catch {
          data = null;
        }

        if (__DEV__) {
          console.log('[LeylekZeka]', chatUrl, res.status, data ?? bodyText.slice(0, 400));
        }

        if (!res.ok) {
          if (res.status === 404) {
            setError(
              'Leylek Zeka servisi bulunamadı (404). Sunucu adresi veya endpoint (ör. /api/ai/leylekzeka) kontrol edilmeli.',
            );
            return;
          }
          const detail = data?.detail;
          const msg =
            typeof detail === 'string'
              ? detail
              : typeof detail === 'object' && detail && 'detail' in detail
                ? String((detail as { detail?: string }).detail)
                : res.status === 429
                  ? 'Çok sık istek. Lütfen birkaç saniye bekleyin.'
                  : `Yanıt alınamadı (${res.status}).`;
          setError(msg);
          return;
        }

        const reply = typeof data?.reply === 'string' ? data.reply.trim() : '';
        if (!reply) {
          setError('Boş yanıt.');
          return;
        }

        setLastReplySource(normalizeReplySource(typeof data?.source === 'string' ? data.source : undefined));

        if (data?.requires_approval === true && data.learning_candidate) {
          const lc = data.learning_candidate;
          const q = typeof lc.question === 'string' ? lc.question.trim() : '';
          const a = typeof lc.answer === 'string' ? lc.answer.trim() : '';
          if (q && a) {
            setPendingLearning({ question: q, answer: a });
          }
        } else {
          setPendingLearning(null);
        }

        const assistantMsg: LeylekZekaMessage = {
          id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          role: 'assistant',
          text: reply,
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch (e: unknown) {
        if (e && typeof e === 'object' && 'name' in e && (e as { name?: string }).name === 'AbortError') {
          setError('İstek zaman aşımına uğradı. Ağınızı kontrol edip tekrar deneyin.');
        } else {
          const hint =
            typeof e === 'object' && e !== null && 'message' in e
              ? String((e as { message?: unknown }).message || '')
              : '';
          setError(
            hint && __DEV__
              ? `Bağlantı hatası: ${hint.slice(0, 120)}`
              : 'Bağlantı kurulamadı. İnternetinizi veya sunucu adresini kontrol edin.',
          );
        }
      } finally {
        clearTimeout(timeoutId);
        setIsTyping(false);
        inFlightRef.current = false;
      }
    },
    [leylekContext, isAdminUser],
  );

  return {
    messages,
    isTyping,
    error,
    sendMessage,
    clearError,
    lastReplySource,
    pendingLearning,
    approvePendingLearning,
    cancelPendingLearning,
  };
}
