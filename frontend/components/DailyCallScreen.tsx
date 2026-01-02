/**
 * Daily.co Video/Audio Call Screen
 * WebView tabanlı - Stabil ve hızlı
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
  Dimensions,
  StatusBar,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

interface DailyCallScreenProps {
  roomUrl: string;
  callType: 'video' | 'audio';
  callerName: string;
  onCallEnd: () => void;
  isIncoming?: boolean;
  onAccept?: () => void;
  onReject?: () => void;
}

export default function DailyCallScreen({
  roomUrl,
  callType,
  callerName,
  onCallEnd,
  isIncoming = false,
  onAccept,
  onReject,
}: DailyCallScreenProps) {
  const [loading, setLoading] = useState(true);
  const [callStarted, setCallStarted] = useState(!isIncoming);
  const [callDuration, setCallDuration] = useState(0);
  const webViewRef = useRef<WebView>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Arama süresi sayacı
  useEffect(() => {
    if (callStarted && !loading) {
      timerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [callStarted, loading]);

  // Süreyi formatla
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Aramayı bitir
  const handleEndCall = () => {
    Alert.alert(
      'Aramayı Bitir',
      'Aramayı sonlandırmak istediğinize emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        { 
          text: 'Bitir', 
          style: 'destructive',
          onPress: () => {
            if (timerRef.current) {
              clearInterval(timerRef.current);
            }
            onCallEnd();
          }
        },
      ]
    );
  };

  // Gelen arama ekranı
  if (isIncoming && !callStarted) {
    return (
      <SafeAreaView style={styles.incomingContainer}>
        <StatusBar barStyle="light-content" />
        
        {/* Arayan bilgisi */}
        <View style={styles.callerInfo}>
          <View style={styles.avatarLarge}>
            <Ionicons name={callType === 'video' ? 'videocam' : 'call'} size={60} color="#FFF" />
          </View>
          <Text style={styles.callerName}>{callerName}</Text>
          <Text style={styles.callTypeText}>
            {callType === 'video' ? 'Görüntülü Arama' : 'Sesli Arama'}
          </Text>
        </View>

        {/* Butonlar */}
        <View style={styles.incomingButtons}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.rejectButton]}
            onPress={() => {
              onReject?.();
              onCallEnd();
            }}
          >
            <Ionicons name="close" size={40} color="#FFF" />
            <Text style={styles.actionButtonText}>Reddet</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionButton, styles.acceptButton]}
            onPress={() => {
              setCallStarted(true);
              onAccept?.();
            }}
          >
            <Ionicons name={callType === 'video' ? 'videocam' : 'call'} size={40} color="#FFF" />
            <Text style={styles.actionButtonText}>Kabul Et</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Daily.co Prebuilt URL oluştur
  const dailyUrl = roomUrl;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name={callType === 'video' ? 'videocam' : 'call'} size={24} color="#FFF" />
          <Text style={styles.headerTitle}>{callerName}</Text>
        </View>
        <Text style={styles.duration}>{formatDuration(callDuration)}</Text>
      </View>

      {/* WebView - Daily.co */}
      <View style={styles.webViewContainer}>
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#3FA9F5" />
            <Text style={styles.loadingText}>Bağlanıyor...</Text>
          </View>
        )}
        
        <WebView
          ref={webViewRef}
          source={{ uri: dailyUrl }}
          style={styles.webView}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback={true}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.error('WebView error:', nativeEvent);
            Alert.alert('Hata', 'Arama bağlantısı kurulamadı');
          }}
          // Kamera ve mikrofon izinleri
          allowsProtectedMedia={true}
          mediaCapturePermissionGrantType="grantIfSameHostElsePrompt"
        />
      </View>

      {/* Alt Kontroller */}
      <View style={styles.controls}>
        <TouchableOpacity 
          style={[styles.controlButton, styles.endCallButton]}
          onPress={handleEndCall}
        >
          <Ionicons name="call" size={32} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1B1B1E',
  },
  incomingContainer: {
    flex: 1,
    backgroundColor: '#1B1B1E',
    justifyContent: 'space-between',
    paddingVertical: 60,
  },
  callerInfo: {
    alignItems: 'center',
    marginTop: 60,
  },
  avatarLarge: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#3FA9F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  callerName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 10,
  },
  callTypeText: {
    fontSize: 18,
    color: '#AAA',
  },
  incomingButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 40,
    marginBottom: 40,
  },
  actionButton: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rejectButton: {
    backgroundColor: '#FF3B30',
  },
  acceptButton: {
    backgroundColor: '#34C759',
  },
  actionButtonText: {
    color: '#FFF',
    fontSize: 14,
    marginTop: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#2C2C2E',
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
  duration: {
    fontSize: 16,
    color: '#3FA9F5',
    fontWeight: '600',
  },
  webViewContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  webView: {
    flex: 1,
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
    fontSize: 16,
    marginTop: 15,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 25,
    backgroundColor: '#2C2C2E',
  },
  controlButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
  },
  endCallButton: {
    backgroundColor: '#FF3B30',
  },
});
