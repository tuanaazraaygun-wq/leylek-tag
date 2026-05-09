import { useCallback, useMemo, useRef, useState } from 'react';
import { useSegments } from 'expo-router';
import { useLeylekZekaChrome } from '../contexts/LeylekZekaChromeContext';
import { getLeylekZekaChatUrl } from '../lib/backendConfig';
import { getLeylekZekaContextCopy } from '../lib/leylekZekaUxCopy';
import { getPersistedAccessToken } from '../lib/sessionToken';

export type LeylekZekaMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
};

export type LeylekZekaReplySource = 'openai' | 'fallback' | 'answer_engine' | 'admin_kb' | 'kb';
export type LeylekZekaSendOptions = {
  voiceMode?: boolean;
  inputMode?: 'text' | 'voice';
};

const LEYLEK_ZEKA_FETCH_TIMEOUT_MS = 28_000;

function normalizeReplySource(raw: string | undefined): LeylekZekaReplySource {
  if (
    raw === 'openai' ||
    raw === 'answer_engine' ||
    raw === 'fallback' ||
    raw === 'admin_kb' ||
    raw === 'kb'
  ) {
    return raw;
  }
  // Eski backend uyumu: LLM yanıtı "claude" etiketiyle geliyordu; gerçek sağlayıcı Leylek AI idi.
  if (raw === 'claude') {
    return 'openai';
  }
  return 'fallback';
}

/** Hızlı öneriler — backend fallback anahtar kelimeleriyle uyumlu kısa ifadeler */
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
  intent_id?: string;
  intentId?: string;
  detail?: string | { detail?: string };
};

type PendingComplaintFlow = {
  step: 'confirm' | 'category' | 'details';
  originalText: string;
  category?: string;
  categoryLabel?: string;
};

function normalizeText(text: string): string {
  return text
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isAffirmative(text: string): boolean {
  const t = normalizeText(text);
  return ['evet', 'tamam', 'olur', 'iletmek istiyorum', 'ilet', 'gonder', 'gondermek istiyorum'].some(
    (p) => t === p || t.includes(p),
  );
}

function isNegative(text: string): boolean {
  const t = normalizeText(text);
  return ['hayir', 'vazgectim', 'istemiyorum', 'gerek yok', 'iptal'].some(
    (p) => t === p || t.includes(p),
  );
}

function resolveComplaintCategory(text: string): { category: string; categoryLabel: string } | null {
  const t = normalizeText(text);
  const has = (...parts: string[]) => parts.some((p) => t.includes(p));

  if (has('kullanici', 'profil')) {
    return { category: 'user_complaint', categoryLabel: 'Kullanıcı şikayeti' };
  }
  if (has('surucu', 'sofor')) {
    return { category: 'driver_complaint', categoryLabel: 'Sürücü şikayeti' };
  }
  if (has('yolcu')) {
    return { category: 'passenger_complaint', categoryLabel: 'Yolcu şikayeti' };
  }
  if (has('platform', 'uygulama')) {
    return { category: 'platform_issue', categoryLabel: 'Platform veya uygulama sorunu' };
  }
  if (has('odeme', 'para', 'ucret')) {
    return { category: 'payment_issue', categoryLabel: 'Ödeme sorunu' };
  }
  if (has('konum', 'adres', 'harita')) {
    return { category: 'location_issue', categoryLabel: 'Konum sorunu' };
  }
  if (has('eslesme', 'match')) {
    return { category: 'matching_issue', categoryLabel: 'Eşleşme sorunu' };
  }
  if (has('teklif', 'fiyat')) {
    return { category: 'offer_issue', categoryLabel: 'Teklif sorunu' };
  }
  if (has('geri bildirim', 'genel')) {
    return { category: 'general_feedback', categoryLabel: 'Genel geri bildirim' };
  }
  return null;
}

function makeMessage(role: LeylekZekaMessage['role'], text: string): LeylekZekaMessage {
  return {
    id: `${role === 'user' ? 'u' : 'a'}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    text,
  };
}

function buildHistory(prev: LeylekZekaMessage[]): HistoryItem[] {
  return prev.map((m) => ({ role: m.role, content: m.text }));
}

function stripSimpleMarkdownBold(text: string): string {
  return text.replace(/\*\*([^*\n][\s\S]*?[^*\n])\*\*/g, '$1').replace(/\*\*([^*]+)\*\*/g, '$1');
}

export function useLeylekZeka(options?: { isAdmin?: boolean }) {
  const segments = useSegments();
  const isAdminUser = options?.isAdmin === true || segments[0] === 'admin';
  const { homeFlowScreen, flowHint } = useLeylekZekaChrome();
  const contextCopy = useMemo(
    () => getLeylekZekaContextCopy(homeFlowScreen ?? null, flowHint),
    [homeFlowScreen, flowHint],
  );

  const leylekContext = useMemo(() => {
    const o: Record<string, string | boolean | string[]> = {};
    o.guideMode = true;
    o.stageLabel = contextCopy.stageLabel;
    o.intentScope = contextCopy.intentScope;
    o.operationAwareness = true;
    o.knownSignals = contextCopy.knownSignals;
    o.safeAdviceOnly = contextCopy.safeAdviceOnly;
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
  }, [
    homeFlowScreen,
    flowHint,
    contextCopy.intentScope,
    contextCopy.knownSignals,
    contextCopy.safeAdviceOnly,
    contextCopy.stageLabel,
  ]);

  const [messages, setMessages] = useState<LeylekZekaMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastReplySource, setLastReplySource] = useState<LeylekZekaReplySource | null>(null);
  const [pendingComplaintFlow, setPendingComplaintFlow] = useState<PendingComplaintFlow | null>(null);
  const inFlightRef = useRef(false);

  const clearError = useCallback(() => setError(null), []);

  const appendLocalComplaintExchange = useCallback((userText: string, assistantText: string) => {
    setMessages((prev) => [...prev, makeMessage('user', userText), makeMessage('assistant', assistantText)]);
    setError(null);
    setLastReplySource('answer_engine');
  }, []);

  const sendMessage = useCallback(async (raw: string, sendOptions?: LeylekZekaSendOptions) => {
    const text = isAdminUser && raw.trim() === '' ? '' : raw.trim();
    if ((!text && !isAdminUser) || inFlightRef.current) return;

    if (pendingComplaintFlow && text) {
      if (isNegative(text)) {
        appendLocalComplaintExchange(text, 'Tamam, kayıt açmadan bu akışı kapattım.');
        setPendingComplaintFlow(null);
        return;
      }

      if (pendingComplaintFlow.step === 'confirm') {
        if (isAffirmative(text)) {
          appendLocalComplaintExchange(
            text,
            'Kimi veya neyi bildirmek istiyorsunuz: bir kullanıcıyı, sürücüyü/yolcuyu, yoksa platformla ilgili genel bir durumu mu?',
          );
          setPendingComplaintFlow({ ...pendingComplaintFlow, step: 'category' });
          return;
        }
        appendLocalComplaintExchange(text, 'Devam etmemi ister misiniz? Evet ya da hayır diye yanıtlayabilirsiniz.');
        return;
      }

      if (pendingComplaintFlow.step === 'category') {
        const category = resolveComplaintCategory(text);
        if (!category) {
          appendLocalComplaintExchange(
            text,
            'Bunu hangi başlık altında değerlendirelim: kullanıcı, sürücü, yolcu, platform, ödeme, konum, eşleşme, teklif veya genel geri bildirim?',
          );
          return;
        }
        appendLocalComplaintExchange(
          text,
          'Kısaca ne olduğunu yazar mısınız? Kişisel veri paylaşmadan olayı özetlemeniz yeterli.',
        );
        setPendingComplaintFlow({
          ...pendingComplaintFlow,
          step: 'details',
          category: category.category,
          categoryLabel: category.categoryLabel,
        });
        return;
      }

      if (pendingComplaintFlow.step === 'details') {
        appendLocalComplaintExchange(
          text,
          `Bunu ${pendingComplaintFlow.categoryLabel || 'geri bildirim'} olarak hazırladım. Henüz kayıt açmadım. Bir sonraki adımda onayınızla destek kaydına dönüştürebiliriz.`,
        );
        setPendingComplaintFlow(null);
        return;
      }
    }

    inFlightRef.current = true;

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
      const requestContext: Record<string, string | boolean | string[]> = {
        ...(leylekContext ?? {}),
      };
      if (typeof sendOptions?.voiceMode === 'boolean') {
        requestContext.voiceMode = sendOptions.voiceMode;
      }
      if (sendOptions?.inputMode) {
        requestContext.inputMode = sendOptions.inputMode;
      }
      const payload: Record<string, unknown> = { message, history };
      if (Object.keys(requestContext).length) payload.context = requestContext;
      if (isAdminUser) payload.is_admin = true;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const accessTok = await getPersistedAccessToken();
      if (accessTok?.trim()) {
        headers.Authorization = `Bearer ${accessTok.trim()}`;
      }
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
            : typeof detail === 'object' && detail?.detail
              ? String(detail.detail)
              : res.status === 429
                ? 'Çok sık istek. Lütfen birkaç saniye bekleyin.'
                : `Yanıt alınamadı (${res.status}).`;
        setError(msg);
        return;
      }

      const reply = typeof data?.reply === 'string' ? stripSimpleMarkdownBold(data.reply).trim() : '';
      if (!reply) {
        setError('Boş yanıt.');
        return;
      }

      const intentId = data?.intent_id || data?.intentId;
      if (intentId === 'complaint_feedback_intake') {
        setPendingComplaintFlow({ step: 'confirm', originalText: message });
      }

      setLastReplySource(normalizeReplySource(typeof data?.source === 'string' ? data.source : undefined));

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
  }, [appendLocalComplaintExchange, leylekContext, isAdminUser, pendingComplaintFlow]);

  return { messages, isTyping, error, sendMessage, clearError, lastReplySource };
}
