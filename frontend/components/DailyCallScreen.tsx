/**
 * Daily.co Video/Audio Call Screen
 * SIMPLE VERSION - No incoming call logic, no socket signaling
 * Direct WebView to Daily.co room
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Alert,
  StatusBar,
  BackHandler,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';

interface DailyCallScreenProps {
  roomUrl: string;
  roomName: string;
  callType: 'video' | 'audio';
  otherUserName: string;
  onCallEnd: (roomName: string) => void;
}

export default function DailyCallScreen({
  roomUrl,
  roomName,
  callType,
  otherUserName,
  onCallEnd,
}: DailyCallScreenProps) {
  const [loading, setLoading] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [connected, setConnected] = useState(false);
  const webViewRef = useRef<WebView>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const maxDuration = 600; // 10 minutes in seconds

  // Start timer when connected
  useEffect(() => {
    if (connected) {
      timerRef.current = setInterval(() => {
        setCallDuration(prev => {
          const newDuration = prev + 1;
          // Auto-end call at 10 minutes
          if (newDuration >= maxDuration) {
            handleEndCall(true);
          }
          return newDuration;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [connected]);

  // Handle back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleEndCall(false);
      return true;
    });

    return () => backHandler.remove();
  }, []);

  // Format duration as MM:SS
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // End call
  const handleEndCall = (auto: boolean = false) => {
    if (auto) {
      // Auto-end - no confirmation
      cleanup();
      onCallEnd(roomName);
      return;
    }

    Alert.alert(
      'Aramayı Bitir',
      'Aramayı sonlandırmak istediğinize emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        { 
          text: 'Bitir', 
          style: 'destructive',
          onPress: () => {
            cleanup();
            onCallEnd(roomName);
          }
        },
      ]
    );
  };

  const cleanup = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  };

  // Remaining time warning
  const remainingTime = maxDuration - callDuration;
  const showWarning = remainingTime <= 60 && remainingTime > 0;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1B1B1E" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons 
            name={callType === 'video' ? 'videocam' : 'call'} 
            size={22} 
            color="#3FA9F5" 
          />
          <Text style={styles.headerTitle}>{otherUserName}</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={[styles.duration, showWarning && styles.durationWarning]}>
            {formatDuration(callDuration)}
          </Text>
          {showWarning && (
            <Text style={styles.warningText}>Son 1 dk!</Text>
          )}
        </View>
      </View>

      {/* WebView - Daily.co */}
      <View style={styles.webViewContainer}>
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#3FA9F5" />
            <Text style={styles.loadingText}>Bağlanıyor...</Text>
            <Text style={styles.loadingSubtext}>Lütfen bekleyin</Text>
          </View>
        )}
        
        <WebView
          ref={webViewRef}
          source={{ uri: roomUrl }}
          style={styles.webView}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback={true}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => {
            setLoading(false);
            setConnected(true);
          }}
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.error('WebView error:', nativeEvent);
            Alert.alert('Bağlantı Hatası', 'Arama bağlantısı kurulamadı', [
              { text: 'Tamam', onPress: () => onCallEnd(roomName) }
            ]);
          }}
          // Camera and microphone permissions
          allowsProtectedMedia={true}
          mediaCapturePermissionGrantType="grant"
          // Performance
          cacheEnabled={false}
          incognito={true}
        />
      </View>

      {/* Bottom Controls */}
      <View style={styles.controls}>
        <TouchableOpacity 
          style={styles.endCallButton}
          onPress={() => handleEndCall(false)}
          activeOpacity={0.7}
        >
          <Ionicons 
            name="call" 
            size={32} 
            color="#FFF" 
            style={{ transform: [{ rotate: '135deg' }] }} 
          />
        </TouchableOpacity>
        <Text style={styles.endCallText}>Aramayı Bitir</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1B1B1E',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#2C2C2E',
    borderBottomWidth: 1,
    borderBottomColor: '#3C3C3E',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
    marginLeft: 10,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  duration: {
    fontSize: 18,
    color: '#3FA9F5',
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  durationWarning: {
    color: '#FF9500',
  },
  warningText: {
    fontSize: 12,
    color: '#FF9500',
    marginTop: 2,
  },
  webViewContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  webView: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1B1B1E',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loadingText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 20,
  },
  loadingSubtext: {
    color: '#888',
    fontSize: 14,
    marginTop: 8,
  },
  controls: {
    alignItems: 'center',
    paddingVertical: 20,
    backgroundColor: '#2C2C2E',
    borderTopWidth: 1,
    borderTopColor: '#3C3C3E',
  },
  endCallButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  endCallText: {
    color: '#888',
    fontSize: 14,
    marginTop: 10,
  },
});
