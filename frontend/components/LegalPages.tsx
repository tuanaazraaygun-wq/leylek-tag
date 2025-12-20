import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

const COLORS = {
  primary: '#3FA9F5',
  primaryDark: '#1E3A5F',
  background: '#0F172A',
  card: '#1E293B',
  text: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.7)',
};

interface LegalPageProps {
  type: 'privacy' | 'terms' | 'kvkk';
  visible: boolean;
  onClose: () => void;
}

export function LegalPage({ type, visible, onClose }: LegalPageProps) {
  const [content, setContent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (visible) {
      loadContent();
    }
  }, [visible, type]);
  
  const loadContent = async () => {
    setLoading(true);
    try {
      const endpoint = type === 'privacy' ? 'privacy' : type === 'terms' ? 'terms' : 'kvkk';
      const res = await fetch(`${API_URL}/legal/${endpoint}`);
      const data = await res.json();
      if (data.success) setContent(data);
    } catch (e) {
      console.error('Legal content load error:', e);
    }
    setLoading(false);
  };
  
  if (!visible) return null;
  
  return (
    <Modal visible={visible} animationType="slide">
      <View style={styles.container}>
        <LinearGradient colors={[COLORS.primaryDark, COLORS.background]} style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{content?.title || 'Yükleniyor...'}</Text>
          <View style={{ width: 28 }} />
        </LinearGradient>
        
        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 50 }} />
        ) : (
          <ScrollView style={styles.content}>
            <Text style={styles.companyName}>{content?.company}</Text>
            {content?.last_updated && (
              <Text style={styles.lastUpdated}>Son güncelleme: {content.last_updated}</Text>
            )}
            <Text style={styles.contentText}>{content?.content}</Text>
            <View style={{ height: 50 }} />
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

// Kayıt sırasında gösterilen onay modalı
interface LegalConsentModalProps {
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

export function LegalConsentModal({ visible, onAccept, onDecline }: LegalConsentModalProps) {
  const [privacyChecked, setPrivacyChecked] = useState(false);
  const [termsChecked, setTermsChecked] = useState(false);
  const [kvkkChecked, setKvkkChecked] = useState(false);
  const [ageChecked, setAgeChecked] = useState(false);
  
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showKvkk, setShowKvkk] = useState(false);
  
  const allChecked = privacyChecked && termsChecked && kvkkChecked && ageChecked;
  
  if (!visible) return null;
  
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.consentModal}>
          <LinearGradient colors={[COLORS.primaryDark, COLORS.card]} style={styles.consentHeader}>
            <Ionicons name="shield-checkmark" size={40} color={COLORS.primary} />
            <Text style={styles.consentTitle}>Kullanım Onayı</Text>
            <Text style={styles.consentSubtitle}>Devam etmek için aşağıdakileri onaylamanız gerekmektedir.</Text>
          </LinearGradient>
          
          <ScrollView style={styles.consentContent}>
            {/* Gizlilik Politikası */}
            <TouchableOpacity 
              style={styles.consentItem}
              onPress={() => setPrivacyChecked(!privacyChecked)}
            >
              <View style={[styles.checkbox, privacyChecked && styles.checkboxChecked]}>
                {privacyChecked && <Ionicons name="checkmark" size={18} color="#FFF" />}
              </View>
              <View style={styles.consentTextContainer}>
                <Text style={styles.consentText}>
                  <Text style={styles.linkText} onPress={() => setShowPrivacy(true)}>Gizlilik Politikası</Text>
                  'nı okudum ve kabul ediyorum.
                </Text>
              </View>
            </TouchableOpacity>
            
            {/* Kullanım Şartları */}
            <TouchableOpacity 
              style={styles.consentItem}
              onPress={() => setTermsChecked(!termsChecked)}
            >
              <View style={[styles.checkbox, termsChecked && styles.checkboxChecked]}>
                {termsChecked && <Ionicons name="checkmark" size={18} color="#FFF" />}
              </View>
              <View style={styles.consentTextContainer}>
                <Text style={styles.consentText}>
                  <Text style={styles.linkText} onPress={() => setShowTerms(true)}>Kullanım Şartları</Text>
                  'nı okudum ve kabul ediyorum.
                </Text>
              </View>
            </TouchableOpacity>
            
            {/* KVKK */}
            <TouchableOpacity 
              style={styles.consentItem}
              onPress={() => setKvkkChecked(!kvkkChecked)}
            >
              <View style={[styles.checkbox, kvkkChecked && styles.checkboxChecked]}>
                {kvkkChecked && <Ionicons name="checkmark" size={18} color="#FFF" />}
              </View>
              <View style={styles.consentTextContainer}>
                <Text style={styles.consentText}>
                  <Text style={styles.linkText} onPress={() => setShowKvkk(true)}>KVKK Aydınlatma Metni</Text>
                  'ni okudum, kişisel verilerimin işlenmesini onaylıyorum.
                </Text>
              </View>
            </TouchableOpacity>
            
            {/* 18+ Yaş Onayı */}
            <TouchableOpacity 
              style={styles.consentItem}
              onPress={() => setAgeChecked(!ageChecked)}
            >
              <View style={[styles.checkbox, ageChecked && styles.checkboxChecked]}>
                {ageChecked && <Ionicons name="checkmark" size={18} color="#FFF" />}
              </View>
              <View style={styles.consentTextContainer}>
                <Text style={styles.consentText}>
                  18 yaşından büyük olduğumu beyan ediyorum.
                </Text>
              </View>
            </TouchableOpacity>
            
            {/* Sorumluluk Reddi */}
            <View style={styles.disclaimerBox}>
              <Ionicons name="warning" size={24} color="#F59E0B" />
              <Text style={styles.disclaimerText}>
                ⚠️ UYARI: Leylek TAG sadece bir aracılık platformudur. Kullanıcılar arası anlaşmazlıklardan, yolculuk sırasında oluşabilecek kaza, hasar veya kayıplardan sorumlu değildir.
              </Text>
            </View>
          </ScrollView>
          
          <View style={styles.consentButtons}>
            <TouchableOpacity style={styles.declineButton} onPress={onDecline}>
              <Text style={styles.declineButtonText}>Vazgeç</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.acceptButton, !allChecked && styles.acceptButtonDisabled]}
              onPress={allChecked ? onAccept : undefined}
              disabled={!allChecked}
            >
              <LinearGradient
                colors={allChecked ? [COLORS.primary, '#2563EB'] : ['#475569', '#64748B']}
                style={styles.acceptButtonGradient}
              >
                <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                <Text style={styles.acceptButtonText}>Kabul Et ve Devam Et</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
      
      {/* Legal Pages */}
      <LegalPage type="privacy" visible={showPrivacy} onClose={() => setShowPrivacy(false)} />
      <LegalPage type="terms" visible={showTerms} onClose={() => setShowTerms(false)} />
      <LegalPage type="kvkk" visible={showKvkk} onClose={() => setShowKvkk(false)} />
    </Modal>
  );
}

// Konum Paylaşımı Uyarısı
interface LocationWarningProps {
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

export function LocationWarningModal({ visible, onAccept, onDecline }: LocationWarningProps) {
  if (!visible) return null;
  
  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.warningModal}>
          <View style={styles.warningIcon}>
            <Ionicons name="location" size={50} color={COLORS.primary} />
          </View>
          
          <Text style={styles.warningTitle}>Konum Paylaşımı</Text>
          
          <Text style={styles.warningText}>
            Leylek TAG, yolculuk sırasında konumunuzu şoför/yolcu ile paylaşır. Bu bilgi:
          </Text>
          
          <View style={styles.warningList}>
            <Text style={styles.warningListItem}>✓ Sadece aktif yolculuk süresince paylaşılır</Text>
            <Text style={styles.warningListItem}>✓ Yolculuk bitince paylaşım durur</Text>
            <Text style={styles.warningListItem}>✓ Konum geçmişi saklanmaz</Text>
          </View>
          
          <View style={styles.warningButtons}>
            <TouchableOpacity style={styles.warningDeclineBtn} onPress={onDecline}>
              <Text style={styles.warningDeclineText}>İzin Verme</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.warningAcceptBtn} onPress={onAccept}>
              <LinearGradient colors={[COLORS.primary, '#2563EB']} style={styles.warningAcceptGradient}>
                <Text style={styles.warningAcceptText}>İzin Ver</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  companyName: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  lastUpdated: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginBottom: 20,
  },
  contentText: {
    color: '#FFF',
    fontSize: 14,
    lineHeight: 24,
  },
  // Consent Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  consentModal: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    width: '100%',
    maxHeight: '90%',
    overflow: 'hidden',
  },
  consentHeader: {
    padding: 24,
    alignItems: 'center',
  },
  consentTitle: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 12,
  },
  consentSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  consentContent: {
    padding: 20,
    maxHeight: 350,
  },
  consentItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 12,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: COLORS.primary,
  },
  consentTextContainer: {
    flex: 1,
  },
  consentText: {
    color: '#FFF',
    fontSize: 14,
    lineHeight: 22,
  },
  linkText: {
    color: COLORS.primary,
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
  disclaimerBox: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginTop: 16,
  },
  disclaimerText: {
    flex: 1,
    color: '#F59E0B',
    fontSize: 13,
    lineHeight: 20,
  },
  consentButtons: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  declineButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.textSecondary,
  },
  declineButtonText: {
    color: COLORS.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  acceptButton: {
    flex: 2,
    borderRadius: 12,
    overflow: 'hidden',
  },
  acceptButtonDisabled: {
    opacity: 0.6,
  },
  acceptButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  acceptButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  // Warning Modal
  warningModal: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    alignItems: 'center',
  },
  warningIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(63, 169, 245, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  warningTitle: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  warningText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  warningList: {
    alignSelf: 'stretch',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  warningListItem: {
    color: '#10B981',
    fontSize: 14,
    marginBottom: 8,
  },
  warningButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  warningDeclineBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.textSecondary,
  },
  warningDeclineText: {
    color: COLORS.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  warningAcceptBtn: {
    flex: 2,
    borderRadius: 12,
    overflow: 'hidden',
  },
  warningAcceptGradient: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  warningAcceptText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
});
