import React, { useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { premiumAuthStyles as pa } from './premiumAuthStyles';
import type { AuthLightSurfaces } from './premiumAuthChrome';

export type AuthLegalDoc = 'kvkk' | 'privacy' | 'terms';

type AuthLegalConsentBlockProps = {
  onValidityChange: (valid: boolean) => void;
  onOpenDoc: (doc: AuthLegalDoc) => void;
  /** Restore all boxes when session/storage already marked legal complete. */
  seedAccepted?: boolean;
  lightSurfaces?: AuthLightSurfaces;
};

function LegalCheckboxRow({
  checked,
  onToggle,
  lightSurfaces,
  children,
}: {
  checked: boolean;
  onToggle: () => void;
  lightSurfaces?: AuthLightSurfaces;
  children: React.ReactNode;
}) {
  return (
    <View style={pa.kvkkRow}>
      <TouchableOpacity
        onPress={onToggle}
        activeOpacity={0.85}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
      >
        <View
          style={[
            pa.checkboxOuter,
            lightSurfaces?.checkboxOuter,
            checked && pa.checkboxFilled,
            checked && lightSurfaces?.checkboxFilled,
          ]}
        >
          {checked ? (
            <Ionicons name="checkmark" size={14} color={lightSurfaces?.checkboxCheck ?? '#0F172A'} />
          ) : null}
        </View>
      </TouchableOpacity>
      <Text style={pa.kvkkBlock}>{children}</Text>
    </View>
  );
}

export function AuthLegalConsentBlock({
  onValidityChange,
  onOpenDoc,
  seedAccepted = false,
  lightSurfaces,
}: AuthLegalConsentBlockProps) {
  const [kvkkAcknowledged, setKvkkAcknowledged] = useState(false);
  const [privacyAcknowledged, setPrivacyAcknowledged] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [ageDeclared, setAgeDeclared] = useState(false);

  useEffect(() => {
    if (!seedAccepted) return;
    setKvkkAcknowledged(true);
    setPrivacyAcknowledged(true);
    setTermsAccepted(true);
    setAgeDeclared(true);
  }, [seedAccepted]);

  const allValid = kvkkAcknowledged && privacyAcknowledged && termsAccepted && ageDeclared;

  useEffect(() => {
    onValidityChange(allValid);
  }, [allValid, onValidityChange]);

  const link = [pa.kvkkLink, lightSurfaces?.kvkkLink] as const;
  const plain = [pa.kvkkPlain, lightSurfaces?.kvkkPlain] as const;

  return (
    <View style={{ marginBottom: 4 }}>
      <LegalCheckboxRow
        checked={kvkkAcknowledged}
        onToggle={() => setKvkkAcknowledged((v) => !v)}
        lightSurfaces={lightSurfaces}
      >
        <Text onPress={() => onOpenDoc('kvkk')} style={link}>
          KVKK Aydınlatma Metni
        </Text>
        <Text style={plain}>&apos;ni okudum ve anladım.</Text>
      </LegalCheckboxRow>

      <LegalCheckboxRow
        checked={privacyAcknowledged}
        onToggle={() => setPrivacyAcknowledged((v) => !v)}
        lightSurfaces={lightSurfaces}
      >
        <Text onPress={() => onOpenDoc('privacy')} style={link}>
          Gizlilik Politikası
        </Text>
        <Text style={plain}>&apos;nı okudum ve anladım.</Text>
      </LegalCheckboxRow>

      <LegalCheckboxRow
        checked={termsAccepted}
        onToggle={() => setTermsAccepted((v) => !v)}
        lightSurfaces={lightSurfaces}
      >
        <Text onPress={() => onOpenDoc('terms')} style={link}>
          Kullanım Şartları
        </Text>
        <Text style={plain}>&apos;nı okudum ve kabul ediyorum.</Text>
      </LegalCheckboxRow>

      <LegalCheckboxRow
        checked={ageDeclared}
        onToggle={() => setAgeDeclared((v) => !v)}
        lightSurfaces={lightSurfaces}
      >
        <Text style={plain}>18 yaşından büyük olduğumu beyan ederim.</Text>
      </LegalCheckboxRow>
    </View>
  );
}
