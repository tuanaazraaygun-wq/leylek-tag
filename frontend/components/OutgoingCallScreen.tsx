/**
 * OutgoingCallScreen - Araniyor Ekrani
 * Arayan "Araniyor..." ekrani gorur, aranan kabul edene kadar bekler
 */
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

interface OutgoingCallScreenProps {
  receiverName: string;
  callType: 'audio' | 'video';
  onCancel: () => void;
}

export default function OutgoingCallScreen({
  receiverName,
  callType,
  onCancel,
}: OutgoingCallScreenProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const dotAnim = useRef(new Animated.Value(0)).current;

  // Pulse animation
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();

    return () => pulse.stop();
  }, []);

  // Dot animation for "Araniyor..."
  useEffect(() => {
    const dots = Animated.loop(
      Animated.sequence([
        Animated.timing(dotAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(dotAnim, {
          toValue: 2,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(dotAnim, {
          toValue: 3,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(dotAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ])
    );
    dots.start();

    return () => dots.stop();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />
      
      {/* Call Type Badge */}
      <View style={styles.callTypeBadge}>
        <Ionicons 
          name={callType === 'video' ? 'videocam' : 'call'} 
          size={16} 
          color="#FFF" 
        />
        <Text style={styles.callTypeText}>
          {callType === 'video' ? 'Goruntulu Arama' : 'Sesli Arama'}
        </Text>
      </View>

      {/* Receiver Info */}
      <View style={styles.receiverSection}>
        {/* Animated Avatar */}
        <Animated.View 
          style={[
            styles.avatarContainer,
            { transform: [{ scale: pulseAnim }] }
          ]}
        >
          <View style={styles.avatarRing} />
          <View style={styles.avatarRing2} />
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {receiverName?.charAt(0)?.toUpperCase() || '?'}
            </Text>
          </View>
        </Animated.View>

        {/* Receiver Name */}
        <Text style={styles.receiverName}>{receiverName}</Text>
        
        {/* Calling indicator */}
        <View style={styles.callingContainer}>
          <Ionicons name="call-outline" size={20} color="#3B82F6" />
          <Text style={styles.callingText}>Araniyor...</Text>
        </View>
        
        <Text style={styles.waitingText}>Cevap bekleniyor</Text>
      </View>

      {/* Cancel Button */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={styles.cancelButton}
          onPress={onCancel}
          activeOpacity={0.8}
        >
          <Ionicons 
            name="call" 
            size={32} 
            color="#FFF" 
            style={{ transform: [{ rotate: '135deg' }] }} 
          />
        </TouchableOpacity>
        <Text style={styles.buttonLabel}>Iptal</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 60,
  },
  callTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  callTypeText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  receiverSection: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  avatarContainer: {
    width: 150,
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
  },
  avatarRing: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 2,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  avatarRing2: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 2,
    borderColor: 'rgba(59, 130, 246, 0.5)',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  avatarText: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#FFF',
  },
  receiverName: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 12,
  },
  callingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  callingText: {
    fontSize: 18,
    color: '#3B82F6',
    marginLeft: 8,
    fontWeight: '500',
  },
  waitingText: {
    fontSize: 14,
    color: '#888',
    marginTop: 8,
  },
  buttonContainer: {
    alignItems: 'center',
    paddingBottom: 20,
  },
  cancelButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  buttonLabel: {
    color: '#888',
    fontSize: 14,
    marginTop: 10,
  },
});
