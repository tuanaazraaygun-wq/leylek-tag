import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LEGAL_COMPANY_META } from '../lib/legalUxCopy';

interface DriverPackagesModalProps {
  visible: boolean;
  onClose: () => void;
  userId: string;
  onPackagePurchased?: () => void;
}

export default function DriverPackagesModal({
  visible,
  onClose,
}: DriverPackagesModalProps) {
  const openSupportEmail = () => {
    void Linking.openURL(`mailto:${LEGAL_COMPANY_META.email}`).catch(() => {});
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.headerTextCol}>
              <Text style={styles.title}>Sürücü erişimi</Text>
              <Text style={styles.subtitle}>Sürücü erişiminiz şu anda aktif değil.</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityLabel="Kapat">
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            <View style={styles.statusCard}>
              <View style={styles.statusIconWrap}>
                <Ionicons name="shield-outline" size={28} color="#F59E0B" />
              </View>
              <Text style={styles.statusTitle}>Hesap durumu</Text>
              <Text style={styles.statusText}>
                Aktif sürücü erişimi, hesap durumunuza göre tanımlanır. Bu özellik hesap
                durumunuza göre aktif edilir.
              </Text>
            </View>

            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={20} color="#9CA3AF" />
              <Text style={styles.infoText}>
                Aktif sürücü erişimi gerektiğinde destek ekibi size yardımcı olur. Sürücü
                erişiminizi kontrol etmek için destek ekibiyle iletişime geçebilirsiniz.
              </Text>
            </View>

            <TouchableOpacity style={styles.supportBtn} onPress={openSupportEmail} activeOpacity={0.88}>
              <Ionicons name="mail-outline" size={20} color="#FFFFFF" />
              <Text style={styles.supportBtnText}>{LEGAL_COMPANY_META.email}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.dismissBtn} onPress={onClose} activeOpacity={0.88}>
              <Text style={styles.dismissBtnText}>Kapat</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerTextCol: {
    flex: 1,
    paddingRight: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: 'white',
  },
  subtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
    lineHeight: 20,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  body: {
    padding: 16,
    paddingBottom: 30,
  },
  statusCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    alignItems: 'center',
  },
  statusIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: 'white',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 14,
    color: '#9CA3AF',
    lineHeight: 20,
    textAlign: 'center',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  infoText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 13,
    color: '#9CA3AF',
    lineHeight: 18,
  },
  supportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3FA9F5',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
    gap: 8,
  },
  supportBtnText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  dismissBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  dismissBtnText: {
    color: '#9CA3AF',
    fontSize: 15,
    fontWeight: '500',
  },
});
