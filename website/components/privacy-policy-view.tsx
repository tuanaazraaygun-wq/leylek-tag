import { LegalPage } from "@/components/legal-page";
import { getPrivacyPolicy, privacyLanguageSwitch, type PrivacyLocale } from "@/lib/privacy-policy-locales";

type Props = {
  locale: PrivacyLocale;
};

export function PrivacyPolicyView({ locale }: Props) {
  const content = getPrivacyPolicy(locale);

  return (
    <LegalPage
      document={content}
      contact={content.contact}
      updatedLabel={content.updatedLabel}
      backLabel={content.backLabel}
      languageSwitch={{ activeLocale: locale, options: privacyLanguageSwitch }}
    />
  );
}
