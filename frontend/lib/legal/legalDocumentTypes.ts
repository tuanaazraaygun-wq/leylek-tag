import type { LegalSection } from '../../components/legal/LegalDocumentReader';

/** SSOT registry document identifiers (Phase 1 draft docs). */
export type LegalRegistryDocumentId =
  | 'terms-user'
  | 'terms-driver'
  | 'identity-verification'
  | 'contribution-iban'
  | 'community-guidelines';

/** Legacy in-app legal routes kept unchanged in Phase 1. */
export type LegalLegacyRouteId = 'privacy' | 'terms' | 'kvkk' | 'delete-account';

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
