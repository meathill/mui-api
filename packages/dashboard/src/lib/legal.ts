export const CURRENT_TERMS_VERSION = '2026-09-01';
export const CURRENT_PRIVACY_VERSION = '2026-09-01';

export function needsReconsent(user: {
  acceptedTermsVersion?: string | null;
  acceptedPrivacyVersion?: string | null;
  acceptedTermsAt?: string | Date | null;
}): boolean {
  if (!user.acceptedTermsAt) return true;
  if (user.acceptedTermsVersion !== CURRENT_TERMS_VERSION) return true;
  if (user.acceptedPrivacyVersion !== CURRENT_PRIVACY_VERSION) return true;
  return false;
}
