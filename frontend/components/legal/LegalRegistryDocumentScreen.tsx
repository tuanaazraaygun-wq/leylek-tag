import React, { useMemo } from 'react';
import { LegalDocumentReader, type LegalSection } from './LegalDocumentReader';
import { getLegalRegistryDocument } from '../../lib/legal/documents';
import type { LegalRegistryDocumentId } from '../../lib/legal/legalDocumentTypes';

type LegalRegistryDocumentScreenProps = {
  documentId: LegalRegistryDocumentId;
};

export function LegalRegistryDocumentScreen({ documentId }: LegalRegistryDocumentScreenProps) {
  const doc = getLegalRegistryDocument(documentId);

  const sections = useMemo((): LegalSection[] => {
    const draftNotice: LegalSection = {
      title: 'Taslak — hukukçu incelemesi bekler',
      body:
        `Sürüm: ${doc.version}\nSon güncelleme: ${doc.lastUpdated}\nTahmini okuma: ~${doc.readingTimeMinutes} dk\n\n` +
        'Bu sayfadaki metinler taslak olup nitelikli hukukçu onayı tamamlanmadan bağlayıcı hukuki dayanak olarak kullanılmamalıdır.',
    };
    return [draftNotice, ...doc.sections];
  }, [doc]);

  const lastUpdatedLabel = `${doc.lastUpdated} · ${doc.version}`;

  return (
    <LegalDocumentReader
      title={doc.title}
      subtitle={doc.subtitle}
      sections={sections}
      showCompanyMeta
      lastUpdated={lastUpdatedLabel}
    />
  );
}
