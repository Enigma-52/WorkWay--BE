// Personal/free webmail providers allowed for magic-link sign-in. Restricting
// to this list cuts down on throwaway/disposable-domain spam signups. Google
// sign-in has no such restriction, since it's already tied to a real Google
// account.
export const ALLOWED_EMAIL_DOMAINS = new Set([
  // Google
  'gmail.com',
  'googlemail.com',
  // Yahoo
  'yahoo.com',
  'yahoo.co.uk',
  'yahoo.co.in',
  'yahoo.ca',
  'yahoo.com.au',
  'yahoo.fr',
  'yahoo.de',
  'ymail.com',
  'rocketmail.com',
  // Microsoft
  'outlook.com',
  'hotmail.com',
  'hotmail.co.uk',
  'live.com',
  'msn.com',
  // Apple
  'icloud.com',
  'me.com',
  'mac.com',
  // Proton
  'proton.me',
  'protonmail.com',
  'pm.me',
  // Other established providers
  'aol.com',
  'gmx.com',
  'gmx.us',
  'zoho.com',
  'yandex.com',
  'yandex.ru',
  'mail.com',
  'mail.ru',
  'fastmail.com',
  'hey.com',
  'tutanota.com',
  'tutanota.de',
  'tuta.io',
  'rediffmail.com',
]);

export function isAllowedEmailDomain(email) {
  const domain = String(email || '').split('@')[1]?.toLowerCase().trim();
  return !!domain && ALLOWED_EMAIL_DOMAINS.has(domain);
}
