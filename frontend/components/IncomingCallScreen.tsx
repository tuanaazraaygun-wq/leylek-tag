/**
 * IncomingCallScreen - Gelen Arama Ekranı
 * Socket üzerinden call_invite geldiğinde gösterilir
 * Vibration + Accept/Reject butonları
 */
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Vibration,
  Animated,
  Dimensions,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

interface IncomingCallScreenProps {
  callerName: string;
  callType: 'audio' | 'video';
  onAccept: () => void;
  onReject: () => void;
}

export default function IncomingCallScreen({
  callerName,
  callType,
  onAccept,
  onReject,
}: IncomingCallScreenProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const ringAnim = useRef(new Animated.Value(0)).current;

  // Vibration pattern: vibrate 500ms, pause 500ms, repeat
  useEffect(() => {
    const vibratePattern = [0, 500, 500, 500, 500, 500];
    
    // Start vibration
    Vibration.vibrate(vibratePattern, true);

    // Cleanup
    return () => {
      Vibration.cancel();
    };
  }, []);

  // Pulse animation
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();

    return () => pulse.stop();
  }, []);

  // Ring animation
  useEffect(() => {
    const ring = Animated.loop(
      Animated.sequence([
        Animated.timing(ringAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(ringAnim, {
          toValue: -1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(ringAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ])
    );
    ring.start();

    return () => ring.stop();
  }, []);

  const handleAccept = () => {
    Vibration.cancel();
    onAccept();
  };

  const handleReject = () => {
    Vibration.cancel();
    onReject();
  };

  const ringRotate = ringAnim.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-15deg', '15deg'],
  });

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />
      
      {/* Background gradient effect */}
      <View style={styles.backgroundGradient} />
      
      {/* Call Type Badge */}
      <View style={styles.callTypeBadge}>
        <Ionicons 
          name={callType === 'video' ? 'videocam' : 'call'} 
          size={16} 
          color="#FFF" 
        />
        <Text style={styles.callTypeText}>
          {callType === 'video' ? 'Görüntülü Arama' : 'Sesli Arama'}
        </Text>
      </View>

      {/* Caller Info */}
      <View style={styles.callerSection}>
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
              {callerName?.charAt(0)?.toUpperCase() || '?'}
            </Text>
          </View>
        </Animated.View>

        {/* Caller Name */}
        <Text style={styles.callerName}>{callerName}</Text>
        
        {/* Ringing indicator */}
        <View style={styles.ringingContainer}>
          <Animated.View style={{ transform: [{ rotate: ringRotate }] }}>
            <Ionicons name="call" size={20} color="#4CAF50" />
          </Animated.View>
          <Text style={styles.ringingText}>Arıyor...</Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        {/* Reject Button */}
        <TouchableOpacity 
          style={styles.rejectButton}
          onPress={handleReject}
          activeOpacity={0.8}
        >
          <Ionicons 
            name="call" 
            size={32} 
            color="#FFF" 
            style={{ transform: [{ rotate: '135deg' }] }} 
          />
          <Text style={styles.buttonLabel}>Reddet</Text>
        </TouchableOpacity>

        {/* Accept Button */}
        <TouchableOpacity 
          style={styles.acceptButton}
          onPress={handleAccept}
          activeOpacity={0.8}
        >
          <Ionicons 
            name={callType === 'video' ? 'videocam' : 'call'} 
            size={32} 
            color="#FFF" 
          />
          <Text style={styles.buttonLabel}>Kabul Et</Text>
        </TouchableOpacity>
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
  backgroundGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1a1a2e',
    opacity: 0.95,
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
  callerSection: {
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
    borderColor: 'rgba(76, 175, 80, 0.3)',
  },
  avatarRing2: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 2,
    borderColor: 'rgba(76, 175, 80, 0.5)',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4CAF50',
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
  callerName: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 12,
  },
  ringingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ringingText: {
    fontSize: 16,
    color: '#4CAF50',
    marginLeft: 8,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: width - 60,
    paddingBottom: 20,
  },
  rejectButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  acceptButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  buttonLabel: {
    color: '#FFF',
    fontSize: 12,
    marginTop: 8,
    position: 'absolute',
    bottom: -25,
  },
});
