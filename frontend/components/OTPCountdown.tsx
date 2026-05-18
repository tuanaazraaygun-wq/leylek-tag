/**
 * OTPCountdown - SMS kodu geri sayım komponenti
 * 30 saniye geri sayım gösterir ve tekrar gönder butonu
 */

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PREMIUM_AUTH_CYAN } from './auth/premiumAuthStyles';

interface OTPCountdownProps {
  phone: string;
  onResend: () => Promise<void>;
  initialSeconds?: number;
  appearance?: 'default' | 'premium';
}

/** `phone`: API yüzünden korunur; gelecekte log / analitik için kullanılabilir. */
export default function OTPCountdown({ phone: _phoneUnused, onResend, initialSeconds = 30, appearance = 'default' }: OTPCountdownProps) {
  const [seconds, setSeconds] = useState(initialSeconds);
  const [canResend, setCanResend] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const isPremium = appearance === 'premium';
  const s = isPremium ? premiumStyles : styles;

  useEffect(() => {
    if (seconds > 0) {
      const timer = setInterval(() => {
        setSeconds((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [seconds]);

  const handleResend = async () => {
    if (!canResend || isResending) return;

    setIsResending(true);
    try {
      await onResend();
      setSeconds(initialSeconds);
      setCanResend(false);
    } finally {
      setIsResending(false);
    }
  };

  return (
    <View style={[base.container, isPremium ? base.containerPremium : null]}>
      {!canResend ? (
        <View style={s.countdownContainer}>
          <Ionicons name="time-outline" size={17} color={isPremium ? PREMIUM_AUTH_CYAN : '#6B7280'} />
          <Text style={s.countdownText}>
            Yeni kod göndermek için <Text style={s.seconds}>{seconds}</Text> saniye bekleyin
          </Text>
        </View>
      ) : (
        <TouchableOpacity style={s.resendButton} onPress={handleResend} disabled={isResending}>
          <Ionicons name={isResending ? 'hourglass-outline' : 'refresh-outline'} size={17} color={PREMIUM_AUTH_CYAN} />
          <Text style={s.resendText}>{isResending ? 'Gönderiliyor...' : 'Kodu tekrar gönder'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const base = StyleSheet.create({
  container: {
    marginVertical: 12,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  containerPremium: {
    marginVertical: 8,
    marginBottom: 4,
  },
});

const styles = StyleSheet.create({
  countdownContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
    maxWidth: '100%',
  },
  countdownText: {
    color: '#6B7280',
    fontSize: 14,
    flexShrink: 1,
    textAlign: 'center',
  },
  seconds: {
    color: '#3FA9F5',
    fontWeight: 'bold',
    fontSize: 16,
  },
  resendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EBF5FF',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    gap: 8,
  },
  resendText: {
    color: '#3FA9F5',
    fontSize: 14,
    fontWeight: '600',
  },
});

const premiumStyles = StyleSheet.create({
  countdownContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'stretch',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(16,26,43,0.65)',
    borderWidth: StyleSheet.hairlineWidth + 1,
    borderColor: 'rgba(30, 58, 95, 0.68)',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  countdownText: {
    color: 'rgba(186,201,222,0.88)',
    fontSize: 12,
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    lineHeight: 17,
    fontWeight: '600',
  },
  seconds: {
    color: PREMIUM_AUTH_CYAN,
    fontWeight: '900',
    fontSize: 15,
  },
  resendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'stretch',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(34,211,238,0.06)',
    borderWidth: StyleSheet.hairlineWidth + 1,
    borderColor: 'rgba(30, 58, 95, 0.72)',
  },
  resendText: {
    color: 'rgba(94, 210, 230, 0.95)',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.25,
  },
});
