/**
 * DriverKYCScreen.tsx - Sürücü KYC Kayıt Ekranı
 * Web, Android ve iOS için tam uyumlu
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  TextInput,
  Image,
  ActivityIndicator,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
  FlatList,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { appAlert } from '../contexts/AppAlertContext';
import * as ImagePicker from 'expo-image-picker';
import { EncodingType, readAsStringAsync } from 'expo-file-system/legacy';
import type { AiMockResult, AiTier } from '../lib/driverKycAiMock';
import {
  analyzeLicenseMock,
  analyzeVehicleMock,
  combineAiTier,
  combineAiWarnings,
} from '../lib/driverKycAiMock';

// Türkiye'de popüler araç markaları ve modelleri
const CAR_BRANDS: { [key: string]: string[] } = {
  'Audi': ['A1', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'Q2', 'Q3', 'Q5', 'Q7', 'Q8', 'e-tron', 'TT'],
  'BMW': ['1 Serisi', '2 Serisi', '3 Serisi', '4 Serisi', '5 Serisi', '7 Serisi', 'X1', 'X3', 'X5', 'X7'],
  'Citroen': ['C1', 'C3', 'C4', 'C5', 'Berlingo'],
  'Dacia': ['Sandero', 'Logan', 'Duster', 'Jogger', 'Spring'],
  'Fiat': ['Egea', 'Egea Cross', '500', '500X', 'Panda', 'Tipo', 'Doblo', 'Linea'],
  'Ford': ['Fiesta', 'Focus', 'Mondeo', 'Puma', 'Kuga', 'EcoSport', 'Mustang', 'Ranger', 'Transit'],
  'Honda': ['Civic', 'Accord', 'Jazz', 'HR-V', 'CR-V', 'City'],
  'Hyundai': ['i10', 'i20', 'i30', 'Elantra', 'Tucson', 'Kona', 'Santa Fe', 'Bayon'],
  'Kia': ['Picanto', 'Rio', 'Ceed', 'Sportage', 'Sorento', 'Stonic', 'Niro'],
  'Mercedes-Benz': ['A Serisi', 'B Serisi', 'C Serisi', 'E Serisi', 'S Serisi', 'CLA', 'GLA', 'GLC', 'GLE'],
  'Nissan': ['Micra', 'Juke', 'Qashqai', 'X-Trail', 'Leaf'],
  'Opel': ['Corsa', 'Astra', 'Insignia', 'Crossland', 'Grandland', 'Mokka'],
  'Peugeot': ['208', '308', '408', '508', '2008', '3008', '5008'],
  'Renault': ['Clio', 'Megane', 'Talisman', 'Captur', 'Kadjar', 'Koleos', 'Kangoo', 'Arkana'],
  'Seat': ['Ibiza', 'Leon', 'Arona', 'Ateca', 'Tarraco'],
  'Skoda': ['Fabia', 'Scala', 'Octavia', 'Superb', 'Kamiq', 'Karoq', 'Kodiaq'],
  'Toyota': ['Yaris', 'Yaris Cross', 'Corolla', 'Camry', 'C-HR', 'RAV4', 'Land Cruiser', 'Hilux'],
  'Volkswagen': ['Polo', 'Golf', 'Passat', 'Arteon', 'T-Cross', 'T-Roc', 'Tiguan', 'Touareg'],
  'Volvo': ['XC40', 'XC60', 'XC90', 'S60', 'S90', 'V60', 'V90'],
  'Diğer': [],
};

const CAR_BRAND_OTHER = 'Diğer';

const MOTOR_BRANDS: string[] = [
  'Honda',
  'Yamaha',
  'Kuba',
  'Mondial',
  'RKS',
  'Bajaj',
  'TVS',
  'CF Moto',
  'Benelli',
  'BMW',
  'Vespa',
  'Piaggio',
  'Suzuki',
  'Kawasaki',
  CAR_BRAND_OTHER,
];

type PhotoGuideVariant = 'vehicle' | 'license' | 'motorcycle' | 'selfie';

const PHOTO_GUIDE_BULLETS: Record<PhotoGuideVariant, string[]> = {
  vehicle: [
    'Plaka okunaklı ve net görünsün',
    'Aracın tamamı kadrajda olsun',
    'Tek araç görünsün; gölge ve uzak çekimden kaçının',
    'Gündüz veya iyi aydınlatmada çekin',
  ],
  license: [
    'Ehliyetin dört köşesi kadrajda görünsün',
    'Parlama ve gölge olmasın',
    'Tüm yazılar okunaklı olsun',
    'Belgeyi düz tutarak çekin',
  ],
  motorcycle: [
    'Motor tamamı kadrajda görünsün',
    'Plaka varsa net ve okunaklı olsun',
    'Tek motor görünsün; arka plan sade olsun',
    'İyi aydınlatmada çekin',
  ],
  selfie: [
    'Yüzünüz net ve tam görünsün',
    'Maske veya güneş gözlüğü olmasın',
    'Aydınlık ortamda çekin',
    'Ehliyetinizdeki fotoğrafla aynı kişi olduğunuz anlaşılsın',
  ],
};

function resolveKycBrandModel(
  vehicleBrand: string,
  vehicleModel: string,
  customBrandName: string,
  customModelName: string,
): { brand: string; model: string } {
  if (vehicleBrand === CAR_BRAND_OTHER) {
    return { brand: customBrandName.trim(), model: customModelName.trim() };
  }
  return { brand: vehicleBrand.trim(), model: vehicleModel.trim() };
}

// Araç Renkleri
const CAR_COLORS = [
  { name: 'Beyaz', code: '#FFFFFF', border: '#CCCCCC' },
  { name: 'Siyah', code: '#1A1A1A', border: '#1A1A1A' },
  { name: 'Gri', code: '#808080', border: '#808080' },
  { name: 'Gümüş', code: '#C0C0C0', border: '#A0A0A0' },
  { name: 'Kırmızı', code: '#DC2626', border: '#DC2626' },
  { name: 'Bordo', code: '#7F1D1D', border: '#7F1D1D' },
  { name: 'Mavi', code: '#2563EB', border: '#2563EB' },
  { name: 'Lacivert', code: '#1E3A5F', border: '#1E3A5F' },
  { name: 'Yeşil', code: '#16A34A', border: '#16A34A' },
  { name: 'Sarı', code: '#EAB308', border: '#CA8A04' },
  { name: 'Turuncu', code: '#EA580C', border: '#EA580C' },
  { name: 'Kahverengi', code: '#78350F', border: '#78350F' },
  { name: 'Bej', code: '#D4C4A8', border: '#B8A888' },
  { name: 'Mor', code: '#7C3AED', border: '#7C3AED' },
  { name: 'Pembe', code: '#EC4899', border: '#EC4899' },
];

/** Yerel premium KYC yüzeyleri — global Colors dosyası değiştirilmeden. */
const KYC_P = {
  bg: '#08111F',
  bgElev: '#0B1220',
  bgPanel: '#101A2B',
  card: 'rgba(16, 26, 43, 0.88)',
  border: '#1E3A5F',
  cyan: '#22D3EE',
  textHi: 'rgba(243, 248, 255, 0.94)',
  textMd: 'rgba(186, 201, 222, 0.82)',
} as const;

const KYC_REJECTED_FALLBACK_REASON = 'Belgeler uygun bulunmadı.';

function KycRejectedBanner({ reason }: { reason: string }) {
  return (
    <View style={kycRejectedBannerStyles.wrap}>
      <Ionicons name="close-circle" size={22} color="#FCA5A5" style={kycRejectedBannerStyles.icon} />
      <View style={kycRejectedBannerStyles.textCol}>
        <Text style={kycRejectedBannerStyles.title}>Başvurunuz reddedildi</Text>
        <Text style={kycRejectedBannerStyles.reason}>Sebep: {reason}</Text>
        <Text style={kycRejectedBannerStyles.hint}>Lütfen bilgileri düzeltip tekrar gönderin.</Text>
      </View>
    </View>
  );
}

const kycRejectedBannerStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
    padding: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(127, 29, 37, 0.35)',
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.38)',
  },
  icon: {
    marginTop: 2,
  },
  textCol: {
    flex: 1,
    gap: 6,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: 'rgba(254, 226, 226, 0.96)',
    letterSpacing: -0.2,
  },
  reason: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(253, 213, 213, 0.92)',
    lineHeight: 20,
  },
  hint: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(252, 165, 165, 0.88)',
    lineHeight: 18,
  },
});

interface DriverKYCScreenProps {
  userId: string;
  userName: string;
  onBack: () => void;
  onSuccess: () => void;
  apiUrl: string;
  /** Rol ekranından: araç veya motor KYC akışı (ayrılmış) */
  vehicleKind?: 'car' | 'motorcycle';
}

type PhotoPickKind = 'vehicle' | 'license' | 'motorcycle' | 'selfie';

function kycImageMimeFromAsset(asset: ImagePicker.ImagePickerAsset): string {
  const m = asset.mimeType;
  if (typeof m === 'string' && m.startsWith('image/')) return m;
  if (asset.type === 'image') return 'image/jpeg';
  return 'image/jpeg';
}

const CAR_STEP_TITLES = ['Araç bilgileri', 'Araç fotoğrafı', 'Ehliyet', 'Özet', 'Başvuru'];
const MOTOR_STEP_TITLES = ['Motor bilgileri', 'Motor fotoğrafı', 'Ehliyet', 'Selfie', 'Başvuru'];

/** KYC submit yanıt gövdesi: JSON değilse veya boşsa anlamlı hata (proxy HTML / 413 vb.). */
function parseKycSubmitResponseJson(raw: string, httpStatus: number, contentType: string | null): unknown {
  const trimmed = raw.replace(/^\uFEFF/, '').trim();
  if (!trimmed.length) {
    throw new Error(
      `Sunucu boş yanıt döndü (HTTP ${httpStatus}). Bağlantı veya zaman aşımı olabilir; tekrar deneyin.`,
    );
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    const flat = trimmed.replace(/\s+/g, ' ');
    const snippet = flat.length > 220 ? `${flat.slice(0, 220)}…` : flat;
    const ct = contentType || '';
    const looks413 =
      httpStatus === 413 ||
      /request entity too large|payload too large|413/i.test(flat) ||
      /too large|çok büyük/i.test(flat);
    const hint = looks413
      ? ' Büyük ihtimalle fotoğraflar istek boyutu limitini aşıyor; kamera kalitesini düşürüp tekrar deneyin.'
      : !/application\/json/i.test(ct) && /<\s*html[\s>]/i.test(trimmed)
        ? ' Sunucu JSON yerine HTML döndü (CDN / proxy / bakım sayfası).'
        : '';
    throw new Error(
      `Sunucu yanıtı JSON olarak okunamadı (HTTP ${httpStatus}).${hint} Özet: ${snippet}`,
    );
  }
}

const KYC_SAME_KIND_APPROVED_LEGACY = 'Bu araç tipi için zaten onaylı sürücüsünüz.';
const KYC_SAME_KIND_APPROVED_CANONICAL =
  'Bu araç tipi için zaten onaylı sürücü kaydınız bulunuyor.';

/** Aynı tür için tekrar başvuru: API eski/imzalı metni dönerse bile tek metne çevir. */
function normalizeKycSameKindAlreadyApproved(msg: string): string {
  const t = msg.trim();
  if (t === KYC_SAME_KIND_APPROVED_LEGACY || t === KYC_SAME_KIND_APPROVED_CANONICAL) {
    return KYC_SAME_KIND_APPROVED_CANONICAL;
  }
  return t;
}

/** FastAPI: detail string | dizi; özel cevaplarda message. */
function pickKycSubmitErrorMessage(data: unknown, httpStatus: number): string {
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>;
    if (typeof d.message === 'string' && d.message.trim())
      return normalizeKycSameKindAlreadyApproved(d.message.trim());
    const detail = d.detail;
    if (typeof detail === 'string' && detail.trim())
      return normalizeKycSameKindAlreadyApproved(detail.trim());
    if (Array.isArray(detail)) {
      const parts = detail.map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') {
          const o = item as Record<string, unknown>;
          if (typeof o.msg === 'string') return o.msg;
          if (typeof o.message === 'string') return o.message;
        }
        return '';
      });
      const t = parts.filter(Boolean).join(' — ');
      if (t) return t;
    }
    if (typeof d.error === 'string' && d.error.trim())
      return normalizeKycSameKindAlreadyApproved(d.error.trim());
  }
  if (httpStatus === 413) {
    return 'İstek çok büyük (413). Fotoğrafları daha düşük çözünürlükte yükleyin.';
  }
  if (httpStatus >= 500) {
    return `Sunucu hatası (HTTP ${httpStatus}). Lütfen bir süre sonra tekrar deneyin.`;
  }
  return 'Başvuru gönderilemedi';
}

/** Önizleme + yeniden seçim CTA; onReplacePhoto = galeri/web dosya akışı (native kırpma yok). */
function PhotoCropHintAndPreview({ uri, onReplacePhoto }: { uri: string; onReplacePhoto: () => void }) {
  return (
    <View style={photoHeroStyles.previewColumn}>
      <Text style={photoHeroStyles.cropGuide}>
        Önizlemeyi kontrol edin. Kadrajı beğenmediyseniz yeniden seçin.
      </Text>
      <View style={photoHeroStyles.previewFrame}>
        <Image
          source={{ uri }}
          style={photoHeroStyles.previewImage}
          resizeMode="cover"
          {...(Platform.OS === 'android' ? { fadeDuration: 0 } : {})}
        />
      </View>
      <TouchableOpacity
        style={photoHeroStyles.cropBarOuter}
        onPress={onReplacePhoto}
        activeOpacity={0.9}
        accessibilityRole="button"
        accessibilityLabel="Fotoğrafı değiştir"
      >
        <LinearGradient
          colors={['rgba(8, 36, 52, 0.95)', '#0E7490', KYC_P.cyan]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={photoHeroStyles.cropBarGradient}
        >
          <Ionicons name="camera-outline" size={22} color="#FFFFFF" />
          <Text style={photoHeroStyles.cropBarTitle}>Kamera ile yeniden çek</Text>
        </LinearGradient>
      </TouchableOpacity>
      <Text style={photoHeroStyles.cropBarHint}>
        {Platform.OS === 'web'
          ? 'Dosyayı yeniden seçerek güncelleyebilirsiniz.'
          : 'Yeniden çekmek için kamerayı kullanın; galeri için alttaki Değiştir (galeri) seçeneğini kullanın.'}
      </Text>
    </View>
  );
}

function PhotoHeroActions({
  onRetake,
  onReplace,
  onClear,
}: {
  onRetake: () => void;
  onReplace: () => void;
  onClear: () => void;
}) {
  return (
    <View style={photoHeroStyles.wrap}>
      <View style={photoHeroStyles.row2}>
        <TouchableOpacity style={photoHeroStyles.pill} onPress={onRetake} activeOpacity={0.88}>
          <Ionicons name="camera-outline" size={18} color={KYC_P.cyan} />
          <Text style={photoHeroStyles.pillText}>Yeniden çek</Text>
        </TouchableOpacity>
        <TouchableOpacity style={photoHeroStyles.pill} onPress={onReplace} activeOpacity={0.88}>
          <Ionicons name="images-outline" size={18} color={KYC_P.cyan} />
          <Text style={photoHeroStyles.pillText}>Galeriden seç</Text>
        </TouchableOpacity>
        <TouchableOpacity style={photoHeroStyles.pillGhost} onPress={onClear} activeOpacity={0.88}>
          <Text style={photoHeroStyles.pillGhostText}>Kaldır</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const photoHeroStyles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  previewColumn: {
    marginBottom: 10,
  },
  cropGuide: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(34, 211, 238, 0.88)',
    marginBottom: 8,
    lineHeight: 17,
    letterSpacing: 0.1,
  },
  previewFrame: {
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: KYC_P.border,
    backgroundColor: KYC_P.bgElev,
    shadowColor: '#010818',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 8,
  },
  previewImage: {
    width: '100%',
    aspectRatio: 4 / 3,
    minHeight: 232,
    backgroundColor: KYC_P.bgPanel,
    opacity: 1,
  },
  cropBarOuter: {
    marginTop: 12,
    borderRadius: 16,
    overflow: 'hidden',
    alignSelf: 'stretch',
    shadowColor: '#010818',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 6,
  },
  cropBarGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.35)',
  },
  cropBarTitle: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  cropBarHint: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(186, 201, 222, 0.78)',
    lineHeight: 15,
    textAlign: 'center',
  },
  row2: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(16,26,43,0.72)',
    borderWidth: 1,
    borderColor: KYC_P.border,
  },
  pillText: { color: KYC_P.textHi, fontSize: 13, fontWeight: '700' },
  pillGhost: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(30, 58, 95, 0.65)',
    backgroundColor: 'rgba(16,26,43,0.45)',
  },
  pillGhostText: { color: KYC_P.textMd, fontSize: 13, fontWeight: '700' },
});

const photoGuideStyles = StyleSheet.create({
  wrap: {
    marginBottom: 14,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.22)',
    backgroundColor: 'rgba(16, 26, 43, 0.55)',
  },
  title: {
    fontSize: 13,
    fontWeight: '800',
    color: KYC_P.cyan,
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 6,
  },
  icon: {
    marginTop: 2,
  },
  text: {
    flex: 1,
    fontSize: 13,
    color: KYC_P.textMd,
    lineHeight: 18,
  },
});

const emptyPhotoStyles = StyleSheet.create({
  cardOuter: {
    borderRadius: 24,
    marginBottom: 2,
    shadowColor: '#010818',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 8,
  },
  wrapCol: { marginBottom: 6 },
  pressWrap: {
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: KYC_P.border,
    borderStyle: 'dashed',
    backgroundColor: 'rgba(16,26,43,0.55)',
  },
  pressWrapActive: {
    opacity: 0.94,
    transform: [{ scale: 0.987 }],
    borderColor: 'rgba(34,211,238,0.42)',
  },
  cardFace: {
    paddingVertical: 34,
    paddingHorizontal: 22,
    alignItems: 'center',
  },
  iconRing: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: 'rgba(34,211,238,0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(34,211,238,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  headline: {
    fontSize: 21,
    fontWeight: '800',
    color: KYC_P.textHi,
    letterSpacing: -0.5,
    marginBottom: 8,
    textAlign: 'center',
  },
  hint: {
    fontSize: 14,
    color: KYC_P.textMd,
    lineHeight: 21,
    textAlign: 'center',
    maxWidth: 320,
    marginBottom: 14,
    fontWeight: '600',
  },
  aiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(16,26,43,0.65)',
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.16)',
  },
  aiRowText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: KYC_P.textMd,
    lineHeight: 17,
  },
  primaryLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    paddingVertical: 13,
    paddingHorizontal: 22,
    borderRadius: 14,
    backgroundColor: 'rgba(34,211,238,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.22)',
  },
  primaryLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: KYC_P.textHi,
    letterSpacing: 0.2,
  },
  secondaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    gap: 6,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(16,26,43,0.72)',
    borderWidth: 1,
    borderColor: KYC_P.border,
  },
  secondaryBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: 'rgba(34,211,238,0.92)',
  },
  secondarySep: {
    width: 1,
    height: 18,
    backgroundColor: KYC_P.border,
    marginHorizontal: 4,
  },
  webHintBelow: {
    marginTop: 12,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(186,201,222,0.68)',
  },
  uploadedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    alignSelf: 'stretch',
    marginBottom: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(16,52,46,0.42)',
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.28)',
    shadowColor: '#010818',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  uploadedBarTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: 'rgba(167,243,208,0.95)',
  },
  uploadedBarSep: {
    fontSize: 14,
    color: 'rgba(167,243,208,0.55)',
    fontWeight: '700',
  },
  uploadedAiChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(34,211,238,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.22)',
  },
  uploadedAiChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(34,211,238,0.88)',
    letterSpacing: 0.3,
  },
});

function PhotoCaptureGuide({ variant }: { variant: PhotoGuideVariant }) {
  const bullets = PHOTO_GUIDE_BULLETS[variant];
  return (
    <View style={photoGuideStyles.wrap}>
      <Text style={photoGuideStyles.title}>Çekim rehberi</Text>
      {bullets.map((line) => (
        <View key={line} style={photoGuideStyles.row}>
          <Ionicons name="checkmark-circle-outline" size={16} color={KYC_P.cyan} style={photoGuideStyles.icon} />
          <Text style={photoGuideStyles.text}>{line}</Text>
        </View>
      ))}
    </View>
  );
}

function EmptyPhotoAddCard({
  hint,
  webMode,
  onWebPick,
  onPickGallery,
  onPickCamera,
}: {
  hint: string;
  webMode: boolean;
  onWebPick: () => void;
  onPickGallery: () => void;
  onPickCamera: () => void;
}) {
  const body = (
    <>
      <View style={emptyPhotoStyles.iconRing}>
        <Ionicons name="camera" size={46} color={KYC_P.cyan} />
      </View>
      <Text style={emptyPhotoStyles.headline}>{webMode ? 'Fotoğraf ekle' : 'Kamera ile çek'}</Text>
      <Text style={emptyPhotoStyles.hint}>{hint}</Text>
      <View style={emptyPhotoStyles.aiRow}>
        <Ionicons name="sparkles" size={16} color={KYC_P.cyan} />
        <Text style={emptyPhotoStyles.aiRowText}>
          {webMode
            ? 'Dosya seçildiğinde güvenli yükleme ve otomatik ön kontrol başlar.'
            : 'Kamera ile çekin — yükleme sonrası ön kontrol otomatik çalışır.'}
        </Text>
      </View>
      <View style={emptyPhotoStyles.primaryLabelRow}>
        <Text style={emptyPhotoStyles.primaryLabel}>{webMode ? 'Dosya seç' : 'Kamera ile çek'}</Text>
        <Ionicons name={webMode ? 'cloud-upload-outline' : 'camera'} size={22} color={KYC_P.cyan} />
      </View>
    </>
  );

  if (webMode) {
    return (
      <View style={emptyPhotoStyles.wrapCol}>
        <View style={emptyPhotoStyles.cardOuter}>
          <Pressable
            onPress={onWebPick}
            accessibilityRole="button"
            accessibilityLabel="Fotoğraf ekle"
            style={({ pressed, hovered }) => [
              emptyPhotoStyles.pressWrap,
              (pressed || Boolean(hovered)) && emptyPhotoStyles.pressWrapActive,
            ]}
          >
            <LinearGradient
              colors={['rgba(16,26,43,0.96)', 'rgba(11,18,32,0.98)', '#08111F']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={emptyPhotoStyles.cardFace}
            >
              {body}
            </LinearGradient>
          </Pressable>
        </View>
        <Text style={emptyPhotoStyles.webHintBelow}>İsterseniz aynı kartı tekrar dokunarak dosyayı değiştirebilirsiniz.</Text>
      </View>
    );
  }

  return (
    <View style={emptyPhotoStyles.wrapCol}>
      <View style={emptyPhotoStyles.cardOuter}>
        <Pressable
          onPress={() => void onPickCamera()}
          accessibilityRole="button"
          accessibilityLabel="Kamera ile fotoğraf çek"
          style={({ pressed, hovered }) => [
            emptyPhotoStyles.pressWrap,
            (pressed || Boolean(hovered)) && emptyPhotoStyles.pressWrapActive,
          ]}
        >
          <LinearGradient
            colors={['rgba(16,26,43,0.96)', 'rgba(11,18,32,0.98)', '#08111F']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={emptyPhotoStyles.cardFace}
          >
            {body}
          </LinearGradient>
        </Pressable>
      </View>
      <View style={emptyPhotoStyles.secondaryRow}>
        <TouchableOpacity style={emptyPhotoStyles.secondaryBtn} onPress={() => void onPickGallery()} activeOpacity={0.82}>
          <Ionicons name="images-outline" size={18} color={KYC_P.cyan} />
          <Text style={emptyPhotoStyles.secondaryBtnText}>Galeriden seç</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

type KycRoadmapStatus = 'done' | 'active' | 'upcoming' | 'future';

function KycLegalCheckboxRow({
  checked,
  onToggle,
  children,
}: {
  checked: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.termsRow}>
      <TouchableOpacity
        onPress={onToggle}
        activeOpacity={0.82}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <View style={[styles.termsBox, checked && styles.termsBoxChecked]}>
          {checked ? <Ionicons name="checkmark" size={16} color="#FFF" /> : null}
        </View>
      </TouchableOpacity>
      <Text style={styles.termsText}>{children}</Text>
    </View>
  );
}

function KycLegalConsentGroup({
  kvkkAcknowledged,
  termsRulesAccepted,
  onToggleKvkk,
  onToggleTerms,
  onOpenKvkk,
  onOpenTermsDriver,
  onOpenIdentityVerification,
}: {
  kvkkAcknowledged: boolean;
  termsRulesAccepted: boolean;
  onToggleKvkk: () => void;
  onToggleTerms: () => void;
  onOpenKvkk: () => void;
  onOpenTermsDriver: () => void;
  onOpenIdentityVerification: () => void;
}) {
  return (
    <View style={styles.legalConsentGroup}>
      <KycLegalCheckboxRow checked={kvkkAcknowledged} onToggle={onToggleKvkk}>
        <Text style={styles.termsLink} onPress={onOpenKvkk}>
          KVKK Aydınlatma Metni
        </Text>
        <Text>&apos;ni okudum ve anladım.</Text>
      </KycLegalCheckboxRow>
      <KycLegalCheckboxRow checked={termsRulesAccepted} onToggle={onToggleTerms}>
        <Text style={styles.termsLink} onPress={onOpenTermsDriver}>
          Sürücü Sözleşmesi
        </Text>
        <Text> ve sürücü kurallarını okudum, kabul ediyorum.</Text>
      </KycLegalCheckboxRow>
      <Pressable
        onPress={onOpenIdentityVerification}
        style={({ pressed }) => [styles.identityInfoLink, pressed && { opacity: 0.85 }]}
        accessibilityRole="link"
        accessibilityLabel="Kimlik doğrulama bilgilendirmesi"
      >
        <Ionicons name="information-circle-outline" size={16} color={KYC_P.cyan} />
        <Text style={styles.termsLink}>Kimlik doğrulama bilgilendirmesi</Text>
        <Ionicons name="chevron-forward" size={14} color={KYC_P.cyan} />
      </Pressable>
    </View>
  );
}

function KycIntroCard({ userName }: { userName: string }) {
  const greeting = userName.trim() ? `${userName.trim()}, ` : '';
  return (
    <View style={styles.kycIntroCard}>
      <LinearGradient
        colors={['rgba(34,211,238,0.14)', 'rgba(16,26,43,0.92)', 'rgba(11,18,32,0.98)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.kycIntroGradient}
      >
        <View style={styles.kycIntroBadgeRow}>
          <View style={styles.kycIntroBadge}>
            <Ionicons name="shield-checkmark" size={14} color={KYC_P.cyan} />
            <Text style={styles.kycIntroBadgeText}>Güven rozeti</Text>
          </View>
          <View style={styles.kycIntroBadgeMuted}>
            <Text style={styles.kycIntroBadgeMutedText}>Gönüllü yol paylaşımı</Text>
          </View>
        </View>
        <Text style={styles.kycIntroTitle}>Onaylı sürücü profili</Text>
        <Text style={styles.kycIntroLead}>
          {greeting}Telefon doğrulaman tamamlandı. Sürücü başvurusu için belge ve güven adımlarını tamamla.
        </Text>
        <Text style={styles.kycIntroBody}>
          LeylekTAG bir taşıma şirketi veya taksi hizmeti değildir; güvenli yol paylaşımı ve kişi eşleştirme
          platformudur. Kimlik doğrulama, profil güven rozeti ve topluluk güvenliği içindir — resmi devlet
          onayı veya sabıka kaydı kontrolü yapılmaz.
        </Text>
      </LinearGradient>
    </View>
  );
}

function KycRoadmapPanel({
  step,
  isMotorKyc,
  licenseDocReady,
  vehicleDocReady,
  kvkkAcknowledged,
  termsRulesAccepted,
}: {
  step: number;
  isMotorKyc: boolean;
  licenseDocReady: boolean;
  vehicleDocReady: boolean;
  kvkkAcknowledged: boolean;
  termsRulesAccepted: boolean;
}) {
  const vehicleLabel = isMotorKyc ? 'Motor / plaka bilgileri' : 'Araç / plaka / ruhsat bilgileri';

  const resolveStatus = (id: string): KycRoadmapStatus => {
    switch (id) {
      case 'phone':
        return 'done';
      case 'identity':
      case 'liveness':
        return 'future';
      case 'vehicle':
        if (step > 1 && vehicleDocReady) return 'done';
        if (step === 0 || step === 1) return 'active';
        return 'upcoming';
      case 'license':
        if (step > 2 && licenseDocReady) return 'done';
        if (step === 2) return 'active';
        return 'upcoming';
      case 'legal':
        if (step === 4) return termsRulesAccepted ? 'done' : 'active';
        return 'upcoming';
      case 'kvkk':
        if (step === 4) return kvkkAcknowledged ? 'done' : 'active';
        return 'upcoming';
      case 'review':
        return 'upcoming';
      default:
        return 'upcoming';
    }
  };

  const items: { id: string; label: string; hint?: string }[] = [
    { id: 'phone', label: 'Telefon doğrulama' },
    { id: 'identity', label: 'Kimlik doğrulama', hint: 'NFC/OCR destekli — yakında' },
    { id: 'liveness', label: 'Canlı selfie / yüz eşleşmesi', hint: 'Yakında' },
    { id: 'license', label: 'Ehliyet' },
    { id: 'vehicle', label: vehicleLabel },
    { id: 'legal', label: 'Sürücü sözleşmesi' },
    { id: 'kvkk', label: 'KVKK Aydınlatma / gerekli izinler' },
    { id: 'review', label: 'Manuel inceleme' },
  ];

  const statusIcon = (status: KycRoadmapStatus): { name: keyof typeof Ionicons.glyphMap; color: string } => {
    if (status === 'done') return { name: 'checkmark-circle', color: 'rgba(110,231,183,0.92)' };
    if (status === 'active') return { name: 'ellipse', color: KYC_P.cyan };
    if (status === 'future') return { name: 'time-outline', color: 'rgba(186,201,222,0.55)' };
    return { name: 'ellipse-outline', color: 'rgba(186,201,222,0.35)' };
  };

  return (
    <View style={styles.kycRoadmapCard}>
      <Text style={styles.kycRoadmapEyebrow}>Başvuru yol haritası</Text>
      {items.map((item, idx) => {
        const status = resolveStatus(item.id);
        const icon = statusIcon(status);
        const isLast = idx === items.length - 1;
        return (
          <View key={item.id} style={[styles.kycRoadmapRow, isLast && styles.kycRoadmapRowLast]}>
            <View style={styles.kycRoadmapIconCol}>
              <Ionicons name={icon.name} size={status === 'active' ? 12 : 18} color={icon.color} />
              {!isLast ? <View style={styles.kycRoadmapConnector} /> : null}
            </View>
            <View style={styles.kycRoadmapTextCol}>
              <Text
                style={[
                  styles.kycRoadmapLabel,
                  status === 'done' && styles.kycRoadmapLabelDone,
                  status === 'active' && styles.kycRoadmapLabelActive,
                  status === 'future' && styles.kycRoadmapLabelFuture,
                ]}
              >
                {item.label}
                {status === 'done' ? ' ✓' : ''}
              </Text>
              {item.hint ? <Text style={styles.kycRoadmapHint}>{item.hint}</Text> : null}
              {status === 'active' && item.id !== 'legal' && item.id !== 'kvkk' ? (
                <Text style={styles.kycRoadmapActiveChip}>Bu adımdasın</Text>
              ) : null}
            </View>
          </View>
        );
      })}
      <View style={styles.kycTrustLayersNote}>
        <Ionicons name="layers-outline" size={15} color="rgba(34,211,238,0.75)" />
        <Text style={styles.kycTrustLayersText}>
          Kimlik NFC/OCR ve canlılık doğrulaması güven katmanları olarak sonraki sürümde eklenecektir; şu an
          belge yükleme ve manuel inceleme geçerlidir.
        </Text>
      </View>
    </View>
  );
}

function KycDriverResponsibilityNote() {
  return (
    <View style={styles.kycResponsibilityCard}>
      <Ionicons name="information-circle-outline" size={20} color="rgba(34,211,238,0.85)" />
      <View style={styles.kycResponsibilityTextCol}>
        <Text style={styles.kycResponsibilityLine}>
          Sürücü, paylaştığı belge ve bilgilerin doğruluğundan sorumludur.
        </Text>
        <Text style={styles.kycResponsibilityLine}>
          LeylekTAG platform tahsilatı yapmaz; yol paylaşımı katkı payı taraflar arasındadır.
        </Text>
      </View>
    </View>
  );
}

function PhotoUploadedStatusBar() {
  return (
    <View style={emptyPhotoStyles.uploadedBar}>
      <Ionicons name="checkmark-circle" size={20} color="rgba(110,231,183,0.92)" />
      <Text style={emptyPhotoStyles.uploadedBarTitle}>Yüklendi</Text>
      <Text style={emptyPhotoStyles.uploadedBarSep}>·</Text>
      <View style={emptyPhotoStyles.uploadedAiChip}>
        <Ionicons name="sparkles" size={13} color={KYC_P.cyan} />
        <Text style={emptyPhotoStyles.uploadedAiChipText}>Ön kontrol</Text>
      </View>
    </View>
  );
}

function AiResultCard({ result, subtitle }: { result: AiMockResult; subtitle?: string }) {
  const palette: Record<
    AiTier,
    {
      bg: string;
      border: string;
      accent: string;
      chipBg: string;
      titleColor: string;
      bodyColor: string;
      icon: keyof typeof Ionicons.glyphMap;
    }
  > = {
    green: {
      bg: 'rgba(16, 26, 43, 0.92)',
      border: 'rgba(52, 211, 153, 0.35)',
      accent: 'rgba(110, 231, 183, 0.92)',
      chipBg: 'rgba(34, 211, 238, 0.1)',
      titleColor: 'rgba(243, 248, 255, 0.94)',
      bodyColor: 'rgba(186, 201, 222, 0.88)',
      icon: 'checkmark-circle',
    },
    yellow: {
      bg: 'rgba(16, 26, 43, 0.92)',
      border: 'rgba(251, 191, 36, 0.32)',
      accent: 'rgba(253, 224, 71, 0.88)',
      chipBg: 'rgba(251, 191, 36, 0.1)',
      titleColor: 'rgba(243, 248, 255, 0.94)',
      bodyColor: 'rgba(186, 201, 222, 0.85)',
      icon: 'alert-circle',
    },
    red: {
      bg: 'rgba(42, 24, 28, 0.88)',
      border: 'rgba(248, 113, 113, 0.38)',
      accent: '#FECACA',
      chipBg: 'rgba(248, 113, 113, 0.12)',
      titleColor: 'rgba(243, 248, 255, 0.94)',
      bodyColor: 'rgba(253, 213, 213, 0.88)',
      icon: 'close-circle',
    },
  };
  const c = palette[result.status];
  const chipLabel =
    result.status === 'green' ? 'Uygun' : result.status === 'yellow' ? 'İnceleme önerilir' : 'Düzeltme gerekli';
  return (
    <View style={[aiCardStyles.wrap, { backgroundColor: c.bg, borderColor: c.border }]}>
      <View style={aiCardStyles.panelHeader}>
        <View style={[aiCardStyles.chip, { backgroundColor: c.chipBg }]}>
          <Ionicons name={c.icon} size={16} color={c.accent} />
          <Text style={[aiCardStyles.chipText, { color: c.accent }]}>{chipLabel}</Text>
        </View>
        <Text style={aiCardStyles.panelEyebrow}>AI kalite kontrolü</Text>
      </View>
      {subtitle ? <Text style={[aiCardStyles.sub, { color: c.accent }]}>{subtitle}</Text> : null}
      <Text style={[aiCardStyles.title, { color: c.titleColor }]}>{result.title}</Text>
      {result.messages.map((m, idx) => (
        <View key={idx} style={aiCardStyles.lineRow}>
          <Ionicons name="ellipse" size={6} color={c.accent} style={aiCardStyles.lineBullet} />
          <Text style={[aiCardStyles.line, { color: c.bodyColor }]}>{m}</Text>
        </View>
      ))}
      <Text style={aiCardStyles.footnote}>Ön kontrol şu an demo modunda; son karar her zaman insandan.</Text>
    </View>
  );
}

const aiCardStyles = StyleSheet.create({
  wrap: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginTop: 14,
    shadowColor: '#010818',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 4,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.18)',
  },
  chipText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.2 },
  panelEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(34, 211, 238, 0.75)',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  sub: { fontSize: 12, fontWeight: '700', marginBottom: 6 },
  title: { fontSize: 16, fontWeight: '800', marginBottom: 10, lineHeight: 22 },
  lineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  lineBullet: { marginTop: 6 },
  line: { flex: 1, fontSize: 13, lineHeight: 19 },
  footnote: {
    marginTop: 12,
    fontSize: 11,
    color: 'rgba(186, 201, 222, 0.68)',
    lineHeight: 16,
    fontStyle: 'italic',
  },
});

export default function DriverKYCScreen({
  userId,
  userName,
  onBack,
  onSuccess,
  apiUrl,
  vehicleKind = 'car',
}: DriverKYCScreenProps) {
  const isMotorKyc = vehicleKind === 'motorcycle';
  const [plateNumber, setPlateNumber] = useState('');
  const [vehicleBrand, setVehicleBrand] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleYear, setVehicleYear] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [vehiclePhoto, setVehiclePhoto] = useState<string | null>(null);
  const [licensePhoto, setLicensePhoto] = useState<string | null>(null);
  const [motorcyclePhoto, setMotorcyclePhoto] = useState<string | null>(null);
  const [selfiePhoto, setSelfiePhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitStatus, setSubmitStatus] = useState('');
  const [kvkkAcknowledged, setKvkkAcknowledged] = useState(false);
  const [termsRulesAccepted, setTermsRulesAccepted] = useState(false);
  const termsAccepted = kvkkAcknowledged && termsRulesAccepted;
  const router = useRouter();
  const openKycLegalRoute = (route: '/kvkk' | '/terms-driver' | '/identity-verification') => {
    router.push(route as never);
  };
  const [customBrandName, setCustomBrandName] = useState('');
  const [customModelName, setCustomModelName] = useState('');
  
  // Marka arama
  const [brandSearch, setBrandSearch] = useState('');
  const [showBrandModal, setShowBrandModal] = useState(false);
  const [showModelModal, setShowModelModal] = useState(false);

  const [step, setStep] = useState(0);
  const [vehicleAi, setVehicleAi] = useState<AiMockResult | null>(null);
  const [licenseAi, setLicenseAi] = useState<AiMockResult | null>(null);
  const [analyzingVehicle, setAnalyzingVehicle] = useState(false);
  const [analyzingLicense, setAnalyzingLicense] = useState(false);
  const [kycRejectionReason, setKycRejectionReason] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `${apiUrl}/driver/kyc/status?user_id=${encodeURIComponent(userId)}`,
        );
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          kyc_status?: string;
          rejection_reason?: string | null;
        };
        if (cancelled) return;
        if (String(data.kyc_status || '').trim().toLowerCase() === 'rejected') {
          const reason = String(data.rejection_reason || '').trim();
          setKycRejectionReason(reason || KYC_REJECTED_FALLBACK_REASON);
        } else {
          setKycRejectionReason(null);
        }
      } catch {
        /* status fetch best-effort */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiUrl, userId]);

  const stepTitles = isMotorKyc ? MOTOR_STEP_TITLES : CAR_STEP_TITLES;
  const carBrandIsOther = !isMotorKyc && vehicleBrand === CAR_BRAND_OTHER;
  const motorBrandIsOther = isMotorKyc && vehicleBrand === CAR_BRAND_OTHER;
  const resolvedCar = resolveKycBrandModel(vehicleBrand, vehicleModel, customBrandName, customModelName);
  const resolvedMotor = resolveKycBrandModel(vehicleBrand, vehicleModel, customBrandName, customModelName);

  const sortBrandOtherLast = (a: string, b: string) => {
    if (a === CAR_BRAND_OTHER) return 1;
    if (b === CAR_BRAND_OTHER) return -1;
    return a.localeCompare(b, 'tr');
  };

  // Filtrelenmiş markalar (araç veya motor listesi)
  const filteredBrandList = useMemo(() => {
    const brands = isMotorKyc
      ? [...MOTOR_BRANDS].sort(sortBrandOtherLast)
      : Object.keys(CAR_BRANDS).sort(sortBrandOtherLast);
    if (!brandSearch) return brands;
    return brands.filter((b) => b.toLowerCase().includes(brandSearch.toLowerCase()));
  }, [brandSearch, isMotorKyc]);

  // Seçili markanın modelleri
  const availableModels = useMemo(() => {
    return CAR_BRANDS[vehicleBrand] || [];
  }, [vehicleBrand]);

  // Web'de dosya seçimi
  const handleWebFileSelect = (type: PhotoPickKind) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (file) {
        // Dosya boyutunu kontrol et
        if (file.size > 5 * 1024 * 1024) {
          alert('Dosya boyutu 5MB\'dan küçük olmalıdır');
          return;
        }
        
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64 = event.target?.result as string;
          console.log(`${type} photo loaded, size: ${Math.round(base64.length / 1024)} KB`);
          if (type === 'vehicle') setVehiclePhoto(base64);
          else if (type === 'license') setLicensePhoto(base64);
          else if (type === 'motorcycle') setMotorcyclePhoto(base64);
          else if (type === 'selfie') setSelfiePhoto(base64);
        };
        reader.onerror = () => {
          alert('Dosya okunamadı');
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  // Mobile'da fotoğraf çek veya seç
  const pickImageMobile = async (type: PhotoPickKind, source: 'camera' | 'gallery') => {
    console.log('KYC_IMAGE_PICK_START', { type, source });
    try {
      let result: ImagePicker.ImagePickerResult;

      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          appAlert('İzin Gerekli', 'Kamera izni gereklidir');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: false,
          quality: 0.6,
          base64: true,
        });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          appAlert('İzin Gerekli', 'Galeri izni gereklidir');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: false,
          quality: 0.6,
          base64: true,
        });
      }

      if (result.canceled) {
        return;
      }

      const asset = result.assets?.[0];
      if (!asset) {
        appAlert('Fotoğraf', 'Fotoğraf seçilemedi. Lütfen tekrar deneyin.');
        return;
      }

      const mime = kycImageMimeFromAsset(asset);
      const pickerBase64Len = typeof asset.base64 === 'string' ? asset.base64.length : 0;
      let dataUrl: string | null = null;
      let fallbackBase64Length = 0;

      if (asset.base64 && asset.base64.length > 0) {
        dataUrl = `data:${mime};base64,${asset.base64}`;
      } else if (asset.uri?.startsWith('data:')) {
        dataUrl = asset.uri;
      } else if (asset.uri) {
        try {
          const raw = await readAsStringAsync(asset.uri, { encoding: EncodingType.Base64 });
          fallbackBase64Length = raw?.length ?? 0;
          if (raw.length > 0) {
            dataUrl = `data:${mime};base64,${raw}`;
          }
        } catch {
          // final branch logs KYC_IMAGE_PICK_NO_BASE64
        }
      }

      const hasPickerBase64 = pickerBase64Len > 0;
      console.log('KYC_IMAGE_PICK_RESULT', {
        type,
        source,
        canceled: false,
        hasUri: !!asset.uri,
        hasPickerBase64,
        pickerBase64Length: pickerBase64Len,
        mimeType: asset.mimeType ?? null,
        assetType: asset.type ?? null,
        fallbackBase64Length,
        finalDataUrlLength: dataUrl?.length ?? 0,
      });

      if (!dataUrl) {
        console.warn('KYC_IMAGE_PICK_NO_BASE64', {
          type,
          source,
          hasUri: !!asset.uri,
          assetKeys: Object.keys(asset),
        });
        appAlert('Fotoğraf', 'Fotoğraf okunamadı. Lütfen tekrar deneyin.');
        return;
      }

      if (type === 'vehicle') setVehiclePhoto(dataUrl);
      else if (type === 'license') setLicensePhoto(dataUrl);
      else if (type === 'motorcycle') setMotorcyclePhoto(dataUrl);
      else if (type === 'selfie') setSelfiePhoto(dataUrl);
    } catch (error) {
      console.warn('KYC_IMAGE_PICK_ERROR', error);
      appAlert('Hata', 'Fotoğraf seçilemedi');
    }
  };

  useEffect(() => {
    if (isMotorKyc) return;
    let cancelled = false;
    if (!vehiclePhoto) {
      setVehicleAi(null);
      setAnalyzingVehicle(false);
      return;
    }
    setAnalyzingVehicle(true);
    setVehicleAi(null);
    (async () => {
      try {
        const r = await analyzeVehicleMock(vehiclePhoto);
        if (!cancelled) setVehicleAi(r);
      } finally {
        if (!cancelled) setAnalyzingVehicle(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vehiclePhoto, isMotorKyc]);

  useEffect(() => {
    if (!isMotorKyc) return;
    let cancelled = false;
    if (!motorcyclePhoto) {
      setVehicleAi(null);
      setAnalyzingVehicle(false);
      return;
    }
    setAnalyzingVehicle(true);
    setVehicleAi(null);
    (async () => {
      try {
        const r = await analyzeVehicleMock(motorcyclePhoto);
        if (!cancelled) setVehicleAi(r);
      } finally {
        if (!cancelled) setAnalyzingVehicle(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [motorcyclePhoto, isMotorKyc]);

  useEffect(() => {
    let cancelled = false;
    if (!licensePhoto) {
      setLicenseAi(null);
      setAnalyzingLicense(false);
      return;
    }
    setAnalyzingLicense(true);
    setLicenseAi(null);
    (async () => {
      try {
        const r = await analyzeLicenseMock(licensePhoto);
        if (!cancelled) setLicenseAi(r);
      } finally {
        if (!cancelled) setAnalyzingLicense(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [licensePhoto]);

  const vehiclePhotoForAi = isMotorKyc ? motorcyclePhoto : vehiclePhoto;
  const vehicleDocReady =
    !!vehiclePhotoForAi && !analyzingVehicle && !!vehicleAi;
  const licenseDocReady = !!licensePhoto && !analyzingLicense && !!licenseAi;

  const canGoNext = (): boolean => {
    if (isMotorKyc) {
      if (step === 0) {
        if (!vehicleBrand) return false;
        if (motorBrandIsOther) {
          return customBrandName.trim().length >= 2 && customModelName.trim().length >= 1;
        }
        return !!vehicleModel.trim();
      }
      if (step === 1) return vehicleDocReady;
      if (step === 2) return licenseDocReady;
      if (step === 3) return !!selfiePhoto;
      return false;
    }
    if (step === 0) {
      if (!plateNumber.trim()) return false;
      if (carBrandIsOther) {
        return customBrandName.trim().length >= 2 && customModelName.trim().length >= 1;
      }
      return !!(vehicleBrand && vehicleModel);
    }
    if (step === 1) return vehicleDocReady;
    if (step === 2) return licenseDocReady;
    if (step === 3) return true;
    return false;
  };

  const canSubmitFinal = (): boolean => {
    if (!termsAccepted) return false;
    if (isMotorKyc) {
      return (
        !!resolvedMotor.brand &&
        !!resolvedMotor.model &&
        !!motorcyclePhoto &&
        !!licensePhoto &&
        !!selfiePhoto &&
        !!vehicleAi &&
        !!licenseAi
      );
    }
    return (
      !!plateNumber.trim() &&
      !!resolvedCar.brand &&
      !!resolvedCar.model &&
      !!vehiclePhoto &&
      !!licensePhoto &&
      !!vehicleAi &&
      !!licenseAi
    );
  };

  const goNext = () => {
    if (!canGoNext()) return;
    if (step < 4) setStep((s) => s + 1);
  };

  const goBackStep = () => {
    if (step > 0) setStep((s) => s - 1);
  };

  // KYC gönder
  const submitKYC = async () => {
    console.log('========== KYC SUBMIT BAŞLADI ==========');

    if (isMotorKyc) {
      if (motorBrandIsOther) {
        if (customBrandName.trim().length < 2) {
          Platform.OS === 'web' ? alert('Motor markası girin (en az 2 karakter)') : appAlert('Hata', 'Motor markası girin (en az 2 karakter)');
          return;
        }
        if (!customModelName.trim()) {
          Platform.OS === 'web' ? alert('Motor modeli girin') : appAlert('Hata', 'Motor modeli girin');
          return;
        }
      } else {
        if (!vehicleBrand) {
          Platform.OS === 'web' ? alert('Motor markası seçin') : appAlert('Hata', 'Motor markası seçin');
          return;
        }
        if (!vehicleModel.trim()) {
          Platform.OS === 'web' ? alert('Motor modeli girin') : appAlert('Hata', 'Motor modeli girin');
          return;
        }
      }
      if (!licensePhoto) {
        Platform.OS === 'web' ? alert('Ehliyet fotoğrafı gerekli') : appAlert('Hata', 'Ehliyet fotoğrafı gerekli');
        return;
      }
      if (!motorcyclePhoto) {
        Platform.OS === 'web' ? alert('Motor fotoğrafı gerekli') : appAlert('Hata', 'Motor fotoğrafı gerekli');
        return;
      }
      if (!selfiePhoto) {
        Platform.OS === 'web' ? alert('Selfie (yüz) gerekli') : appAlert('Hata', 'Selfie (yüz) gerekli');
        return;
      }
    } else {
      if (!plateNumber.trim()) {
        if (Platform.OS === 'web') {
          alert('Lütfen plaka numarası girin');
        } else {
          appAlert('Hata', 'Lütfen plaka numarası girin');
        }
        return;
      }
      if (carBrandIsOther) {
        if (customBrandName.trim().length < 2) {
          if (Platform.OS === 'web') {
            alert('Lütfen marka adını yazın (en az 2 karakter)');
          } else {
            appAlert('Hata', 'Lütfen marka adını yazın (en az 2 karakter)');
          }
          return;
        }
        if (!customModelName.trim()) {
          if (Platform.OS === 'web') {
            alert('Lütfen model adını yazın');
          } else {
            appAlert('Hata', 'Lütfen model adını yazın');
          }
          return;
        }
      } else {
        if (!vehicleBrand) {
          if (Platform.OS === 'web') {
            alert('Lütfen araç markası seçin');
          } else {
            appAlert('Hata', 'Lütfen araç markası seçin');
          }
          return;
        }
        if (!vehicleModel) {
          if (Platform.OS === 'web') {
            alert('Lütfen araç modeli seçin');
          } else {
            appAlert('Hata', 'Lütfen araç modeli seçin');
          }
          return;
        }
      }
      if (!vehiclePhoto) {
        if (Platform.OS === 'web') {
          alert('Lütfen araç fotoğrafı yükleyin');
        } else {
          appAlert('Hata', 'Lütfen araç fotoğrafı yükleyin');
        }
        return;
      }
      if (!licensePhoto) {
        if (Platform.OS === 'web') {
          alert('Lütfen ehliyet fotoğrafı yükleyin');
        } else {
          appAlert('Hata', 'Lütfen ehliyet fotoğrafı yükleyin');
        }
        return;
      }
    }

    if (!vehicleAi || !licenseAi) {
      const msg = 'Ön kontrol tamamlanmadı. Lütfen sihirbaz adımlarını tamamlayın.';
      Platform.OS === 'web' ? alert(msg) : appAlert('Hata', msg);
      return;
    }
    if (!kvkkAcknowledged || !termsRulesAccepted) {
      const msg =
        'Başvuruyu göndermek için KVKK Aydınlatma Metni\'ni okumanız ve Sürücü Sözleşmesi\'ni kabul etmeniz gerekir.';
      Platform.OS === 'web' ? alert(msg) : appAlert('Hata', msg);
      return;
    }

    const aiStatus = combineAiTier(vehicleAi, licenseAi);
    const aiWarnings = combineAiWarnings(vehicleAi, licenseAi);

    setLoading(true);
    setSubmitStatus('Başvuru gönderiliyor...');

    try {
      const submitUrl = `${apiUrl}/driver/kyc/submit`;
      console.log('Submit URL:', submitUrl);
      console.log('User ID:', userId);
      console.log('Vehicle Photo Size:', Math.round((vehiclePhoto?.length || 0) / 1024), 'KB');
      console.log('License Photo Size:', Math.round((licensePhoto?.length || 0) / 1024), 'KB');

      const termsAcceptedAt = new Date().toISOString();
      const bodyData: Record<string, unknown> = isMotorKyc
        ? {
            user_id: userId,
            vehicle_kind: 'motorcycle',
            plate_number: plateNumber.trim() ? plateNumber.toLocaleUpperCase('tr-TR').trim() : null,
            vehicle_brand: resolvedMotor.brand,
            vehicle_model: resolvedMotor.model,
            license_photo_base64: licensePhoto,
            motorcycle_photo_base64: motorcyclePhoto,
            selfie_photo_base64: selfiePhoto,
            ai_status: aiStatus,
            ai_warnings: aiWarnings,
            kyc_terms_accepted_at: termsAcceptedAt,
          }
        : {
            user_id: userId,
            vehicle_kind: 'car',
            plate_number: plateNumber.toLocaleUpperCase('tr-TR').trim(),
            vehicle_brand: resolvedCar.brand,
            vehicle_model: resolvedCar.model,
            vehicle_year: vehicleYear || null,
            vehicle_color: vehicleColor || null,
            vehicle_photo_base64: vehiclePhoto,
            license_photo_base64: licensePhoto,
            ai_status: aiStatus,
            ai_warnings: aiWarnings,
            kyc_terms_accepted_at: termsAcceptedAt,
          };

      setSubmitStatus('Sunucuya bağlanılıyor...');

      const response = await fetch(submitUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bodyData),
      });

      console.log('Response Status:', response.status);
      setSubmitStatus('Yanıt işleniyor...');

      const responseText = await response.text();
      const contentType = response.headers.get('content-type');
      console.log('Response Text (first 500):', responseText.slice(0, 500));

      const data = parseKycSubmitResponseJson(responseText, response.status, contentType) as Record<
        string,
        unknown
      >;

      console.log('Response Data:', data);

      if (response.ok && data.success === true) {
        setSubmitStatus('Başvuru başarılı!');
        setKycRejectionReason(null);
        console.log('========== KYC SUBMIT BAŞARILI ==========');
        
        // Başarı mesajı göster
        if (Platform.OS === 'web') {
          alert('✅ Başvurunuz Alındı!\n\nSürücü başvurunuz incelemeye alındı.\nOnaylandığında bildirim alacaksınız.\n\nTahmini onay süresi: 30 dakika');
          onSuccess();
        } else {
          appAlert(
            '✅ Başvurunuz Alındı',
            'Sürücü başvurunuz incelemeye alındı.\nOnaylandığında bildirim alacaksınız.\n\nTahmini onay süresi: 30 dakika',
            [{ text: 'Tamam', onPress: onSuccess }]
          );
        }
      } else {
        throw new Error(pickKycSubmitErrorMessage(data, response.status));
      }
    } catch (error: any) {
      console.error('========== KYC SUBMIT HATA ==========');
      console.error('Error:', error);
      setSubmitStatus('');
      
      const errorMsg = error.message || 'Bir hata oluştu. Lütfen tekrar deneyin.';
      if (Platform.OS === 'web') {
        alert('Hata: ' + errorMsg);
      } else {
        appAlert('Hata', errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header — premium onboarding */}
      <LinearGradient colors={['#08111F', '#0B1220', '#101A2B']} style={styles.headerGradient}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity onPress={onBack} style={styles.backButtonPremium} accessibilityLabel="Geri">
            <Ionicons name="chevron-back" size={26} color={KYC_P.cyan} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerKicker}>Sürücü doğrulama</Text>
            {isMotorKyc ? <Text style={styles.headerTitleLight}>Motor kaydı</Text> : null}
            <Text style={[styles.headerStepLight, !isMotorKyc && styles.headerStepLightSolo]}>
              Adım {step + 1} / 5 — {stepTitles[step]}
            </Text>
          </View>
          <View style={{ width: 44 }} />
        </View>
        <View style={styles.stepDotsRow}>
          {[0, 1, 2, 3, 4].map((i) => (
            <View key={i} style={styles.stepDotWrap}>
              <View style={[styles.stepDot, i <= step ? styles.stepDotOn : styles.stepDotOff]} />
              <Text style={[styles.stepDotLabel, i === step && styles.stepDotLabelOn]}>{i + 1}</Text>
            </View>
          ))}
        </View>
      </LinearGradient>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView 
          style={styles.content} 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
        >
          <KycIntroCard userName={userName} />
          {kycRejectionReason ? <KycRejectedBanner reason={kycRejectionReason} /> : null}
          <KycRoadmapPanel
            step={step}
            isMotorKyc={isMotorKyc}
            licenseDocReady={licenseDocReady}
            vehicleDocReady={vehicleDocReady}
            kvkkAcknowledged={kvkkAcknowledged}
            termsRulesAccepted={termsRulesAccepted}
          />

          <View style={styles.progressTrack}>
            <View style={[styles.progressGlow, { width: `${((step + 1) / 5) * 100}%` }]} />
          </View>

          {!isMotorKyc ? (
            <>
              {step === 0 && (
                <>
                  <Text style={styles.label}>Plaka Numarası *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Örn: 34 ABC 123"
                    placeholderTextColor="rgba(186,201,222,0.42)"
                    value={plateNumber}
                    onChangeText={(text) => setPlateNumber(text.toLocaleUpperCase('tr-TR'))}
                    autoCapitalize="characters"
                    autoCorrect={false}
                  />
                  <Text style={styles.label}>Araç Markası *</Text>
                  <TouchableOpacity style={styles.selectButton} onPress={() => setShowBrandModal(true)}>
                    <Ionicons name="car" size={20} color={vehicleBrand ? KYC_P.cyan : 'rgba(186,201,222,0.45)'} />
                    <Text style={[styles.selectText, vehicleBrand && styles.selectTextActive]}>
                      {vehicleBrand || 'Marka seçin...'}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color="rgba(186,201,222,0.55)" />
                  </TouchableOpacity>
                  {carBrandIsOther ? (
                    <>
                      <Text style={styles.label}>Marka Adını Yazın *</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Örn: Chery"
                        placeholderTextColor="rgba(186,201,222,0.42)"
                        value={customBrandName}
                        onChangeText={setCustomBrandName}
                        autoCorrect={false}
                      />
                      <Text style={styles.label}>Model Adını Yazın *</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Örn: Tiggo 7"
                        placeholderTextColor="rgba(186,201,222,0.42)"
                        value={customModelName}
                        onChangeText={setCustomModelName}
                        autoCorrect={false}
                      />
                    </>
                  ) : (
                    <>
                      <Text style={styles.label}>Araç Modeli *</Text>
                      <TouchableOpacity
                        style={[styles.selectButton, !vehicleBrand && styles.selectDisabled]}
                        onPress={() => vehicleBrand && setShowModelModal(true)}
                        disabled={!vehicleBrand}
                      >
                        <Ionicons name="construct" size={20} color={vehicleModel ? KYC_P.cyan : 'rgba(186,201,222,0.45)'} />
                        <Text style={[styles.selectText, vehicleModel && styles.selectTextActive]}>
                          {vehicleModel || 'Model seçin...'}
                        </Text>
                        <Ionicons name="chevron-down" size={20} color="rgba(186,201,222,0.55)" />
                      </TouchableOpacity>
                    </>
                  )}
                  <Text style={styles.label}>Araç Yılı</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Örn: 2020"
                    placeholderTextColor="rgba(186,201,222,0.42)"
                    value={vehicleYear}
                    onChangeText={setVehicleYear}
                    keyboardType="numeric"
                    maxLength={4}
                  />
                  <Text style={styles.label}>Araç Rengi</Text>
                  <View style={styles.colorGrid}>
                    {CAR_COLORS.map((color) => (
                      <TouchableOpacity
                        key={color.name}
                        style={[styles.colorItem, vehicleColor === color.name && styles.colorItemActive]}
                        onPress={() => setVehicleColor(color.name)}
                      >
                        <View style={[styles.colorCircle, { backgroundColor: color.code, borderColor: color.border }]} />
                        <Text style={[styles.colorName, vehicleColor === color.name && styles.colorNameActive]}>
                          {color.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}
              {step === 1 && (
                <>
                  <PhotoCaptureGuide variant="vehicle" />
                  <Text style={styles.sectionLabel}>Araç fotoğrafı</Text>
                  <Text style={styles.sectionHint}>Plaka ve gövde net görünmeli; gölge ve uzak çekimden kaçının.</Text>
                  {vehiclePhoto ? (
                    <>
                      <PhotoUploadedStatusBar />
                      <PhotoCropHintAndPreview
                        uri={vehiclePhoto}
                        onReplacePhoto={() =>
                          Platform.OS === 'web'
                            ? handleWebFileSelect('vehicle')
                            : void pickImageMobile('vehicle', 'camera')
                        }
                      />
                      <PhotoHeroActions
                        onRetake={() => void pickImageMobile('vehicle', 'camera')}
                        onReplace={() =>
                          Platform.OS === 'web'
                            ? handleWebFileSelect('vehicle')
                            : void pickImageMobile('vehicle', 'gallery')
                        }
                        onClear={() => setVehiclePhoto(null)}
                      />
                    </>
                  ) : (
                    <EmptyPhotoAddCard
                      hint="Araç ve plaka net görünsün."
                      webMode={Platform.OS === 'web'}
                      onWebPick={() => handleWebFileSelect('vehicle')}
                      onPickGallery={() => void pickImageMobile('vehicle', 'gallery')}
                      onPickCamera={() => void pickImageMobile('vehicle', 'camera')}
                    />
                  )}
                  {analyzingVehicle ? (
                    <View style={styles.analyzeRow}>
                      <ActivityIndicator color={KYC_P.cyan} />
                      <Text style={styles.analyzeText}>Fotoğraf analiz ediliyor…</Text>
                    </View>
                  ) : null}
                  {vehicleAi?.status === 'red' ? (
                    <View style={styles.warnBanner}>
                      <Ionicons name="warning" size={20} color="rgba(253,217,148,0.92)" />
                      <Text style={styles.warnBannerText}>
                        Ön kontrol uyarısı: fotoğraf kalitesi düşük görünüyor; yine de devam edebilirsiniz;
                        mümkünse daha net bir görüntü tercih edin.
                      </Text>
                    </View>
                  ) : null}
                  {vehicleAi?.status === 'yellow' ? (
                    <View style={styles.warnBanner}>
                      <Ionicons name="warning" size={20} color="rgba(253,217,148,0.92)" />
                      <Text style={styles.warnBannerText}>
                        Ön kontrol uyarısı: yine de devam edebilirsiniz; mümkünse daha iyi bir fotoğraf tercih edin.
                      </Text>
                    </View>
                  ) : null}
                  {vehicleAi ? <AiResultCard result={vehicleAi} subtitle="Araç görüntüsü analizi" /> : null}
                </>
              )}
              {step === 2 && (
                <>
                  <PhotoCaptureGuide variant="license" />
                  <Text style={styles.sectionLabel}>Ehliyet fotoğrafı</Text>
                  <Text style={styles.sectionHint}>Belge düz tutulmuş ve kadrajda tam görünmeli.</Text>
                  {licensePhoto ? (
                    <>
                      <PhotoUploadedStatusBar />
                      <PhotoCropHintAndPreview
                        uri={licensePhoto}
                        onReplacePhoto={() =>
                          Platform.OS === 'web'
                            ? handleWebFileSelect('license')
                            : void pickImageMobile('license', 'camera')
                        }
                      />
                      <PhotoHeroActions
                        onRetake={() => void pickImageMobile('license', 'camera')}
                        onReplace={() =>
                          Platform.OS === 'web'
                            ? handleWebFileSelect('license')
                            : void pickImageMobile('license', 'gallery')
                        }
                        onClear={() => setLicensePhoto(null)}
                      />
                    </>
                  ) : (
                    <EmptyPhotoAddCard
                      hint="Belgenin dört köşesi görünmeli."
                      webMode={Platform.OS === 'web'}
                      onWebPick={() => handleWebFileSelect('license')}
                      onPickGallery={() => void pickImageMobile('license', 'gallery')}
                      onPickCamera={() => void pickImageMobile('license', 'camera')}
                    />
                  )}
                  {analyzingLicense ? (
                    <View style={styles.analyzeRow}>
                      <ActivityIndicator color={KYC_P.cyan} />
                      <Text style={styles.analyzeText}>Ehliyet analiz ediliyor…</Text>
                    </View>
                  ) : null}
                  {licenseAi?.status === 'red' ? (
                    <View style={styles.warnBanner}>
                      <Ionicons name="warning" size={20} color="rgba(253,217,148,0.92)" />
                      <Text style={styles.warnBannerText}>
                        Ön kontrol uyarısı: ehliyet fotoğrafı zayıf görünüyor; yine de devam edebilirsiniz;
                        mümkünse net ve kadrajı tam bir görüntü tercih edin.
                      </Text>
                    </View>
                  ) : null}
                  {licenseAi?.status === 'yellow' ? (
                    <View style={styles.warnBanner}>
                      <Ionicons name="warning" size={20} color="rgba(253,217,148,0.92)" />
                      <Text style={styles.warnBannerText}>
                        Ön kontrol uyarısı: devam edebilirsiniz; mümkünse belgeyi daha net çekin.
                      </Text>
                    </View>
                  ) : null}
                  {licenseAi ? <AiResultCard result={licenseAi} subtitle="Ehliyet görüntüsü analizi" /> : null}
                </>
              )}
              {step === 3 && (
                <>
                  <Text style={styles.summaryTitle}>Özet</Text>
                  <Text style={styles.summaryLine}>Plaka: {plateNumber.toUpperCase().trim() || '—'}</Text>
                  <Text style={styles.summaryLine}>
                    Araç: {resolvedCar.brand} {resolvedCar.model}
                    {vehicleYear ? ` (${vehicleYear})` : ''}
                    {vehicleColor ? ` · ${vehicleColor}` : ''}
                  </Text>
                  {vehicleAi ? <AiResultCard result={vehicleAi} subtitle="Araç görüntüsü analizi" /> : null}
                  {licenseAi ? <AiResultCard result={licenseAi} subtitle="Ehliyet görüntüsü analizi" /> : null}
                </>
              )}
              {step === 4 && (
                <>
                  <Text style={styles.summaryTitle}>Başvuruyu gönderin</Text>
                  <Text style={styles.stepHelp}>
                    Ön kontrol özeti ve belgeleriniz güvenli biçimde inceleme kuyruğuna iletilecek. Son karar her
                    zaman admin ekibindedir.
                  </Text>
                  <KycDriverResponsibilityNote />
                  <KycLegalConsentGroup
                    kvkkAcknowledged={kvkkAcknowledged}
                    termsRulesAccepted={termsRulesAccepted}
                    onToggleKvkk={() => setKvkkAcknowledged((v) => !v)}
                    onToggleTerms={() => setTermsRulesAccepted((v) => !v)}
                    onOpenKvkk={() => openKycLegalRoute('/kvkk')}
                    onOpenTermsDriver={() => openKycLegalRoute('/terms-driver')}
                    onOpenIdentityVerification={() => openKycLegalRoute('/identity-verification')}
                  />
                </>
              )}
            </>
          ) : (
            <>
              {step === 0 && (
                <>
                  <Text style={styles.label}>Motor Markası *</Text>
                  <TouchableOpacity style={styles.selectButton} onPress={() => setShowBrandModal(true)}>
                    <Ionicons name="bicycle" size={20} color={vehicleBrand ? KYC_P.cyan : 'rgba(186,201,222,0.45)'} />
                    <Text style={[styles.selectText, vehicleBrand && styles.selectTextActive]}>
                      {vehicleBrand || 'Marka seçin...'}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color="rgba(186,201,222,0.55)" />
                  </TouchableOpacity>
                  {motorBrandIsOther ? (
                    <>
                      <Text style={styles.label}>Marka Adını Yazın *</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Örn: Sym"
                        placeholderTextColor="rgba(186,201,222,0.42)"
                        value={customBrandName}
                        onChangeText={setCustomBrandName}
                        autoCorrect={false}
                      />
                      <Text style={styles.label}>Model Adını Yazın *</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Örn: Joymax 250"
                        placeholderTextColor="rgba(186,201,222,0.42)"
                        value={customModelName}
                        onChangeText={setCustomModelName}
                        autoCorrect={false}
                      />
                    </>
                  ) : (
                    <>
                      <Text style={styles.label}>Motor Modeli *</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Örn: PCX 125"
                        placeholderTextColor="rgba(186,201,222,0.42)"
                        value={vehicleModel}
                        onChangeText={setVehicleModel}
                        editable={!!vehicleBrand}
                        autoCorrect={false}
                      />
                    </>
                  )}
                  <Text style={styles.label}>Plaka (isteğe bağlı)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Varsa yazın"
                    placeholderTextColor="rgba(186,201,222,0.42)"
                    value={plateNumber}
                    onChangeText={(text) => setPlateNumber(text.toLocaleUpperCase('tr-TR'))}
                    autoCapitalize="characters"
                    autoCorrect={false}
                  />
                </>
              )}
              {step === 1 && (
                <>
                  <PhotoCaptureGuide variant="motorcycle" />
                  <Text style={styles.sectionLabel}>Motor fotoğrafı</Text>
                  <Text style={styles.sectionHint}>Motor ve varsa plaka net görünsün.</Text>
                  {motorcyclePhoto ? (
                    <>
                      <PhotoUploadedStatusBar />
                      <PhotoCropHintAndPreview
                        uri={motorcyclePhoto}
                        onReplacePhoto={() =>
                          Platform.OS === 'web'
                            ? handleWebFileSelect('motorcycle')
                            : void pickImageMobile('motorcycle', 'camera')
                        }
                      />
                      <PhotoHeroActions
                        onRetake={() => void pickImageMobile('motorcycle', 'camera')}
                        onReplace={() =>
                          Platform.OS === 'web'
                            ? handleWebFileSelect('motorcycle')
                            : void pickImageMobile('motorcycle', 'gallery')
                        }
                        onClear={() => setMotorcyclePhoto(null)}
                      />
                    </>
                  ) : (
                    <EmptyPhotoAddCard
                      hint="Motor ve plaka net görünsün."
                      webMode={Platform.OS === 'web'}
                      onWebPick={() => handleWebFileSelect('motorcycle')}
                      onPickGallery={() => void pickImageMobile('motorcycle', 'gallery')}
                      onPickCamera={() => void pickImageMobile('motorcycle', 'camera')}
                    />
                  )}
                  {analyzingVehicle ? (
                    <View style={styles.analyzeRow}>
                      <ActivityIndicator color={KYC_P.cyan} />
                      <Text style={styles.analyzeText}>Motor fotoğrafı analiz ediliyor…</Text>
                    </View>
                  ) : null}
                  {vehicleAi?.status === 'red' ? (
                    <View style={styles.warnBanner}>
                      <Ionicons name="warning" size={20} color="rgba(253,217,148,0.92)" />
                      <Text style={styles.warnBannerText}>
                        Ön kontrol uyarısı: fotoğraf kalitesi düşük görünüyor; yine de devam edebilirsiniz;
                        mümkünse daha net bir görüntü tercih edin.
                      </Text>
                    </View>
                  ) : null}
                  {vehicleAi?.status === 'yellow' ? (
                    <View style={styles.warnBanner}>
                      <Ionicons name="warning" size={20} color="rgba(253,217,148,0.92)" />
                      <Text style={styles.warnBannerText}>Ön kontrol uyarısı: devam edebilirsiniz.</Text>
                    </View>
                  ) : null}
                  {vehicleAi ? <AiResultCard result={vehicleAi} subtitle="Motor görüntüsü analizi" /> : null}
                </>
              )}
              {step === 2 && (
                <>
                  <PhotoCaptureGuide variant="license" />
                  <Text style={styles.sectionLabel}>Ehliyet fotoğrafı</Text>
                  <Text style={styles.sectionHint}>Belge düz ve tam kadrajda olsun.</Text>
                  {licensePhoto ? (
                    <>
                      <PhotoUploadedStatusBar />
                      <PhotoCropHintAndPreview
                        uri={licensePhoto}
                        onReplacePhoto={() =>
                          Platform.OS === 'web'
                            ? handleWebFileSelect('license')
                            : void pickImageMobile('license', 'camera')
                        }
                      />
                      <PhotoHeroActions
                        onRetake={() => void pickImageMobile('license', 'camera')}
                        onReplace={() =>
                          Platform.OS === 'web'
                            ? handleWebFileSelect('license')
                            : void pickImageMobile('license', 'gallery')
                        }
                        onClear={() => setLicensePhoto(null)}
                      />
                    </>
                  ) : (
                    <EmptyPhotoAddCard
                      hint="Belgenin dört köşesi görünmeli."
                      webMode={Platform.OS === 'web'}
                      onWebPick={() => handleWebFileSelect('license')}
                      onPickGallery={() => void pickImageMobile('license', 'gallery')}
                      onPickCamera={() => void pickImageMobile('license', 'camera')}
                    />
                  )}
                  {analyzingLicense ? (
                    <View style={styles.analyzeRow}>
                      <ActivityIndicator color={KYC_P.cyan} />
                      <Text style={styles.analyzeText}>Ehliyet analiz ediliyor…</Text>
                    </View>
                  ) : null}
                  {licenseAi?.status === 'red' ? (
                    <View style={styles.warnBanner}>
                      <Ionicons name="warning" size={20} color="rgba(253,217,148,0.92)" />
                      <Text style={styles.warnBannerText}>
                        Ön kontrol uyarısı: ehliyet fotoğrafı zayıf görünüyor; yine de devam edebilirsiniz;
                        mümkünse net bir görüntü tercih edin.
                      </Text>
                    </View>
                  ) : null}
                  {licenseAi?.status === 'yellow' ? (
                    <View style={styles.warnBanner}>
                      <Ionicons name="warning" size={20} color="rgba(253,217,148,0.92)" />
                      <Text style={styles.warnBannerText}>Ön kontrol uyarısı: devam edebilirsiniz.</Text>
                    </View>
                  ) : null}
                  {licenseAi ? <AiResultCard result={licenseAi} subtitle="Ehliyet görüntüsü analizi" /> : null}
                </>
              )}
              {step === 3 && (
                <>
                  <PhotoCaptureGuide variant="selfie" />
                  <Text style={styles.sectionLabel}>Selfie</Text>
                  <Text style={styles.sectionHint}>Yüzünüz net görünsün; admin incelemesi için gereklidir.</Text>
                  {selfiePhoto ? (
                    <>
                      <PhotoUploadedStatusBar />
                      <PhotoCropHintAndPreview
                        uri={selfiePhoto}
                        onReplacePhoto={() =>
                          Platform.OS === 'web'
                            ? handleWebFileSelect('selfie')
                            : void pickImageMobile('selfie', 'camera')
                        }
                      />
                      <PhotoHeroActions
                        onRetake={() => void pickImageMobile('selfie', 'camera')}
                        onReplace={() =>
                          Platform.OS === 'web'
                            ? handleWebFileSelect('selfie')
                            : void pickImageMobile('selfie', 'gallery')
                        }
                        onClear={() => setSelfiePhoto(null)}
                      />
                    </>
                  ) : (
                    <EmptyPhotoAddCard
                      hint="Yüzünüz net ve aydınlık olsun."
                      webMode={Platform.OS === 'web'}
                      onWebPick={() => handleWebFileSelect('selfie')}
                      onPickGallery={() => void pickImageMobile('selfie', 'gallery')}
                      onPickCamera={() => void pickImageMobile('selfie', 'camera')}
                    />
                  )}
                </>
              )}
              {step === 4 && (
                <>
                  <Text style={styles.summaryTitle}>Özet ve gönderim</Text>
                  <Text style={styles.summaryLine}>
                    {resolvedMotor.brand} {resolvedMotor.model}
                    {plateNumber.trim() ? ` · ${plateNumber.toUpperCase().trim()}` : ''}
                  </Text>
                  {vehicleAi ? <AiResultCard result={vehicleAi} subtitle="Motor görüntüsü analizi" /> : null}
                  {licenseAi ? <AiResultCard result={licenseAi} subtitle="Ehliyet görüntüsü analizi" /> : null}
                  <Text style={styles.stepHelp}>
                    Selfie yalnızca admin incelemesi içindir (canlılık doğrulaması değildir). Ön kontrol özeti ve
                    belgeler güvenli şekilde kuyruğa iletilir; son karar her zaman admin ekibindedir.
                  </Text>
                  <KycDriverResponsibilityNote />
                  <KycLegalConsentGroup
                    kvkkAcknowledged={kvkkAcknowledged}
                    termsRulesAccepted={termsRulesAccepted}
                    onToggleKvkk={() => setKvkkAcknowledged((v) => !v)}
                    onToggleTerms={() => setTermsRulesAccepted((v) => !v)}
                    onOpenKvkk={() => openKycLegalRoute('/kvkk')}
                    onOpenTermsDriver={() => openKycLegalRoute('/terms-driver')}
                    onOpenIdentityVerification={() => openKycLegalRoute('/identity-verification')}
                  />
                </>
              )}
            </>
          )}

          {/* Submit Status */}
          {submitStatus ? (
            <View style={styles.statusContainer}>
              <ActivityIndicator size="small" color={KYC_P.cyan} />
              <Text style={styles.statusText}>{submitStatus}</Text>
            </View>
          ) : null}

          <View style={styles.wizardFooter}>
            {step > 0 ? (
              <TouchableOpacity style={styles.navBtnSecondary} onPress={goBackStep}>
                <Text style={styles.navBtnSecondaryText}>Geri</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ flex: 1 }} />
            )}
            {step < 4 ? (
              <TouchableOpacity
                style={[styles.navBtnPrimary, !canGoNext() && styles.navBtnDisabled]}
                onPress={goNext}
                disabled={!canGoNext()}
              >
                <Text style={styles.navBtnPrimaryText}>İleri</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.submitBtnFooter, (!canSubmitFinal() || loading) && styles.submitBtnDisabled]}
                onPress={submitKYC}
                disabled={!canSubmitFinal() || loading}
              >
                {loading ? (
                  <ActivityIndicator color={KYC_P.cyan} size="small" />
                ) : (
                  <>
                    <Ionicons name="send" size={20} color="#FFF" />
                    <Text style={styles.submitBtnText}>Başvuruyu Gönder</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Marka Modal */}
      <Modal visible={showBrandModal} animationType="slide">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{isMotorKyc ? 'Motor Markası Seçin' : 'Marka Seçin'}</Text>
            <TouchableOpacity onPress={() => setShowBrandModal(false)}>
              <Ionicons name="close" size={28} color={KYC_P.textHi} />
            </TouchableOpacity>
          </View>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={20} color="rgba(186,201,222,0.55)" />
            <TextInput
              style={styles.searchInput}
              placeholder={isMotorKyc ? 'Motor markası ara...' : 'Marka ara...'}
              placeholderTextColor="rgba(186,201,222,0.42)"
              value={brandSearch}
              onChangeText={setBrandSearch}
            />
          </View>
          <FlatList
            data={filteredBrandList}
            keyExtractor={item => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.listItem, vehicleBrand === item && styles.listItemActive]}
                onPress={() => {
                  setVehicleBrand(item);
                  setVehicleModel('');
                  setCustomBrandName('');
                  setCustomModelName('');
                  setShowBrandModal(false);
                  setBrandSearch('');
                }}
              >
                <Text style={[styles.listItemText, vehicleBrand === item && styles.listItemTextActive]}>
                  {item}
                </Text>
                {vehicleBrand === item && <Ionicons name="checkmark" size={22} color={KYC_P.cyan} />}
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>
      </Modal>

      {/* Model Modal */}
      <Modal visible={showModelModal} animationType="slide">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{vehicleBrand} Modelleri</Text>
            <TouchableOpacity onPress={() => setShowModelModal(false)}>
              <Ionicons name="close" size={28} color={KYC_P.textHi} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={availableModels}
            keyExtractor={item => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.listItem, vehicleModel === item && styles.listItemActive]}
                onPress={() => {
                  setVehicleModel(item);
                  setShowModelModal(false);
                }}
              >
                <Text style={[styles.listItemText, vehicleModel === item && styles.listItemTextActive]}>
                  {item}
                </Text>
                {vehicleModel === item && <Ionicons name="checkmark" size={22} color={KYC_P.cyan} />}
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: KYC_P.bg,
  },
  headerGradient: {
    paddingTop: 6,
    paddingBottom: 18,
    paddingHorizontal: 14,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  backButtonPremium: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(34,211,238,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.22)',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  headerKicker: {
    fontSize: 10,
    fontWeight: '800',
    color: KYC_P.textMd,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  headerTitleLight: {
    fontSize: 19,
    fontWeight: '800',
    color: KYC_P.textHi,
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  headerStepLight: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '600',
    color: KYC_P.textMd,
    textAlign: 'center',
    lineHeight: 18,
  },
  /** Araç akışında ara başlık yok; kicker ile adım arasında boşluk */
  headerStepLightSolo: {
    marginTop: 10,
  },
  stepDotsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  stepDotWrap: {
    alignItems: 'center',
    flex: 1,
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginBottom: 5,
  },
  stepDotOn: {
    backgroundColor: KYC_P.cyan,
    shadowColor: KYC_P.cyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
  },
  stepDotOff: {
    backgroundColor: 'rgba(148, 163, 184, 0.22)',
  },
  stepDotLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(186,201,222,0.45)',
  },
  stepDotLabelOn: {
    color: KYC_P.cyan,
  },
  infoCardPremium: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    backgroundColor: KYC_P.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: KYC_P.border,
    shadowColor: '#010818',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 6,
  },
  infoIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: 'rgba(34,211,238,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.22)',
  },
  infoTextCol: {
    flex: 1,
  },
  infoTitlePremium: {
    fontSize: 15,
    fontWeight: '800',
    color: KYC_P.textHi,
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  infoBodyPremium: {
    fontSize: 13,
    color: KYC_P.textMd,
    lineHeight: 20,
  },
  kycIntroCard: {
    marginBottom: 14,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.22)',
    shadowColor: '#010818',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 6,
  },
  kycIntroGradient: {
    padding: 18,
  },
  kycIntroBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  kycIntroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(34,211,238,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.28)',
  },
  kycIntroBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: KYC_P.cyan,
    letterSpacing: 0.3,
  },
  kycIntroBadgeMuted: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(148,163,184,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
  },
  kycIntroBadgeMutedText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(186,201,222,0.72)',
  },
  kycIntroTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: KYC_P.textHi,
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  kycIntroLead: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(243,248,255,0.9)',
    lineHeight: 21,
    marginBottom: 10,
  },
  kycIntroBody: {
    fontSize: 13,
    color: KYC_P.textMd,
    lineHeight: 20,
  },
  kycRoadmapCard: {
    backgroundColor: KYC_P.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: KYC_P.border,
  },
  kycRoadmapEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(34,211,238,0.75)',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 14,
  },
  kycRoadmapRow: {
    flexDirection: 'row',
    minHeight: 36,
    marginBottom: 4,
  },
  kycRoadmapRowLast: {
    marginBottom: 0,
  },
  kycRoadmapIconCol: {
    width: 28,
    alignItems: 'center',
    paddingTop: 2,
  },
  kycRoadmapConnector: {
    flex: 1,
    width: 2,
    marginTop: 4,
    marginBottom: 2,
    backgroundColor: 'rgba(30,58,95,0.55)',
    borderRadius: 1,
  },
  kycRoadmapTextCol: {
    flex: 1,
    paddingBottom: 10,
  },
  kycRoadmapLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(186,201,222,0.72)',
    lineHeight: 20,
  },
  kycRoadmapLabelDone: {
    color: 'rgba(186,201,222,0.88)',
  },
  kycRoadmapLabelActive: {
    color: KYC_P.textHi,
    fontWeight: '800',
  },
  kycRoadmapLabelFuture: {
    color: 'rgba(186,201,222,0.58)',
  },
  kycRoadmapHint: {
    marginTop: 3,
    fontSize: 12,
    color: 'rgba(186,201,222,0.52)',
    fontStyle: 'italic',
    lineHeight: 17,
  },
  kycRoadmapActiveChip: {
    marginTop: 4,
    alignSelf: 'flex-start',
    fontSize: 10,
    fontWeight: '800',
    color: KYC_P.cyan,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  kycTrustLayersNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(30,58,95,0.45)',
  },
  kycTrustLayersText: {
    flex: 1,
    fontSize: 12,
    color: 'rgba(186,201,222,0.62)',
    lineHeight: 18,
  },
  kycResponsibilityCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: 'rgba(16,26,43,0.72)',
    borderRadius: 14,
    padding: 14,
    marginTop: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(30,58,95,0.55)',
  },
  kycResponsibilityTextCol: {
    flex: 1,
    gap: 6,
  },
  kycResponsibilityLine: {
    fontSize: 13,
    color: KYC_P.textMd,
    lineHeight: 19,
  },
  legalConsentGroup: {
    gap: 14,
    marginTop: 4,
  },
  identityInfoLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
    paddingVertical: 4,
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(30,58,95,0.45)',
    overflow: 'hidden',
    marginBottom: 20,
  },
  progressGlow: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: 'rgba(34,211,238,0.55)',
    shadowColor: KYC_P.cyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: KYC_P.textHi,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  sectionHint: {
    fontSize: 13,
    color: KYC_P.textMd,
    lineHeight: 19,
    marginBottom: 12,
  },
  stepHelp: {
    fontSize: 13,
    color: KYC_P.textMd,
    lineHeight: 20,
    marginBottom: 14,
    backgroundColor: 'rgba(16,26,43,0.72)',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: KYC_P.border,
  },
  analyzeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
    paddingHorizontal: 4,
  },
  analyzeText: {
    fontSize: 14,
    color: KYC_P.cyan,
    fontWeight: '500',
  },
  blockBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(127,29,37,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.35)',
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
  },
  blockBannerText: {
    flex: 1,
    fontSize: 13,
    color: 'rgba(253,213,213,0.94)',
    lineHeight: 18,
  },
  warnBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(120,94,26,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.28)',
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
  },
  warnBannerText: {
    flex: 1,
    fontSize: 13,
    color: 'rgba(253,230,174,0.94)',
    lineHeight: 18,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginTop: 18,
    paddingVertical: 4,
  },
  termsBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: KYC_P.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  termsBoxChecked: {
    backgroundColor: KYC_P.cyan,
    borderColor: KYC_P.cyan,
  },
  termsText: {
    flex: 1,
    fontSize: 14,
    color: KYC_P.textMd,
    lineHeight: 20,
  },
  termsLink: {
    color: KYC_P.cyan,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  summaryTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: KYC_P.textHi,
    marginBottom: 10,
  },
  summaryLine: {
    fontSize: 15,
    color: KYC_P.textMd,
    marginBottom: 6,
    lineHeight: 22,
  },
  wizardFooter: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: KYC_P.border,
  },
  navBtnSecondary: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: KYC_P.border,
    backgroundColor: 'rgba(16,26,43,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnSecondaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: KYC_P.textHi,
    letterSpacing: 0.2,
  },
  navBtnPrimary: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(34,211,238,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.42)',
    shadowColor: '#010818',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  navBtnPrimaryText: {
    fontSize: 15,
    fontWeight: '800',
    color: KYC_P.textHi,
    letterSpacing: 0.35,
  },
  navBtnDisabled: {
    opacity: 0.38,
    shadowOpacity: 0,
    elevation: 0,
    backgroundColor: 'rgba(16,26,43,0.5)',
    borderColor: KYC_P.border,
  },
  submitBtnFooter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(6,148,173,0.38)',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.45)',
    shadowColor: KYC_P.cyan,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 5,
  },
  submitBtnDisabled: {
    backgroundColor: 'rgba(52,71,93,0.45)',
    borderColor: KYC_P.border,
    shadowOpacity: 0,
    elevation: 0,
    opacity: 0.55,
  },
  content: {
    flex: 1,
    padding: 18,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: KYC_P.textHi,
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: KYC_P.card,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: KYC_P.textHi,
    borderWidth: 1,
    borderColor: KYC_P.border,
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: KYC_P.card,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: KYC_P.border,
    gap: 10,
  },
  selectDisabled: {
    opacity: 0.5,
  },
  selectText: {
    flex: 1,
    fontSize: 16,
    color: 'rgba(186,201,222,0.55)',
  },
  selectTextActive: {
    color: KYC_P.textHi,
    fontWeight: '500',
  },
  // Renk Grid
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  colorItem: {
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    backgroundColor: KYC_P.card,
    borderWidth: 2,
    borderColor: KYC_P.border,
    width: '18%',
    minWidth: 58,
  },
  colorItemActive: {
    borderColor: KYC_P.cyan,
    backgroundColor: 'rgba(34,211,238,0.14)',
    shadowColor: KYC_P.cyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 2,
  },
  colorCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    marginBottom: 4,
  },
  colorName: {
    fontSize: 9,
    color: KYC_P.textMd,
    textAlign: 'center',
  },
  colorNameActive: {
    color: KYC_P.cyan,
    fontWeight: '600',
  },
  // Fotoğraf
  photoPreview: {
    position: 'relative',
    marginBottom: 8,
  },
  previewImage: {
    width: '100%',
    height: 180,
    borderRadius: 10,
    resizeMode: 'cover',
    borderWidth: 1,
    borderColor: KYC_P.border,
  },
  removePhotoBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: KYC_P.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: KYC_P.border,
  },
  // Status
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
    marginTop: 16,
    backgroundColor: 'rgba(16,26,43,0.72)',
    borderRadius: 12,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: KYC_P.border,
  },
  statusText: {
    fontSize: 14,
    color: KYC_P.textMd,
    fontWeight: '500',
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 0.35,
  },
  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: KYC_P.bg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: 'rgba(16,26,43,0.92)',
    borderBottomWidth: 1,
    borderBottomColor: KYC_P.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: KYC_P.textHi,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: KYC_P.card,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 4,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: KYC_P.border,
  },
  searchInput: {
    flex: 1,
    padding: 12,
    fontSize: 16,
    color: KYC_P.textHi,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: KYC_P.card,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: KYC_P.border,
  },
  listItemActive: {
    backgroundColor: 'rgba(34,211,238,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.38)',
  },
  listItemText: {
    fontSize: 16,
    color: KYC_P.textHi,
  },
  listItemTextActive: {
    fontWeight: '600',
    color: KYC_P.cyan,
  },
});
