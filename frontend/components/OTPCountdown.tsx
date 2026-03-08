/**
 * OTPCountdown - SMS kodu geri sayım komponenti
 * 30 saniye geri sayım gösterir ve tekrar gönder butonu
 */

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface OTPCountdownProps {
  phone: string;
  onResend: () => Promise<void>;
  initialSeconds?: number;
}

export default function OTPCountdown({ phone, onResend, initialSeconds = 30 }: OTPCountdownProps) {
  const [seconds, setSeconds] = useState(initialSeconds);
  const [canResend, setCanResend] = useState(false);
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    if (seconds > 0) {
      const timer = setInterval(() => {
        setSeconds(prev => {
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
      // Reset countdown
      setSeconds(initialSeconds);
      setCanResend(false);
    } finally {
      setIsResending(false);
    }
  };

  return (
    <View style={styles.container}>
      {!canResend ? (
        <View style={styles.countdownContainer}>
          <Ionicons name="time-outline" size={18} color="#6B7280" />
          <Text style={styles.countdownText}>
            Yeni kod göndermek için <Text style={styles.seconds}>{seconds}</Text> saniye bekleyin
          </Text>
        </View>
      ) : (
        <TouchableOpacity 
          style={styles.resendButton} 
          onPress={handleResend}
          disabled={isResending}
        >
          <Ionicons 
            name={isResending ? "hourglass-outline" : "refresh-outline"} 
            size={18} 
            color="#3FA9F5" 
          />
          <Text style={styles.resendText}>
            {isResending ? 'Gönderiliyor...' : 'Kodu tekrar gönder'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
    alignItems: 'center',
  },
  countdownContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    gap: 8,
  },
  countdownText: {
    color: '#6B7280',
    fontSize: 14,
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
