// HeyDer dinners are always "7pm in Auckland" — but Render runs this server
// in UTC (not NZ time), and NZ itself shifts between NZST (UTC+12) and NZDT
// (UTC+13, ~late Sept to early April). Using Date.setHours() computes "7pm"
// on whatever clock the server process happens to be running, which is
// wrong for every reveal/countdown feature in the app. Intl's timeZone-aware
// formatting already has NZ's DST rules built in, so this reads Auckland's
// actual UTC offset for a given instant instead of assuming a fixed one.
const TIME_ZONE = 'Pacific/Auckland';

function offsetMinutesAt(utcInstant) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const parts = {};
  for (const p of dtf.formatToParts(utcInstant)) parts[p.type] = p.value;
  const asIfUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return (asIfUtc - utcInstant.getTime()) / 60000;
}

// dateInput's calendar day (read as UTC, since dinner dates are stored at
// UTC midnight of the intended day — see admin/dinners.js's dateToTimestamp)
// plus a wall-clock hour:minute *in Auckland* -> the correct UTC instant.
function nzTime(dateInput, hours, minutes = 0) {
  const d = new Date(dateInput);
  const y = d.getUTCFullYear(), m = d.getUTCMonth(), day = d.getUTCDate();
  const guess = new Date(Date.UTC(y, m, day, hours, minutes, 0));
  const offset = offsetMinutesAt(guess);
  return new Date(guess.getTime() - offset * 60000);
}

module.exports = { nzTime };
