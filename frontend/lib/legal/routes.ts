import type { LegalHubLinkId, LegalRegistryDocumentId } from './legalDocumentTypes';

/** In-app Expo Router paths for legal surfaces. */
export const LEGAL_ROUTES = {
  trustCenter: '/trust-center',
  termsUser: '/terms-user',
  termsDriver: '/terms-driver',
  identityVerification: '/identity-verification',
  contributionIban: '/contribution-iban',
  communityGuidelines: '/community-guidelines',
  privacy: '/privacy',
  terms: '/terms',
  kvkk: '/kvkk',
  deleteAccount: '/delete-account',
  support: '/support',
} as const;

const REGISTRY_ROUTE_MAP: Record<LegalRegistryDocumentId, string> = {
  'terms-user': LEGAL_ROUTES.termsUser,
  'terms-driver': LEGAL_ROUTES.termsDriver,
  'identity-verification': LEGAL_ROUTES.identityVerification,
  'contribution-iban': LEGAL_ROUTES.contributionIban,
  'community-guidelines': LEGAL_ROUTES.communityGuidelines,
  kvkk: LEGAL_ROUTES.kvkk,
  privacy: LEGAL_ROUTES.privacy,
};

const HUB_ROUTE_MAP: Record<LegalHubLinkId, string> = {
  ...REGISTRY_ROUTE_MAP,
  privacy: LEGAL_ROUTES.privacy,
  terms: LEGAL_ROUTES.terms,
  kvkk: LEGAL_ROUTES.kvkk,
  'delete-account': LEGAL_ROUTES.deleteAccount,
  support: LEGAL_ROUTES.support,
};

export function getLegalRoute(id: LegalHubLinkId): string {
  return HUB_ROUTE_MAP[id];
}

export function getRegistryDocumentRoute(id: LegalRegistryDocumentId): string {
  return REGISTRY_ROUTE_MAP[id];
}

/** Auth consent checkbox → in-app legal route (Kullanıcı Sözleşmesi). */
export function getAuthLegalDocRoute(doc: 'kvkk' | 'privacy' | 'terms'): string {
  if (doc === 'terms') return LEGAL_ROUTES.termsUser;
  if (doc === 'privacy') return LEGAL_ROUTES.privacy;
  return LEGAL_ROUTES.kvkk;
}
