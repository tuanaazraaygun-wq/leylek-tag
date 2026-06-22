import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getLegalRegistryDocument } from '../lib/legal/documents';
import { LEGAL_COMPANY_META, LEGAL_DOC_LAST_UPDATED } from '../lib/legalUxCopy';
import { useSettingsTheme } from '../lib/theme/useSettingsTheme';

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

type LocalLegalContent = {
  title: string;
  company: string;
  last_updated: string;
  content: string;
};

const MODAL_DRAFT_NOTICE =
  'Bu özet bilgilendirme amaçlıdır. Taslak veya ayrı sürüm metinler için uygulama içi yasal sayfalar geçerlidir.';

function sectionsToPlainText(sections: { title: string; body: string }[]): string {
  return sections.map((section) => `${section.title}\n\n${section.body}`).join('\n\n');
}

/** Local SSOT fallback — backend /api/legal fetch intentionally disabled. */
function getLocalLegalContent(type: LegalPageProps['type']): LocalLegalContent {
  if (type === 'terms') {
    const doc = getLegalRegistryDocument('terms-user');
    return {
      title: doc.title,
      company: doc.company,
      last_updated: `${doc.lastUpdated} · ${doc.version}`,
      content: `${MODAL_DRAFT_NOTICE}\n\n${sectionsToPlainText(doc.sections)}`,
    };
  }

  if (type === 'privacy') {
    return {
      title: 'Gizlilik Politikası',
      company: LEGAL_COMPANY_META.companyName,
      last_updated: LEGAL_DOC_LAST_UPDATED,
      content:
        `${MODAL_DRAFT_NOTICE}\n\n` +
        'LeylekTAG, kişisel verileri gönüllü yol paylaşımı, eşleşme, iletişim ve güvenlik amaçlarıyla işler.\n\n' +
        'Konum verisi yalnızca talep ve yol paylaşımı akışı sırasında kullanılır. Muhabbet mesajları ürün ve güvenlik operasyonları kapsamında sınırlı süre saklanabilir.\n\n' +
        `Tam metin: uygulama içi Gizlilik Politikası sayfası.\n\nİletişim: ${LEGAL_COMPANY_META.email} · ${LEGAL_COMPANY_META.phone}`,
    };
  }

  return {
    title: 'KVKK Aydınlatma Metni',
    company: LEGAL_COMPANY_META.companyName,
    last_updated: LEGAL_DOC_LAST_UPDATED,
    content:
      `${MODAL_DRAFT_NOTICE}\n\n` +
      `Veri sorumlusu: ${LEGAL_COMPANY_META.companyName}\n` +
      `${LEGAL_COMPANY_META.address}\n\n` +
      'Kişisel veriler; kayıt, eşleşme, teklif, iletişim, sürücü doğrulama, güvenlik ve yasal yükümlülükler kapsamında işlenir.\n\n' +
      'IBAN bilgisi yalnızca taraflar arası katkı payı iletimi için kullanılabilir; LeylekTAG platform tahsilatı yapmaz.\n\n' +
      `Tam metin: uygulama içi KVKK Aydınlatma Metni sayfası.\n\nBaşvuru: ${LEGAL_COMPANY_META.email}`,
  };
}

export function LegalPage({ type, visible, onClose }: LegalPageProps) {
  const { legalModalSurfaces: lt, legalUi } = useSettingsTheme('legal');
  const content = useMemo(() => getLocalLegalContent(type), [type]);
  const headerGradient = lt?.headerGradient ?? [COLORS.primaryDark, COLORS.background] as const;

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide">
      <View style={[styles.container, lt?.container]}>
        <LinearGradient colors={headerGradient} style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color={legalUi.headerIcon} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, lt?.headerTitle]}>{content.title}</Text>
          <View style={{ width: 28 }} />
        </LinearGradient>

        <ScrollView style={styles.content}>
          <Text style={[styles.companyName, lt?.companyName]}>{content.company}</Text>
          <Text style={[styles.lastUpdated, lt?.lastUpdated]}>Son güncelleme: {content.last_updated}</Text>
          <Text style={[styles.contentText, lt?.contentText]}>{content.content}</Text>
          <View style={{ height: 50 }} />
        </ScrollView>
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
  const { legalModalSurfaces: lt, legalUi } = useSettingsTheme('legal');
  const [privacyChecked, setPrivacyChecked] = useState(false);
  const [termsChecked, setTermsChecked] = useState(false);
  const [kvkkChecked, setKvkkChecked] = useState(false);
  const [ageChecked, setAgeChecked] = useState(false);
  
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showKvkk, setShowKvkk] = useState(false);
  
  const allChecked = privacyChecked && termsChecked && kvkkChecked && ageChecked;
  const consentHeaderGradient = lt?.consentHeaderGradient ?? [COLORS.primaryDark, COLORS.card] as const;
  const acceptGradientActive = [legalUi.accent, legalUi.accentSecondary] as const;
  
  if (!visible) return null;
  
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={[styles.modalOverlay, lt?.modalOverlay]}>
        <View style={[styles.consentModal, lt?.consentModal]}>
          <LinearGradient colors={consentHeaderGradient} style={styles.consentHeader}>
            <Ionicons name="shield-checkmark" size={40} color={legalUi.accent} />
            <Text style={[styles.consentTitle, lt?.consentTitle]}>Yasal Onay</Text>
            <Text style={[styles.consentSubtitle, lt?.consentSubtitle]}>
              Devam etmek için aşağıdaki metinleri okumanız ve gerekli beyan/onayları vermeniz gerekmektedir.
            </Text>
          </LinearGradient>
          
          <ScrollView style={styles.consentContent}>
            {/* Gizlilik Politikası */}
            <TouchableOpacity 
              style={styles.consentItem}
              onPress={() => setPrivacyChecked(!privacyChecked)}
            >
              <View style={[styles.checkbox, lt?.checkbox, privacyChecked && styles.checkboxChecked, privacyChecked && lt?.checkboxChecked]}>
                {privacyChecked && <Ionicons name="checkmark" size={18} color={legalUi.iconOnAccent} />}
              </View>
              <View style={styles.consentTextContainer}>
                <Text style={[styles.consentText, lt?.consentText]}>
                  <Text style={[styles.linkText, lt?.linkText]} onPress={() => setShowPrivacy(true)}>Gizlilik Politikası</Text>
                  {"'nı okudum ve anladım."}
                </Text>
              </View>
            </TouchableOpacity>
            
            {/* Kullanıcı Sözleşmesi */}
            <TouchableOpacity 
              style={styles.consentItem}
              onPress={() => setTermsChecked(!termsChecked)}
            >
              <View style={[styles.checkbox, lt?.checkbox, termsChecked && styles.checkboxChecked, termsChecked && lt?.checkboxChecked]}>
                {termsChecked && <Ionicons name="checkmark" size={18} color={legalUi.iconOnAccent} />}
              </View>
              <View style={styles.consentTextContainer}>
                <Text style={[styles.consentText, lt?.consentText]}>
                  <Text style={[styles.linkText, lt?.linkText]} onPress={() => setShowTerms(true)}>Kullanıcı Sözleşmesi</Text>
                  {"'ni okudum ve kabul ediyorum."}
                </Text>
              </View>
            </TouchableOpacity>
            
            {/* KVKK */}
            <TouchableOpacity 
              style={styles.consentItem}
              onPress={() => setKvkkChecked(!kvkkChecked)}
            >
              <View style={[styles.checkbox, lt?.checkbox, kvkkChecked && styles.checkboxChecked, kvkkChecked && lt?.checkboxChecked]}>
                {kvkkChecked && <Ionicons name="checkmark" size={18} color={legalUi.iconOnAccent} />}
              </View>
              <View style={styles.consentTextContainer}>
                <Text style={[styles.consentText, lt?.consentText]}>
                  <Text style={[styles.linkText, lt?.linkText]} onPress={() => setShowKvkk(true)}>KVKK Aydınlatma Metni</Text>
                  {"'ni okudum ve anladım."}
                </Text>
              </View>
            </TouchableOpacity>
            
            {/* 18+ Yaş Onayı */}
            <TouchableOpacity 
              style={styles.consentItem}
              onPress={() => setAgeChecked(!ageChecked)}
            >
              <View style={[styles.checkbox, lt?.checkbox, ageChecked && styles.checkboxChecked, ageChecked && lt?.checkboxChecked]}>
                {ageChecked && <Ionicons name="checkmark" size={18} color={legalUi.iconOnAccent} />}
              </View>
              <View style={styles.consentTextContainer}>
                <Text style={[styles.consentText, lt?.consentText]}>
                  18 yaşından büyük olduğumu beyan ederim.
                </Text>
              </View>
            </TouchableOpacity>
            
            {/* Sorumluluk Reddi */}
            <View style={[styles.disclaimerBox, lt?.disclaimerBox]}>
              <Ionicons name="warning" size={24} color="#F59E0B" />
              <Text style={styles.disclaimerText}>
                LeylekTAG topluluk odaklı gönüllü yol paylaşımı ve kişi eşleştirme platformudur; taşıma şirketi veya ödeme kuruluşu değildir. Platform tahsilat yapmaz; katkı payı mutabakatı taraflar arasındadır. Yol paylaşımı sırasındaki uyuşmazlıklardan platform sorumlu tutulamaz.
              </Text>
            </View>
          </ScrollView>
          
          <View style={[styles.consentButtons, lt?.consentButtons]}>
            <TouchableOpacity style={[styles.declineButton, lt?.declineButton]} onPress={onDecline}>
              <Text style={[styles.declineButtonText, lt?.declineButtonText]}>Vazgeç</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.acceptButton, !allChecked && styles.acceptButtonDisabled]}
              onPress={allChecked ? onAccept : undefined}
              disabled={!allChecked}
            >
              <LinearGradient
                colors={allChecked ? acceptGradientActive : ['#475569', '#64748B']}
                style={styles.acceptButtonGradient}
              >
                <Ionicons name="checkmark-circle" size={20} color={legalUi.iconOnAccent} />
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
  const { legalModalSurfaces: lt, legalUi } = useSettingsTheme('legal');
  const warningAcceptGradient = [legalUi.accent, legalUi.accentSecondary] as const;

  if (!visible) return null;
  
  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={[styles.modalOverlay, lt?.modalOverlay]}>
        <View style={[styles.warningModal, lt?.warningModal]}>
          <View style={[styles.warningIcon, lt?.warningIcon]}>
            <Ionicons name="location" size={50} color={legalUi.accent} />
          </View>
          
          <Text style={[styles.warningTitle, lt?.warningTitle]}>Konum Paylaşımı</Text>
          
          <Text style={[styles.warningText, lt?.warningText]}>
            LeylekTAG, yol paylaşımı sırasında konumunuzu sürücü/yolcu ile paylaşır. Bu bilgi:
          </Text>
          
          <View style={[styles.warningList, lt?.warningList]}>
            <Text style={[styles.warningListItem, lt?.warningListItem]}>✓ Sadece aktif yolculuk süresince paylaşılır</Text>
            <Text style={[styles.warningListItem, lt?.warningListItem]}>✓ Yolculuk bitince paylaşım durur</Text>
            <Text style={[styles.warningListItem, lt?.warningListItem]}>✓ Konum geçmişi saklanmaz</Text>
          </View>
          
          <View style={styles.warningButtons}>
            <TouchableOpacity style={[styles.warningDeclineBtn, lt?.warningDeclineBtn]} onPress={onDecline}>
              <Text style={[styles.warningDeclineText, lt?.warningDeclineText]}>İzin Verme</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.warningAcceptBtn} onPress={onAccept}>
              <LinearGradient colors={warningAcceptGradient} style={styles.warningAcceptGradient}>
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
