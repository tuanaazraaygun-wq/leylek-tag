/**
 * In-App Navigation Component
 * Sürücü için uygulama içi navigasyon - Google Maps yerine
 * Turn-by-turn yönlendirme + Sesli komutlar
 */
import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, Modal, 
  Dimensions, Platform, Animated
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Speech from 'expo-speech';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface NavigationInstruction {
  maneuver: string;
  instruction: string;
  distance: string;
  duration: string;
}

interface InAppNavigationProps {
  visible: boolean;
  onClose: () => void;
  origin: { latitude: number; longitude: number };
  destination: { latitude: number; longitude: number };
  destinationName?: string;
}

// Manevra ikonları
const getManeuverIcon = (maneuver: string): string => {
  const icons: { [key: string]: string } = {
    'turn-left': 'arrow-back',
    'turn-right': 'arrow-forward',
    'turn-sharp-left': 'return-down-back',
    'turn-sharp-right': 'return-down-forward',
    'turn-slight-left': 'trending-down',
    'turn-slight-right': 'trending-up',
    'straight': 'arrow-up',
    'ramp-left': 'return-down-back',
    'ramp-right': 'return-down-forward',
    'merge': 'git-merge',
    'fork-left': 'git-branch',
    'fork-right': 'git-branch',
    'roundabout-left': 'refresh',
    'roundabout-right': 'refresh',
    'uturn-left': 'refresh',
    'uturn-right': 'refresh',
    'arrive': 'flag',
    'depart': 'navigate',
  };
  return icons[maneuver] || 'navigate';
};

// Türkçe manevra çevirisi
const getManeuverText = (maneuver: string): string => {
  const texts: { [key: string]: string } = {
    'turn-left': 'Sola dönün',
    'turn-right': 'Sağa dönün',
    'turn-sharp-left': 'Keskin sola dönün',
    'turn-sharp-right': 'Keskin sağa dönün',
    'turn-slight-left': 'Hafif sola dönün',
    'turn-slight-right': 'Hafif sağa dönün',
    'straight': 'Düz devam edin',
    'ramp-left': 'Sol rampa',
    'ramp-right': 'Sağ rampa',
    'merge': 'Birleşin',
    'fork-left': 'Sol çatalı takip edin',
    'fork-right': 'Sağ çatalı takip edin',
    'roundabout-left': 'Kavşakta sola',
    'roundabout-right': 'Kavşakta sağa',
    'uturn-left': 'U dönüşü yapın',
    'uturn-right': 'U dönüşü yapın',
    'arrive': 'Hedefinize ulaştınız',
    'depart': 'Yola çıkın',
  };
  return texts[maneuver] || 'Devam edin';
};

export default function InAppNavigation({ 
  visible, 
  onClose, 
  origin, 
  destination, 
  destinationName 
}: InAppNavigationProps) {
  const [instructions, setInstructions] = useState<NavigationInstruction[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [totalDistance, setTotalDistance] = useState('');
  const [totalDuration, setTotalDuration] = useState('');
  const [loading, setLoading] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  
  useEffect(() => {
    if (visible && origin && destination) {
      fetchDirections();
      startPulseAnimation();
    }
    
    return () => {
      Speech.stop();
    };
  }, [visible, origin, destination]);
  
  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  };
  
  const fetchDirections = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${API_URL}/api/directions?` +
        `origin_lat=${origin.latitude}&origin_lng=${origin.longitude}` +
        `&dest_lat=${destination.latitude}&dest_lng=${destination.longitude}`
      );
      
      const data = await response.json();
      
      if (data.success && data.steps) {
        const steps = data.steps.map((step: any) => ({
          maneuver: step.maneuver || 'straight',
          instruction: step.instruction || '',
          distance: step.distance || '',
          duration: step.duration || '',
        }));
        
        setInstructions(steps);
        setTotalDistance(data.total_distance || '');
        setTotalDuration(data.total_duration || '');
        
        // İlk yönergeyi sesli oku
        if (voiceEnabled && steps.length > 0) {
          speakInstruction(steps[0]);
        }
      }
    } catch (error) {
      console.log('Directions fetch error:', error);
    }
    setLoading(false);
  };
  
  const speakInstruction = (instruction: NavigationInstruction) => {
    if (!voiceEnabled) return;
    
    const text = `${instruction.distance} sonra, ${getManeuverText(instruction.maneuver)}`;
    Speech.speak(text, {
      language: 'tr-TR',
      pitch: 1,
      rate: 0.9,
    });
  };
  
  const nextStep = () => {
    if (currentStep < instructions.length - 1) {
      const newStep = currentStep + 1;
      setCurrentStep(newStep);
      speakInstruction(instructions[newStep]);
    }
  };
  
  const prevStep = () => {
    if (currentStep > 0) {
      const newStep = currentStep - 1;
      setCurrentStep(newStep);
      speakInstruction(instructions[newStep]);
    }
  };
  
  const toggleVoice = () => {
    if (voiceEnabled) {
      Speech.stop();
    }
    setVoiceEnabled(!voiceEnabled);
  };
  
  const currentInstruction = instructions[currentStep];
  
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <LinearGradient colors={['#1E3A5F', '#0F172A']} style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="#FFF" />
            </TouchableOpacity>
            <View style={styles.headerInfo}>
              <Text style={styles.headerTitle}>NAVİGASYON</Text>
              <Text style={styles.headerSubtitle}>{destinationName || 'Hedefe'}</Text>
            </View>
            <TouchableOpacity onPress={toggleVoice} style={styles.voiceBtn}>
              <Ionicons 
                name={voiceEnabled ? "volume-high" : "volume-mute"} 
                size={24} 
                color={voiceEnabled ? "#22C55E" : "#EF4444"} 
              />
            </TouchableOpacity>
          </LinearGradient>
          
          {/* Total Info */}
          <View style={styles.totalInfo}>
            <View style={styles.totalItem}>
              <Ionicons name="navigate" size={20} color="#3FA9F5" />
              <Text style={styles.totalValue}>{totalDistance}</Text>
              <Text style={styles.totalLabel}>Mesafe</Text>
            </View>
            <View style={styles.totalDivider} />
            <View style={styles.totalItem}>
              <Ionicons name="time" size={20} color="#F59E0B" />
              <Text style={styles.totalValue}>{totalDuration}</Text>
              <Text style={styles.totalLabel}>Süre</Text>
            </View>
          </View>
          
          {/* Current Instruction */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Rota hesaplanıyor...</Text>
            </View>
          ) : currentInstruction ? (
            <Animated.View style={[styles.instructionCard, { transform: [{ scale: pulseAnim }] }]}>
              <View style={styles.maneuverIcon}>
                <Ionicons 
                  name={getManeuverIcon(currentInstruction.maneuver) as any} 
                  size={48} 
                  color="#FFF" 
                />
              </View>
              <Text style={styles.instructionDistance}>{currentInstruction.distance}</Text>
              <Text style={styles.instructionText}>
                {getManeuverText(currentInstruction.maneuver)}
              </Text>
              <Text style={styles.instructionDetail}>{currentInstruction.instruction}</Text>
            </Animated.View>
          ) : (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Yönerge bulunamadı</Text>
            </View>
          )}
          
          {/* Step Counter */}
          <View style={styles.stepCounter}>
            <Text style={styles.stepText}>
              Adım {currentStep + 1} / {instructions.length}
            </Text>
          </View>
          
          {/* Navigation Controls */}
          <View style={styles.controls}>
            <TouchableOpacity 
              style={[styles.controlBtn, currentStep === 0 && styles.controlBtnDisabled]}
              onPress={prevStep}
              disabled={currentStep === 0}
            >
              <Ionicons name="chevron-back" size={28} color="#FFF" />
              <Text style={styles.controlBtnText}>Önceki</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.speakBtn}
              onPress={() => currentInstruction && speakInstruction(currentInstruction)}
            >
              <Ionicons name="mic" size={32} color="#FFF" />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.controlBtn, currentStep >= instructions.length - 1 && styles.controlBtnDisabled]}
              onPress={nextStep}
              disabled={currentStep >= instructions.length - 1}
            >
              <Text style={styles.controlBtnText}>Sonraki</Text>
              <Ionicons name="chevron-forward" size={28} color="#FFF" />
            </TouchableOpacity>
          </View>
          
          {/* Upcoming Steps */}
          {instructions.length > currentStep + 1 && (
            <View style={styles.upcomingContainer}>
              <Text style={styles.upcomingTitle}>Sonraki Adımlar</Text>
              {instructions.slice(currentStep + 1, currentStep + 4).map((step, index) => (
                <View key={index} style={styles.upcomingItem}>
                  <Ionicons 
                    name={getManeuverIcon(step.maneuver) as any} 
                    size={18} 
                    color="#9CA3AF" 
                  />
                  <Text style={styles.upcomingText}>
                    {step.distance} - {getManeuverText(step.maneuver)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.85,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  closeBtn: {
    padding: 8,
  },
  headerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#9CA3AF',
    letterSpacing: 2,
  },
  headerSubtitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  voiceBtn: {
    padding: 8,
  },
  totalInfo: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  totalItem: {
    flex: 1,
    alignItems: 'center',
  },
  totalDivider: {
    width: 1,
    backgroundColor: '#374151',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFF',
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    color: '#9CA3AF',
    fontSize: 16,
  },
  instructionCard: {
    backgroundColor: '#3FA9F5',
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  maneuverIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  instructionDistance: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 1,
  },
  instructionText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
    marginTop: 8,
    textAlign: 'center',
  },
  instructionDetail: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 8,
    textAlign: 'center',
  },
  stepCounter: {
    alignItems: 'center',
    marginTop: 12,
  },
  stepText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  controlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  controlBtnDisabled: {
    opacity: 0.4,
  },
  controlBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    marginHorizontal: 4,
  },
  speakBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#22C55E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  upcomingContainer: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  upcomingTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9CA3AF',
    marginBottom: 8,
    letterSpacing: 1,
  },
  upcomingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  upcomingText: {
    color: '#9CA3AF',
    marginLeft: 12,
    fontSize: 14,
  },
});
