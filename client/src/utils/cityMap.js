// The signed-in screens sit on a flat OpenStreetMap-based map of the selected
// city. The current map lives in a CSS variable on <html> (--city-map), which
// .portal-bg::before (index.css) paints, so changing it re-skins every screen
// at once. Map data © OpenStreetMap contributors (credited on the Privacy page).
const BASE = '/images/auckland-map-beige.webp';
export const CITY_MAPS = {
  Auckland: BASE,
  Wellington: '/images/maps/wellington.webp',
  Sydney: '/images/maps/sydney.webp',
  Melbourne: '/images/maps/melbourne.webp',
  Brisbane: '/images/maps/brisbane.webp',
};
const KEY = 'heyder_map_city';
let current = null;
let flip = false;

export function getMapCity() {
  try { const c = localStorage.getItem(KEY); return c && CITY_MAPS[c] ? c : null; } catch { return null; }
}

const apply = (url, fade) => {
  const root = document.documentElement;
  root.style.setProperty('--city-map', `url("${url}")`);
  if (fade) { flip = !flip; root.style.setProperty('--map-fade', flip ? 'mapFadeA' : 'mapFadeB'); }
};

// Call once at startup: restores the last chosen city's map with no animation.
export function initMapCity() {
  const c = getMapCity();
  if (c) { current = c; apply(CITY_MAPS[c], false); }
}

// Switch the background to a city's map. The image is loaded first so the swap
// never flashes an empty background, then it fades in.
export function setMapCity(city) {
  const url = CITY_MAPS[city];
  if (!url || city === current) return;
  current = city;
  try { localStorage.setItem(KEY, city); } catch { /* storage unavailable: map still switches for this session */ }
  const img = new Image();
  const done = () => { if (current === city) apply(url, true); };
  img.onload = done; img.onerror = done;
  img.src = url;
}
