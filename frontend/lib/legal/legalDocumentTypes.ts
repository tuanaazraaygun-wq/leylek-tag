import type { LegalSection } from '../../components/legal/LegalDocumentReader';

/** SSOT registry document identifiers. */
export type LegalRegistryDocumentId =
  | 'terms-user'
  | 'terms-driver'
  | 'identity-verification'
  | 'contribution-iban'
  | 'community-guidelines'
  | 'kvkk'
  | 'privacy';

/** In-app legal routes not backed by the registry document store. */
export type LegalLegacyRouteId = 'terms' | 'delete-account' | 'support';

export type LegalHubLinkId = LegalRegistryDocumentId | LegalLegacyRouteId;

export type LegalDocumentMeta = {
  id: LegalRegistryDocumentId;
  title: string;
  subtitle: string;
  version: string;
  lastUpdated: string;
  company: string;
  lawyerReviewRequired: boolean;
  readingTimeMinutes: number;
};

export type LegalRegistryDocument = LegalDocumentMeta & {
  sections: LegalSection[];
};

export type LegalHubLink = {
  id: LegalHubLinkId;
  title: string;
  description?: string;
  route: string;
  icon: string;
  isDraft?: boolean;
  isLegacy?: boolean;
};

export type LegalDocumentGroup = {
  id: string;
  title: string;
  description?: string;
  links: LegalHubLink[];
};
