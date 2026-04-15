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
  Alert,
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
import * as ImagePicker from 'expo-image-picker';
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
  'Diğer': ['Belirtilmemiş'],
};

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

/** FastAPI: detail string | dizi; özel cevaplarda message. */
function pickKycSubmitErrorMessage(data: unknown, httpStatus: number): string {
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>;
    if (typeof d.message === 'string' && d.message.trim()) return d.message.trim();
    const detail = d.detail;
    if (typeof detail === 'string' && detail.trim()) return detail.trim();
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
    if (typeof d.error === 'string' && d.error.trim()) return d.error.trim();
  }
  if (httpStatus === 413) {
    return 'İstek çok büyük (413). Fotoğrafları daha düşük çözünürlükte yükleyin.';
  }
  if (httpStatus >= 500) {
    return `Sunucu hatası (HTTP ${httpStatus}). Lütfen bir süre sonra tekrar deneyin.`;
  }
  return 'Başvuru gönderilemedi';
}

/** Önizleme + önizlemenin altında büyük kırp CTA; onCrop = mevcut galeri/düzenleme akışı (allowsEditing). */
function PhotoCropHintAndPreview({ uri, onCrop }: { uri: string; onCrop: () => void }) {
  return (
    <View style={photoHeroStyles.previewColumn}>
      <Text style={photoHeroStyles.cropGuide}>Önizlemeyi kontrol edin; gerekirse aşağıdan kırpın.</Text>
      <View style={photoHeroStyles.previewFrame}>
        <Image source={{ uri }} style={photoHeroStyles.previewImage} resizeMode="cover" />
      </View>
      <TouchableOpacity
        style={photoHeroStyles.cropBarOuter}
        onPress={onCrop}
        activeOpacity={0.9}
        accessibilityRole="button"
        accessibilityLabel="Fotoğrafı kırp ve kadrajı düzelt"
      >
        <LinearGradient
          colors={['#0C4A6E', '#0369A1', '#0284C7']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={photoHeroStyles.cropBarGradient}
        >
          <Ionicons name="crop-outline" size={22} color="#FFFFFF" />
          <Text style={photoHeroStyles.cropBarTitle}>Fotoğrafı kırp ve kadrajı düzelt</Text>
        </LinearGradient>
      </TouchableOpacity>
      <Text style={photoHeroStyles.cropBarHint}>
        {Platform.OS === 'web'
          ? 'Dosyayı yeniden seçerek kadrajı güncellersiniz.'
          : 'Galeri açılır; düzenleme ekranında kırpabilirsiniz.'}
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
          <Ionicons name="camera-outline" size={18} color="#0369A1" />
          <Text style={photoHeroStyles.pillText}>Yeniden çek</Text>
        </TouchableOpacity>
        <TouchableOpacity style={photoHeroStyles.pill} onPress={onReplace} activeOpacity={0.88}>
          <Ionicons name="images-outline" size={18} color="#0369A1" />
          <Text style={photoHeroStyles.pillText}>Değiştir</Text>
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
    color: '#0369A1',
    marginBottom: 8,
    lineHeight: 17,
    letterSpacing: 0.1,
  },
  previewFrame: {
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#38BDF8',
    backgroundColor: '#0C4A6E',
    shadowColor: '#0369A1',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 10,
  },
  previewImage: {
    width: '100%',
    aspectRatio: 4 / 3,
    minHeight: 232,
    backgroundColor: '#1E293B',
  },
  cropBarOuter: {
    marginTop: 12,
    borderRadius: 16,
    overflow: 'hidden',
    alignSelf: 'stretch',
    shadowColor: '#0369A1',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
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
    borderColor: 'rgba(125, 211, 252, 0.5)',
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
    color: '#64748B',
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
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#7DD3FC',
  },
  pillText: { color: '#0C4A6E', fontSize: 13, fontWeight: '700' },
  pillGhost: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#94A3B8',
    backgroundColor: '#F8FAFC',
  },
  pillGhostText: { color: '#475569', fontSize: 13, fontWeight: '700' },
});

const emptyPhotoStyles = StyleSheet.create({
  cardOuter: {
    borderRadius: 24,
    marginBottom: 2,
    shadowColor: '#0369A1',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 6,
  },
  wrapCol: { marginBottom: 6 },
  pressWrap: {
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#60A5FA',
    borderStyle: 'dashed',
    backgroundColor: '#F8FAFC',
  },
  pressWrapActive: {
    opacity: 0.94,
    transform: [{ scale: 0.987 }],
    borderColor: '#0EA5E9',
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
    backgroundColor: 'rgba(14, 165, 233, 0.14)',
    borderWidth: 1.5,
    borderColor: 'rgba(56, 189, 248, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  headline: {
    fontSize: 21,
    fontWeight: '800',
    color: '#0C4A6E',
    letterSpacing: -0.5,
    marginBottom: 8,
    textAlign: 'center',
  },
  hint: {
    fontSize: 14,
    color: '#475569',
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
    backgroundColor: 'rgba(3, 105, 161, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(125, 211, 252, 0.5)',
  },
  aiRowText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#075985',
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
    backgroundColor: 'rgba(12, 74, 110, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(3, 105, 161, 0.22)',
  },
  primaryLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0C4A6E',
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
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  secondaryBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0369A1',
  },
  secondarySep: {
    width: 1,
    height: 18,
    backgroundColor: '#CBD5E1',
    marginHorizontal: 4,
  },
  webHintBelow: {
    marginTop: 12,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
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
    backgroundColor: '#F0F9FF',
    borderWidth: 1.5,
    borderColor: '#7DD3FC',
  },
  uploadedBarTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0C4A6E',
  },
  uploadedBarSep: { fontSize: 14, color: '#38BDF8', fontWeight: '700' },
  uploadedAiChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(3, 105, 161, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(14, 165, 233, 0.45)',
  },
  uploadedAiChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0369A1',
    letterSpacing: 0.3,
  },
});

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
        <Ionicons name="camera" size={46} color="#0369A1" />
      </View>
      <Text style={emptyPhotoStyles.headline}>Fotoğraf ekle</Text>
      <Text style={emptyPhotoStyles.hint}>{hint}</Text>
      <View style={emptyPhotoStyles.aiRow}>
        <Ionicons name="sparkles" size={16} color="#0EA5E9" />
        <Text style={emptyPhotoStyles.aiRowText}>
          {webMode
            ? 'Dosya seçildiğinde güvenli yükleme ve otomatik ön kontrol başlar.'
            : 'Galeri veya kamera — yükleme sonrası AI destekli ön kontrol otomatik çalışır.'}
        </Text>
      </View>
      <View style={emptyPhotoStyles.primaryLabelRow}>
        <Text style={emptyPhotoStyles.primaryLabel}>Fotoğraf ekle</Text>
        <Ionicons name={webMode ? 'cloud-upload-outline' : 'images'} size={22} color="#0369A1" />
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
            <LinearGradient colors={['#F8FAFC', '#EFF6FF', '#E0F2FE']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={emptyPhotoStyles.cardFace}>
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
          onPress={() => void onPickGallery()}
          accessibilityRole="button"
          accessibilityLabel="Fotoğraf ekle, galeri"
          style={({ pressed, hovered }) => [
            emptyPhotoStyles.pressWrap,
            (pressed || Boolean(hovered)) && emptyPhotoStyles.pressWrapActive,
          ]}
        >
          <LinearGradient colors={['#F8FAFC', '#EFF6FF', '#E0F2FE']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={emptyPhotoStyles.cardFace}>
            {body}
          </LinearGradient>
        </Pressable>
      </View>
      <View style={emptyPhotoStyles.secondaryRow}>
        <TouchableOpacity style={emptyPhotoStyles.secondaryBtn} onPress={() => void onPickCamera()} activeOpacity={0.82}>
          <Ionicons name="camera-outline" size={18} color="#0369A1" />
          <Text style={emptyPhotoStyles.secondaryBtnText}>Kamera</Text>
        </TouchableOpacity>
        <View style={emptyPhotoStyles.secondarySep} />
        <TouchableOpacity style={emptyPhotoStyles.secondaryBtn} onPress={() => void onPickGallery()} activeOpacity={0.82}>
          <Ionicons name="images-outline" size={18} color="#0369A1" />
          <Text style={emptyPhotoStyles.secondaryBtnText}>Galeri</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function PhotoUploadedStatusBar() {
  return (
    <View style={emptyPhotoStyles.uploadedBar}>
      <Ionicons name="checkmark-circle" size={20} color="#0284C7" />
      <Text style={emptyPhotoStyles.uploadedBarTitle}>Yüklendi</Text>
      <Text style={emptyPhotoStyles.uploadedBarSep}>·</Text>
      <View style={emptyPhotoStyles.uploadedAiChip}>
        <Ionicons name="sparkles" size={13} color="#0369A1" />
        <Text style={emptyPhotoStyles.uploadedAiChipText}>Ön kontrol</Text>
      </View>
    </View>
  );
}

function AiResultCard({ result, subtitle }: { result: AiMockResult; subtitle?: string }) {
  const palette: Record<
    AiTier,
    { bg: string; border: string; accent: string; chipBg: string; icon: keyof typeof Ionicons.glyphMap }
  > = {
    green: { bg: '#F0FDF4', border: '#86EFAC', accent: '#166534', chipBg: '#DCFCE7', icon: 'checkmark-circle' },
    yellow: { bg: '#FFFBEB', border: '#FDE047', accent: '#A16207', chipBg: '#FEF9C3', icon: 'alert-circle' },
    red: { bg: '#FEF2F2', border: '#FCA5A5', accent: '#991B1B', chipBg: '#FEE2E2', icon: 'close-circle' },
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
      <Text style={aiCardStyles.title}>{result.title}</Text>
      {result.messages.map((m, idx) => (
        <View key={idx} style={aiCardStyles.lineRow}>
          <Ionicons name="ellipse" size={6} color={c.accent} style={aiCardStyles.lineBullet} />
          <Text style={aiCardStyles.line}>{m}</Text>
        </View>
      ))}
      <Text style={aiCardStyles.footnote}>Ön kontrol şu an demo modunda; son karar her zaman insandan.</Text>
    </View>
  );
}

const aiCardStyles = StyleSheet.create({
  wrap: {
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 16,
    marginTop: 14,
    shadowColor: '#0369A1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
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
  },
  chipText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.2 },
  panelEyebrow: { fontSize: 11, fontWeight: '800', color: '#0369A1', letterSpacing: 0.7, textTransform: 'uppercase' },
  sub: { fontSize: 12, fontWeight: '700', marginBottom: 6 },
  title: { fontSize: 16, fontWeight: '800', color: '#0F172A', marginBottom: 10, lineHeight: 22 },
  lineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  lineBullet: { marginTop: 6 },
  line: { flex: 1, fontSize: 13, color: '#334155', lineHeight: 19 },
  footnote: { marginTop: 12, fontSize: 11, color: '#94A3B8', lineHeight: 16, fontStyle: 'italic' },
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
  
  // Marka arama
  const [brandSearch, setBrandSearch] = useState('');
  const [showBrandModal, setShowBrandModal] = useState(false);
  const [showModelModal, setShowModelModal] = useState(false);

  const [step, setStep] = useState(0);
  const [vehicleAi, setVehicleAi] = useState<AiMockResult | null>(null);
  const [licenseAi, setLicenseAi] = useState<AiMockResult | null>(null);
  const [analyzingVehicle, setAnalyzingVehicle] = useState(false);
  const [analyzingLicense, setAnalyzingLicense] = useState(false);

  const stepTitles = isMotorKyc ? MOTOR_STEP_TITLES : CAR_STEP_TITLES;

  // Filtrelenmiş markalar
  const filteredBrands = useMemo(() => {
    const brands = Object.keys(CAR_BRANDS).sort();
    if (!brandSearch) return brands;
    return brands.filter(b => b.toLowerCase().includes(brandSearch.toLowerCase()));
  }, [brandSearch]);

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
    try {
      let result;
      
      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('İzin Gerekli', 'Kamera izni gereklidir');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.6,
          base64: true,
        });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('İzin Gerekli', 'Galeri izni gereklidir');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.6,
          base64: true,
        });
      }

      if (!result.canceled && result.assets[0].base64) {
        const base64Data = `data:image/jpeg;base64,${result.assets[0].base64}`;
        if (type === 'vehicle') setVehiclePhoto(base64Data);
        else if (type === 'license') setLicensePhoto(base64Data);
        else if (type === 'motorcycle') setMotorcyclePhoto(base64Data);
        else if (type === 'selfie') setSelfiePhoto(base64Data);
      }
    } catch (error) {
      console.error('Image pick error:', error);
      Alert.alert('Hata', 'Fotoğraf seçilemedi');
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
    !!vehiclePhotoForAi &&
    !analyzingVehicle &&
    !!vehicleAi &&
    vehicleAi.status !== 'red';
  const licenseDocReady =
    !!licensePhoto && !analyzingLicense && !!licenseAi && licenseAi.status !== 'red';

  const canGoNext = (): boolean => {
    if (isMotorKyc) {
      if (step === 0) return !!(vehicleBrand.trim() && vehicleModel.trim());
      if (step === 1) return vehicleDocReady;
      if (step === 2) return licenseDocReady;
      if (step === 3) return !!selfiePhoto;
      return false;
    }
    if (step === 0) return !!(plateNumber.trim() && vehicleBrand && vehicleModel);
    if (step === 1) return vehicleDocReady;
    if (step === 2) return licenseDocReady;
    if (step === 3) return true;
    return false;
  };

  const canSubmitFinal = (): boolean => {
    if (isMotorKyc) {
      return (
        vehicleBrand.trim() &&
        vehicleModel.trim() &&
        !!motorcyclePhoto &&
        !!licensePhoto &&
        !!selfiePhoto &&
        !!vehicleAi &&
        !!licenseAi &&
        vehicleAi.status !== 'red' &&
        licenseAi.status !== 'red'
      );
    }
    return (
      !!plateNumber.trim() &&
      !!vehicleBrand &&
      !!vehicleModel &&
      !!vehiclePhoto &&
      !!licensePhoto &&
      !!vehicleAi &&
      !!licenseAi &&
      vehicleAi.status !== 'red' &&
      licenseAi.status !== 'red'
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
      if (!vehicleBrand.trim()) {
        Platform.OS === 'web' ? alert('Motor markası girin') : Alert.alert('Hata', 'Motor markası girin');
        return;
      }
      if (!vehicleModel.trim()) {
        Platform.OS === 'web' ? alert('Motor modeli girin') : Alert.alert('Hata', 'Motor modeli girin');
        return;
      }
      if (!licensePhoto) {
        Platform.OS === 'web' ? alert('Ehliyet fotoğrafı gerekli') : Alert.alert('Hata', 'Ehliyet fotoğrafı gerekli');
        return;
      }
      if (!motorcyclePhoto) {
        Platform.OS === 'web' ? alert('Motor fotoğrafı gerekli') : Alert.alert('Hata', 'Motor fotoğrafı gerekli');
        return;
      }
      if (!selfiePhoto) {
        Platform.OS === 'web' ? alert('Selfie (yüz) gerekli') : Alert.alert('Hata', 'Selfie (yüz) gerekli');
        return;
      }
    } else {
      if (!plateNumber.trim()) {
        if (Platform.OS === 'web') {
          alert('Lütfen plaka numarası girin');
        } else {
          Alert.alert('Hata', 'Lütfen plaka numarası girin');
        }
        return;
      }
      if (!vehicleBrand) {
        if (Platform.OS === 'web') {
          alert('Lütfen araç markası seçin');
        } else {
          Alert.alert('Hata', 'Lütfen araç markası seçin');
        }
        return;
      }
      if (!vehicleModel) {
        if (Platform.OS === 'web') {
          alert('Lütfen araç modeli seçin');
        } else {
          Alert.alert('Hata', 'Lütfen araç modeli seçin');
        }
        return;
      }
      if (!vehiclePhoto) {
        if (Platform.OS === 'web') {
          alert('Lütfen araç fotoğrafı yükleyin');
        } else {
          Alert.alert('Hata', 'Lütfen araç fotoğrafı yükleyin');
        }
        return;
      }
      if (!licensePhoto) {
        if (Platform.OS === 'web') {
          alert('Lütfen ehliyet fotoğrafı yükleyin');
        } else {
          Alert.alert('Hata', 'Lütfen ehliyet fotoğrafı yükleyin');
        }
        return;
      }
    }

    if (!vehicleAi || !licenseAi) {
      const msg = 'Ön kontrol tamamlanmadı. Lütfen sihirbaz adımlarını tamamlayın.';
      Platform.OS === 'web' ? alert(msg) : Alert.alert('Hata', msg);
      return;
    }
    if (vehicleAi.status === 'red' || licenseAi.status === 'red') {
      const msg = 'Kırmızı ön kontrol sonucu varken başvuru gönderilemez. Fotoğrafları güncelleyin.';
      Platform.OS === 'web' ? alert(msg) : Alert.alert('Hata', msg);
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

      const bodyData: Record<string, unknown> = isMotorKyc
        ? {
            user_id: userId,
            vehicle_kind: 'motorcycle',
            plate_number: plateNumber.trim() ? plateNumber.toUpperCase().trim() : null,
            vehicle_brand: vehicleBrand.trim(),
            vehicle_model: vehicleModel.trim(),
            license_photo_base64: licensePhoto,
            motorcycle_photo_base64: motorcyclePhoto,
            selfie_photo_base64: selfiePhoto,
            ai_status: aiStatus,
            ai_warnings: aiWarnings,
          }
        : {
            user_id: userId,
            vehicle_kind: 'car',
            plate_number: plateNumber.toUpperCase().trim(),
            vehicle_brand: vehicleBrand,
            vehicle_model: vehicleModel,
            vehicle_year: vehicleYear || null,
            vehicle_color: vehicleColor || null,
            vehicle_photo_base64: vehiclePhoto,
            license_photo_base64: licensePhoto,
            ai_status: aiStatus,
            ai_warnings: aiWarnings,
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
        console.log('========== KYC SUBMIT BAŞARILI ==========');
        
        // Başarı mesajı göster
        if (Platform.OS === 'web') {
          alert('✅ Başvurunuz Alındı!\n\nSürücü başvurunuz incelemeye alındı.\nOnaylandığında bildirim alacaksınız.\n\nTahmini onay süresi: 30 dakika');
          onSuccess();
        } else {
          Alert.alert(
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
        Alert.alert('Hata', errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header — premium onboarding */}
      <LinearGradient colors={['#0B1220', '#111827', '#1E293B']} style={styles.headerGradient}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity onPress={onBack} style={styles.backButtonPremium} accessibilityLabel="Geri">
            <Ionicons name="chevron-back" size={26} color="#F8FAFC" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerKicker}>Sürücü doğrulama</Text>
            <Text style={styles.headerTitleLight}>
              {isMotorKyc ? 'Motor kaydı' : 'Profesyonel başvuru'}
            </Text>
            <Text style={styles.headerStepLight}>
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
          <View style={styles.infoCardPremium}>
            <View style={styles.infoIconWrap}>
              <Ionicons name="sparkles" size={22} color="#38BDF8" />
            </View>
            <View style={styles.infoTextCol}>
              <Text style={styles.infoTitlePremium}>AI destekli ön kontrol</Text>
              <Text style={styles.infoBodyPremium}>
                {isMotorKyc
                  ? 'Belgeler güvenle işlenir; fotoğraflarda otomatik kalite kontrolü yapılır. Son onay ekiptedir.'
                  : 'Plaka ve belge netliği taranır; bulanık veya eksik kadrajda uyarı verilir.'}
              </Text>
            </View>
          </View>

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
                    placeholderTextColor="#999"
                    value={plateNumber}
                    onChangeText={setPlateNumber}
                    autoCapitalize="characters"
                  />
                  <Text style={styles.label}>Araç Markası *</Text>
                  <TouchableOpacity style={styles.selectButton} onPress={() => setShowBrandModal(true)}>
                    <Ionicons name="car" size={20} color={vehicleBrand ? '#3FA9F5' : '#999'} />
                    <Text style={[styles.selectText, vehicleBrand && styles.selectTextActive]}>
                      {vehicleBrand || 'Marka seçin...'}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color="#999" />
                  </TouchableOpacity>
                  <Text style={styles.label}>Araç Modeli *</Text>
                  <TouchableOpacity
                    style={[styles.selectButton, !vehicleBrand && styles.selectDisabled]}
                    onPress={() => vehicleBrand && setShowModelModal(true)}
                    disabled={!vehicleBrand}
                  >
                    <Ionicons name="construct" size={20} color={vehicleModel ? '#3FA9F5' : '#999'} />
                    <Text style={[styles.selectText, vehicleModel && styles.selectTextActive]}>
                      {vehicleModel || 'Model seçin...'}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color="#999" />
                  </TouchableOpacity>
                  <Text style={styles.label}>Araç Yılı</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Örn: 2020"
                    placeholderTextColor="#999"
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
                  <Text style={styles.stepHelp}>
                    Plaka ve aracın tamamı görünsün; gölgede veya çok uzaktan çekmeyin.
                  </Text>
                  <Text style={styles.sectionLabel}>Araç fotoğrafı</Text>
                  <Text style={styles.sectionHint}>Plaka ve gövde net görünmeli; gölge ve uzak çekimden kaçının.</Text>
                  {vehiclePhoto ? (
                    <>
                      <PhotoUploadedStatusBar />
                      <PhotoCropHintAndPreview
                        uri={vehiclePhoto}
                        onCrop={() =>
                          Platform.OS === 'web'
                            ? handleWebFileSelect('vehicle')
                            : void pickImageMobile('vehicle', 'gallery')
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
                      <ActivityIndicator color="#3FA9F5" />
                      <Text style={styles.analyzeText}>Fotoğraf analiz ediliyor…</Text>
                    </View>
                  ) : null}
                  {vehicleAi?.status === 'red' ? (
                    <View style={styles.blockBanner}>
                      <Ionicons name="close-circle" size={22} color="#B91C1C" />
                      <Text style={styles.blockBannerText}>
                        Bu fotoğrafla ilerlenemez. Lütfen daha net bir görüntü yükleyin.
                      </Text>
                    </View>
                  ) : null}
                  {vehicleAi?.status === 'yellow' ? (
                    <View style={styles.warnBanner}>
                      <Ionicons name="warning" size={20} color="#B45309" />
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
                  <Text style={styles.stepHelp}>
                    Ehliyetin dört köşesi ve tüm yazılar okunaklı görünmeli.
                  </Text>
                  <Text style={styles.sectionLabel}>Ehliyet fotoğrafı</Text>
                  <Text style={styles.sectionHint}>Belge düz tutulmuş ve kadrajda tam görünmeli.</Text>
                  {licensePhoto ? (
                    <>
                      <PhotoUploadedStatusBar />
                      <PhotoCropHintAndPreview
                        uri={licensePhoto}
                        onCrop={() =>
                          Platform.OS === 'web'
                            ? handleWebFileSelect('license')
                            : void pickImageMobile('license', 'gallery')
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
                      <ActivityIndicator color="#3FA9F5" />
                      <Text style={styles.analyzeText}>Ehliyet analiz ediliyor…</Text>
                    </View>
                  ) : null}
                  {licenseAi?.status === 'red' ? (
                    <View style={styles.blockBanner}>
                      <Ionicons name="close-circle" size={22} color="#B91C1C" />
                      <Text style={styles.blockBannerText}>
                        Ehliyet fotoğrafı yetersiz. Lütfen net ve kadrajı tam bir görüntü yükleyin.
                      </Text>
                    </View>
                  ) : null}
                  {licenseAi?.status === 'yellow' ? (
                    <View style={styles.warnBanner}>
                      <Ionicons name="warning" size={20} color="#B45309" />
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
                    Araç: {vehicleBrand} {vehicleModel}
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
                </>
              )}
            </>
          ) : (
            <>
              {step === 0 && (
                <>
                  <Text style={styles.label}>Motor Markası *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Örn: Honda"
                    placeholderTextColor="#999"
                    value={vehicleBrand}
                    onChangeText={setVehicleBrand}
                  />
                  <Text style={styles.label}>Motor Modeli *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Örn: PCX 125"
                    placeholderTextColor="#999"
                    value={vehicleModel}
                    onChangeText={setVehicleModel}
                  />
                  <Text style={styles.label}>Plaka (isteğe bağlı)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Varsa yazın"
                    placeholderTextColor="#999"
                    value={plateNumber}
                    onChangeText={setPlateNumber}
                    autoCapitalize="characters"
                  />
                </>
              )}
              {step === 1 && (
                <>
                  <Text style={styles.stepHelp}>Motorunuz ve varsa plaka net görünsün.</Text>
                  <Text style={styles.sectionLabel}>Motor fotoğrafı</Text>
                  <Text style={styles.sectionHint}>Motor ve varsa plaka net görünsün.</Text>
                  {motorcyclePhoto ? (
                    <>
                      <PhotoUploadedStatusBar />
                      <PhotoCropHintAndPreview
                        uri={motorcyclePhoto}
                        onCrop={() =>
                          Platform.OS === 'web'
                            ? handleWebFileSelect('motorcycle')
                            : void pickImageMobile('motorcycle', 'gallery')
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
                      <ActivityIndicator color="#3FA9F5" />
                      <Text style={styles.analyzeText}>Motor fotoğrafı analiz ediliyor…</Text>
                    </View>
                  ) : null}
                  {vehicleAi?.status === 'red' ? (
                    <View style={styles.blockBanner}>
                      <Ionicons name="close-circle" size={22} color="#B91C1C" />
                      <Text style={styles.blockBannerText}>Bu fotoğrafla ilerlenemez. Lütfen daha net bir görüntü yükleyin.</Text>
                    </View>
                  ) : null}
                  {vehicleAi?.status === 'yellow' ? (
                    <View style={styles.warnBanner}>
                      <Ionicons name="warning" size={20} color="#B45309" />
                      <Text style={styles.warnBannerText}>Ön kontrol uyarısı: devam edebilirsiniz.</Text>
                    </View>
                  ) : null}
                  {vehicleAi ? <AiResultCard result={vehicleAi} subtitle="Motor görüntüsü analizi" /> : null}
                </>
              )}
              {step === 2 && (
                <>
                  <Text style={styles.stepHelp}>Ehliyetin tüm köşeleri görünmeli.</Text>
                  <Text style={styles.sectionLabel}>Ehliyet fotoğrafı</Text>
                  <Text style={styles.sectionHint}>Belge düz ve tam kadrajda olsun.</Text>
                  {licensePhoto ? (
                    <>
                      <PhotoUploadedStatusBar />
                      <PhotoCropHintAndPreview
                        uri={licensePhoto}
                        onCrop={() =>
                          Platform.OS === 'web'
                            ? handleWebFileSelect('license')
                            : void pickImageMobile('license', 'gallery')
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
                      <ActivityIndicator color="#3FA9F5" />
                      <Text style={styles.analyzeText}>Ehliyet analiz ediliyor…</Text>
                    </View>
                  ) : null}
                  {licenseAi?.status === 'red' ? (
                    <View style={styles.blockBanner}>
                      <Ionicons name="close-circle" size={22} color="#B91C1C" />
                      <Text style={styles.blockBannerText}>Ehliyet fotoğrafı yetersiz. Lütfen net bir görüntü yükleyin.</Text>
                    </View>
                  ) : null}
                  {licenseAi?.status === 'yellow' ? (
                    <View style={styles.warnBanner}>
                      <Ionicons name="warning" size={20} color="#B45309" />
                      <Text style={styles.warnBannerText}>Ön kontrol uyarısı: devam edebilirsiniz.</Text>
                    </View>
                  ) : null}
                  {licenseAi ? <AiResultCard result={licenseAi} subtitle="Ehliyet görüntüsü analizi" /> : null}
                </>
              )}
              {step === 3 && (
                <>
                  <Text style={styles.sectionLabel}>Selfie</Text>
                  <Text style={styles.sectionHint}>Yüzünüz net görünsün; admin incelemesi için gereklidir.</Text>
                  {selfiePhoto ? (
                    <>
                      <PhotoUploadedStatusBar />
                      <PhotoCropHintAndPreview
                        uri={selfiePhoto}
                        onCrop={() =>
                          Platform.OS === 'web'
                            ? handleWebFileSelect('selfie')
                            : void pickImageMobile('selfie', 'gallery')
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
                    {vehicleBrand} {vehicleModel}
                    {plateNumber.trim() ? ` · ${plateNumber.toUpperCase().trim()}` : ''}
                  </Text>
                  {vehicleAi ? <AiResultCard result={vehicleAi} subtitle="Motor görüntüsü analizi" /> : null}
                  {licenseAi ? <AiResultCard result={licenseAi} subtitle="Ehliyet görüntüsü analizi" /> : null}
                  <Text style={styles.stepHelp}>
                    Selfie yalnızca admin incelemesi içindir. Ön kontrol özeti ve belgeler güvenli şekilde kuyruğa
                    iletilir; son karar her zaman admin ekibindedir.
                  </Text>
                </>
              )}
            </>
          )}

          {/* Submit Status */}
          {submitStatus ? (
            <View style={styles.statusContainer}>
              <ActivityIndicator size="small" color="#3FA9F5" />
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
                  <ActivityIndicator color="#FFF" size="small" />
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
            <Text style={styles.modalTitle}>Marka Seçin</Text>
            <TouchableOpacity onPress={() => setShowBrandModal(false)}>
              <Ionicons name="close" size={28} color="#333" />
            </TouchableOpacity>
          </View>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={20} color="#999" />
            <TextInput
              style={styles.searchInput}
              placeholder="Marka ara..."
              placeholderTextColor="#999"
              value={brandSearch}
              onChangeText={setBrandSearch}
            />
          </View>
          <FlatList
            data={filteredBrands}
            keyExtractor={item => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.listItem, vehicleBrand === item && styles.listItemActive]}
                onPress={() => {
                  setVehicleBrand(item);
                  setVehicleModel('');
                  setShowBrandModal(false);
                  setBrandSearch('');
                }}
              >
                <Text style={[styles.listItemText, vehicleBrand === item && styles.listItemTextActive]}>
                  {item}
                </Text>
                {vehicleBrand === item && <Ionicons name="checkmark" size={22} color="#3FA9F5" />}
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
              <Ionicons name="close" size={28} color="#333" />
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
                {vehicleModel === item && <Ionicons name="checkmark" size={22} color="#3FA9F5" />}
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
    backgroundColor: '#F1F5F9',
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
    backgroundColor: 'rgba(248, 250, 252, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(248, 250, 252, 0.14)',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  headerKicker: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  headerTitleLight: {
    fontSize: 19,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  headerStepLight: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '600',
    color: '#CBD5E1',
    textAlign: 'center',
    lineHeight: 18,
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
    backgroundColor: '#38BDF8',
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 8,
    elevation: 4,
  },
  stepDotOff: {
    backgroundColor: 'rgba(148, 163, 184, 0.35)',
  },
  stepDotLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
  },
  stepDotLabelOn: {
    color: '#E0F2FE',
  },
  infoCardPremium: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 3,
  },
  infoIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#F0F9FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  infoTextCol: {
    flex: 1,
  },
  infoTitlePremium: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  infoBodyPremium: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 20,
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
    marginBottom: 20,
  },
  progressGlow: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#0EA5E9',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  sectionHint: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 19,
    marginBottom: 12,
  },
  stepHelp: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 20,
    marginBottom: 14,
    backgroundColor: '#F8FAFC',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  analyzeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  analyzeText: {
    fontSize: 14,
    color: '#3FA9F5',
    fontWeight: '500',
  },
  blockBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
  },
  blockBannerText: {
    flex: 1,
    fontSize: 13,
    color: '#991B1B',
    lineHeight: 18,
  },
  warnBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
  },
  warnBannerText: {
    flex: 1,
    fontSize: 13,
    color: '#92400E',
    lineHeight: 18,
  },
  summaryTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1B1B1E',
    marginBottom: 10,
  },
  summaryLine: {
    fontSize: 15,
    color: '#334155',
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
    borderTopColor: '#E2E8F0',
  },
  navBtnSecondary: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnSecondaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
    letterSpacing: 0.2,
  },
  navBtnPrimary: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: '#0284C7',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  navBtnPrimaryText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 0.35,
  },
  navBtnDisabled: {
    opacity: 0.4,
    shadowOpacity: 0,
    elevation: 0,
    backgroundColor: '#94A3B8',
  },
  submitBtnFooter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 10,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 5,
  },
  submitBtnDisabled: {
    backgroundColor: '#94A3AF',
    shadowOpacity: 0,
    elevation: 0,
    opacity: 0.72,
  },
  content: {
    flex: 1,
    padding: 18,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#FFF',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 10,
  },
  selectDisabled: {
    opacity: 0.5,
  },
  selectText: {
    flex: 1,
    fontSize: 16,
    color: '#999',
  },
  selectTextActive: {
    color: '#1B1B1E',
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
    backgroundColor: '#FFF',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    width: '18%',
    minWidth: 58,
  },
  colorItemActive: {
    borderColor: '#3FA9F5',
    backgroundColor: '#EBF5FF',
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
    color: '#666',
    textAlign: 'center',
  },
  colorNameActive: {
    color: '#3FA9F5',
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
  },
  removePhotoBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FFF',
    borderRadius: 14,
  },
  // Status
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    gap: 10,
    marginTop: 16,
  },
  statusText: {
    fontSize: 14,
    color: '#3FA9F5',
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
    backgroundColor: '#F5F7FA',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1B1B1E',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    margin: 16,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchInput: {
    flex: 1,
    padding: 12,
    fontSize: 16,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 10,
  },
  listItemActive: {
    backgroundColor: '#EBF5FF',
    borderWidth: 1,
    borderColor: '#3FA9F5',
  },
  listItemText: {
    fontSize: 16,
    color: '#1B1B1E',
  },
  listItemTextActive: {
    fontWeight: '600',
    color: '#3FA9F5',
  },
});
