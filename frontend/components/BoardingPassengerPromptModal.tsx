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
import { Ionicons } from '@expo/vector-icons';

type Props = {
  visible: boolean;
  onYes: () => void;
  onNo: () => void;
};

const CARD_BG = 'rgba(16,26,43,0.88)';
const BORDER_SLATE = '#1E3A5F';
const ACCENT_CYAN = '#22D3EE';
const TEXT_PRIMARY = 'rgba(243,248,255,0.94)';
const TEXT_MUTED = 'rgba(186,201,222,0.82)';
const SOFT_DANGER_BG = 'rgba(127,29,29,0.22)';
const SOFT_DANGER_BORDER = 'rgba(248,113,113,0.35)';

export default function BoardingPassengerPromptModal({ visible, onYes, onNo }: Props) {
  return (
    <Modal visible={visible} animationType="fade" transparent>
      <Pressable style={styles.backdrop} onPress={onNo}>
        <Pressable style={styles.cardWrap} onPress={(e) => e.stopPropagation()}>
          <View style={styles.card}>
            <View style={styles.iconRing}>
              <Ionicons name="car-sport-outline" size={26} color={ACCENT_CYAN} />
            </View>
            <Text style={styles.title}>Araca bindiniz mi?</Text>
            <View style={styles.warningPill}>
              <Ionicons
                name="shield-checkmark-outline"
                size={16}
                color="rgba(252,211,77,0.92)"
                style={styles.warningPillIcon}
              />
              <Text style={styles.warningPillText}>Güvenli biniş</Text>
            </View>
            <Text style={styles.sub}>
              Doğru araçta olduğunuzu teyit edin; ardından sürücünün biniş QR kodunu okutun.
            </Text>
            <View style={styles.row}>
              <TouchableOpacity style={styles.btnSecondaryWrap} onPress={onNo} activeOpacity={0.85}>
                <View style={styles.btnSecondary}>
                  <Text style={styles.btnSecondaryText}>Hayır</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnPrimaryWrap} onPress={onYes} activeOpacity={0.88}>
                <LinearGradient
                  colors={['rgba(34,211,238,0.28)', '#0B1220', '#08111F', 'rgba(34,211,238,0.22)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.btnPrimaryGrad}
                >
                  <Text style={styles.btnPrimaryText}>Evet</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2,6,23,0.72)',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  cardWrap: { width: '100%', maxWidth: 400, alignSelf: 'center' },
  card: {
    borderRadius: 20,
    paddingTop: 24,
    paddingBottom: 22,
    paddingHorizontal: 22,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER_SLATE,
    borderTopColor: 'rgba(34,211,238,0.38)',
    borderLeftColor: 'rgba(34,211,238,0.14)',
    shadowColor: '#010818',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.5,
    shadowRadius: 28,
    elevation: 22,
  },
  iconRing: {
    alignSelf: 'center',
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(8,17,31,0.72)',
    borderWidth: 1,
    borderColor: BORDER_SLATE,
    borderTopColor: 'rgba(34,211,238,0.42)',
    marginBottom: 14,
  },
  title: {
    color: TEXT_PRIMARY,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  warningPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: SOFT_DANGER_BG,
    borderWidth: 1,
    borderColor: SOFT_DANGER_BORDER,
  },
  warningPillIcon: {
    marginRight: 6,
  },
  warningPillText: {
    color: 'rgba(253,224,71,0.95)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  sub: {
    marginTop: 14,
    color: TEXT_MUTED,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    marginTop: 24,
  },
  btnSecondaryWrap: { flex: 1, borderRadius: 14, overflow: 'hidden', marginRight: 5 },
  btnSecondary: {
    borderRadius: 14,
    minHeight: 50,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    backgroundColor: 'rgba(8,17,31,0.78)',
    borderWidth: 1,
    borderColor: BORDER_SLATE,
    borderTopColor: 'rgba(148,163,184,0.22)',
  },
  btnSecondaryText: {
    color: TEXT_MUTED,
    textAlign: 'center',
    fontWeight: '800',
    fontSize: 16,
  },
  btnPrimaryWrap: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.45)',
    marginLeft: 5,
  },
  btnPrimaryGrad: {
    minHeight: 50,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  btnPrimaryText: {
    color: TEXT_PRIMARY,
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: 0.3,
  },
});
