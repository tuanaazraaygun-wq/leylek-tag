/**
 * Legacy `/terms` alias — same registry content as Kullanıcı Sözleşmesi (`/terms-user`).
 */
import React from 'react';
import { LegalRegistryDocumentScreen } from '../components/legal/LegalRegistryDocumentScreen';

export default function TermsScreen() {
  return <LegalRegistryDocumentScreen documentId="terms-user" />;
}
