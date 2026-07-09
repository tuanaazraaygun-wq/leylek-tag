import type { LegalDocumentGroup } from './legalDocumentTypes';
import { LEGAL_PRODUCT_DISPLAY_NAME } from './brand';
import { LEGAL_ROUTES } from './routes';

export const TRUST_CENTER_SUMMARY =
  `${LEGAL_PRODUCT_DISPLAY_NAME}, gönüllü yol paylaşımı ve kişi eşleştirme için güven, iletişim ve eşleşme altyapısı sağlar.`;

export const LEGAL_DOCUMENT_GROUPS: LegalDocumentGroup[] = [
  {
    id: 'platform',
    title: 'Platform ve hesap',
    description: 'Genel kullanım, gizlilik ve veri koruma',
    links: [
      {
        id: 'terms-user',
        title: 'Kullanıcı Sözleşmesi',
        description: 'Üyelik, roller, katkı payı ve sorumluluklar',
        route: LEGAL_ROUTES.termsUser,
        icon: 'document-text-outline',
      },
      {
        id: 'privacy',
        title: 'Gizlilik Politikası',
        description: 'Kişisel verilerin korunması',
        route: LEGAL_ROUTES.privacy,
        icon: 'lock-closed-outline',
        isLegacy: true,
      },
      {
        id: 'kvkk',
        title: 'KVKK Aydınlatma Metni',
        description: 'Veri sorumlusu bilgilendirmesi',
        route: LEGAL_ROUTES.kvkk,
        icon: 'information-circle-outline',
        isLegacy: true,
      },
      {
        id: 'delete-account',
        title: 'Hesap Silme',
        description: 'Hesap ve veri silme süreci',
        route: LEGAL_ROUTES.deleteAccount,
        icon: 'trash-outline',
        isLegacy: true,
      },
    ],
  },
  {
    id: 'driver',
    title: 'Sürücü ve doğrulama',
    description: 'Gönüllü sürücü profili ve kimlik doğrulama',
    links: [
      {
        id: 'terms-driver',
        title: 'Sürücü Sözleşmesi',
        description: 'Ehliyet, sigorta, trafik ve belge yükümlülükleri',
        route: LEGAL_ROUTES.termsDriver,
        icon: 'car-outline',
      },
      {
        id: 'identity-verification',
        title: 'Kimlik Doğrulama Bilgilendirmesi',
        description: 'Belge inceleme ve doğrulama süreci',
        route: LEGAL_ROUTES.identityVerification,
        icon: 'shield-checkmark-outline',
      },
    ],
  },
  {
    id: 'contribution',
    title: 'Katkı payı',
    description: 'Masraf paylaşımı — platform tahsilat yapmaz',
    links: [
      {
        id: 'contribution-iban',
        title: 'Katkı Payı ve IBAN Bilgilendirmesi',
        description: 'Nakit, havale ve taraflar arası mutabakat',
        route: LEGAL_ROUTES.contributionIban,
        icon: 'wallet-outline',
      },
    ],
  },
  {
    id: 'community',
    title: 'Topluluk',
    description: 'İletişim ve güvenli yol paylaşımı standartları',
    links: [
      {
        id: 'community-guidelines',
        title: 'Topluluk Kuralları',
        description: 'Saygılı davranış, güvenlik ve hukuka uygun kullanım',
        route: LEGAL_ROUTES.communityGuidelines,
        icon: 'people-outline',
      },
    ],
  },
  {
    id: 'support',
    title: 'İletişim ve destek',
    description: 'Destek kanalları ve başvuru',
    links: [
      {
        id: 'support',
        title: 'İletişim / Destek',
        description: 'E-posta, telefon ve başvuru kanalları',
        route: LEGAL_ROUTES.support,
        icon: 'headset-outline',
      },
    ],
  },
];
