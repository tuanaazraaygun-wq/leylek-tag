/** Re-exports for backward compatibility and App Store `/privacy` imports. */
export {
  getPrivacyPolicy,
  privacyLanguageSwitch,
  privacyPolicyByLocale,
  type PrivacyLocale,
  type PrivacyPolicyLocaleContent,
} from "@/lib/privacy-policy-locales";

import { privacyPolicyByLocale } from "@/lib/privacy-policy-locales";

export const privacyPolicyDocument = privacyPolicyByLocale.en;
export const privacyPolicyContact = privacyPolicyByLocale.en.contact;
