// Mirrors the fixed COUNTRIES dropdown in Quiz.jsx — signup only ever
// captures one of these exact names, so a lookup table is all that's needed
// (no need for a full country-name-to-ISO-code library).
const COUNTRY_CODES = {
  'New Zealand': 'nz', 'Australia': 'au', 'India': 'in', 'United Kingdom': 'gb', 'United States': 'us',
  'China': 'cn', 'Philippines': 'ph', 'South Africa': 'za', 'Canada': 'ca', 'Fiji': 'fj', 'Samoa': 'ws', 'Tonga': 'to',
  'South Korea': 'kr', 'Japan': 'jp', 'Singapore': 'sg', 'Malaysia': 'my', 'Sri Lanka': 'lk', 'Bangladesh': 'bd',
  'Pakistan': 'pk', 'Nepal': 'np', 'Germany': 'de', 'France': 'fr', 'Italy': 'it', 'Netherlands': 'nl', 'Ireland': 'ie',
  'Brazil': 'br', 'Colombia': 'co', 'Mexico': 'mx', 'Zimbabwe': 'zw', 'Nigeria': 'ng', 'Ghana': 'gh', 'Kenya': 'ke',
};

// Windows doesn't ship flag glyphs in its emoji font, so a Unicode
// regional-indicator flag emoji just renders as plain "NZ"/"IN" letters in
// a box there instead of an actual flag — an <img> pointing at a real flag
// image renders identically on every OS instead.
export function flagUrl(countryName) {
  const code = COUNTRY_CODES[countryName];
  return code ? `https://flagcdn.com/24x18/${code}.png` : null;
}

// Phone number length varies wildly by country (NZ mobiles are commonly 9
// digits, e.g. "021 993 041" — not everyone's on a 10-digit plan like
// India's), so a dial-code picker plus a loose overall length check is the
// only validation that actually works across every signup's home country.
export const DIAL_CODES = [
  ['New Zealand', '+64'], ['Australia', '+61'], ['India', '+91'], ['United Kingdom', '+44'], ['United States', '+1'],
  ['China', '+86'], ['Philippines', '+63'], ['South Africa', '+27'], ['Canada', '+1'], ['Fiji', '+679'], ['Samoa', '+685'], ['Tonga', '+676'],
  ['South Korea', '+82'], ['Japan', '+81'], ['Singapore', '+65'], ['Malaysia', '+60'], ['Sri Lanka', '+94'], ['Bangladesh', '+880'],
  ['Pakistan', '+92'], ['Nepal', '+977'], ['Germany', '+49'], ['France', '+33'], ['Italy', '+39'], ['Netherlands', '+31'], ['Ireland', '+353'],
  ['Brazil', '+55'], ['Colombia', '+57'], ['Mexico', '+52'], ['Zimbabwe', '+263'], ['Nigeria', '+234'], ['Ghana', '+233'], ['Kenya', '+254'],
];
