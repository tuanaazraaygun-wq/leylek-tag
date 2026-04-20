import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

type Props = {
  visible: boolean;
  onYes: () => void;
  onNo: () => void;
};

export default function BoardingPassengerPromptModal({ visible, onYes, onNo }: Props) {
  return (
    <Modal visible={visible} animationType="fade" transparent>
      <Pressable style={styles.backdrop} onPress={onNo}>
        <Pressable style={styles.cardWrap} onPress={(e) => e.stopPropagation()}>
          <LinearGradient colors={['#0f172a', '#1e3a5f']} style={styles.card}>
            <Text style={styles.title}>Araca bindiniz mi?</Text>
            <Text style={styles.sub}>
              Güvenliğiniz için yalnızca doğru aracı taradığınızdan emin olun.
            </Text>
            <View style={styles.row}>
              <TouchableOpacity style={[styles.btn, styles.btnNo]} onPress={onNo} activeOpacity={0.85}>
                <Text style={styles.btnNoText}>Hayır</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.btnYes]} onPress={onYes} activeOpacity={0.85}>
                <Text style={styles.btnYesText}>Evet</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  cardWrap: { width: '100%', maxWidth: 400, alignSelf: 'center' },
  card: {
    borderRadius: 16,
    paddingVertical: 22,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.35)',
  },
  title: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  sub: {
    marginTop: 10,
    color: '#cbd5e1',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    marginTop: 22,
  },
  btn: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    minHeight: 48,
    justifyContent: 'center',
    marginHorizontal: 6,
  },
  btnNo: {
    backgroundColor: 'rgba(30,41,59,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.45)',
  },
  btnNoText: { color: '#e2e8f0', textAlign: 'center', fontWeight: '700', fontSize: 16 },
  btnYes: { backgroundColor: '#2563eb', justifyContent: 'center', alignItems: 'center' },
  btnYesText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
