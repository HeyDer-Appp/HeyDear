// Great-circle distance in metres between two lat/lng points.
function distanceMetres(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Automatic arrival check-in: a diner counts as arrived once their phone is
// within this distance of the restaurant during the window below.
const CHECKIN_RADIUS_M = 150;
// A phone reporting worse accuracy than this can't say whether it is at the door.
const CHECKIN_MAX_ACCURACY_M = 200;
// Window, in NZ time on the dinner night: opens 6:30pm (30 min before the 7pm
// sit-down), closes 11:30pm.
const CHECKIN_OPENS = { h: 18, m: 30 };
const CHECKIN_CLOSES = { h: 23, m: 30 };

module.exports = { distanceMetres, CHECKIN_RADIUS_M, CHECKIN_MAX_ACCURACY_M, CHECKIN_OPENS, CHECKIN_CLOSES };
