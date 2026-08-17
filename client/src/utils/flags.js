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
