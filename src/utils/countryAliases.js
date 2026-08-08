import countries from 'world-countries';

const byCca3 = new Map(countries.map((c) => [c.cca3, c]));

// Job locations are free text like "USA - Remote - Denver" or "Bengaluru, Karnataka, India" —
// no structured country column. Given a canonical ISO alpha-3 code (from the frontend's country
// picker), return a small set of text fragments worth ILIKE-matching against `location`.
export function getCountryLocationPatterns(cca3) {
  const country = byCca3.get(String(cca3 || '').toUpperCase());
  if (!country) return [];

  // Keeping this to exactly two patterns matters for query performance: the
  // trigram index degrades to a full seq scan once too many ILIKE branches
  // are OR'd together (see jobsDao.js buildListWhere).
  return [...new Set([country.cca3, country.name.common])];
}

export function isValidCountryCode(cca3) {
  return byCca3.has(String(cca3 || '').toUpperCase());
}
