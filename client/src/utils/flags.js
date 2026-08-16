// Mirrors the fixed COUNTRIES dropdown in Quiz.jsx — signup only ever
// captures one of these exact names, so a lookup table is all that's needed
// (no need for a full country-name-to-ISO-code library).
const COUNTRY_CODES = {
  'New Zealand': 'NZ', 'Australia': 'AU', 'India': 'IN', 'United Kingdom': 'GB', 'United States': 'US',
  'China': 'CN', 'Philippines': 'PH', 'South Africa': 'ZA', 'Canada': 'CA', 'Fiji': 'FJ', 'Samoa': 'WS', 'Tonga': 'TO',
  'South Korea': 'KR', 'Japan': 'JP', 'Singapore': 'SG', 'Malaysia': 'MY', 'Sri Lanka': 'LK', 'Bangladesh': 'BD',
  'Pakistan': 'PK', 'Nepal': 'NP', 'Germany': 'DE', 'France': 'FR', 'Italy': 'IT', 'Netherlands': 'NL', 'Ireland': 'IE',
  'Brazil': 'BR', 'Colombia': 'CO', 'Mexico': 'MX', 'Zimbabwe': 'ZW', 'Nigeria': 'NG', 'Ghana': 'GH', 'Kenya': 'KE',
};

// Flag emoji are just two Unicode "regional indicator" letters — A-Z map to
// U+1F1E6-U+1F1FF in order, so any ISO alpha-2 code converts directly with
// no image assets or extra dependency needed.
export function flagEmoji(countryName) {
  const code = COUNTRY_CODES[countryName];
  if (!code) return '';
  return [...code.toUpperCase()].map(c => String.fromCodePoint(127397 + c.charCodeAt(0))).join('');
}
