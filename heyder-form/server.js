require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const { google } = require('googleapis');
const Stripe = require('stripe');

const PORT = process.env.PORT || 3100;
const BASE_URL = (process.env.BASE_URL || `http://localhost:${PORT}`).replace(/\/+$/, '');
const CURRENCY = process.env.STRIPE_CURRENCY || 'nzd';
// Amounts in cents. Defaults match the live Typeform's payment step: one-time "HeyDer Booking fee", NZ$9.00.
const ONE_TIME_AMOUNT = parseInt(process.env.STRIPE_ONE_TIME_AMOUNT, 10) || 900;
// The Typeform has no membership option; set SUBSCRIPTION_ENABLED=true to also offer the app's monthly plan.
const SUBSCRIPTION_ENABLED = process.env.SUBSCRIPTION_ENABLED === 'true';
const SUBSCRIPTION_AMOUNT = parseInt(process.env.STRIPE_SUBSCRIPTION_AMOUNT, 10) || 1500;
// Offered only when someone tries to skip payment, never up front (same as the app).
const SKIP_DISCOUNT_PERCENT = parseInt(process.env.SKIP_DISCOUNT_PERCENT, 10) || 10;
const SHEET_TAB = process.env.GOOGLE_SHEET_TAB || 'Responses';
const SHEET_ID = process.env.GOOGLE_SHEET_ID;

const stripe = process.env.STRIPE_SECRET_KEY ? Stripe(process.env.STRIPE_SECRET_KEY) : null;

const DATA_DIR = path.join(__dirname, 'data');
const STORE_FILE = path.join(DATA_DIR, 'submissions.json');
const COUPONS_FILE = process.env.COUPONS_FILE || path.join(__dirname, 'coupons.json');
fs.mkdirSync(DATA_DIR, { recursive: true });

// ---------- tiny local store (also a backup if Sheets is ever down) ----------
let store = {};
try { store = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8')); } catch { store = {}; }
const saveStore = () => fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2));

function loadCoupons() {
  try { return JSON.parse(fs.readFileSync(COUPONS_FILE, 'utf8')); } catch { return {}; }
}
function lookupCoupon(code) {
  if (!code) return null;
  const key = String(code).trim().toUpperCase();
  const c = loadCoupons()[key];
  if (!c || c.active === false) return null;
  if (c.expiresAt && new Date(c.expiresAt) < new Date()) return null;
  return { code: key, discountPercent: Number(c.discountPercent) || 0, type: c.type || null };
}
const couponMatchesPlan = (c, plan) => !c.type || c.type === plan;

// ---------- Google Sheets ----------
const COLUMNS = [
  ['Submission ID', s => s.id],
  ['Submitted At (NZ)', s => nzTime(s.submittedAt)],
  ['Location', s => s.a.location],
  ["I'm looking for", s => s.a.lookingFor],
  ['Tuesday night', s => s.a.tuesday],
  ['Relationship status', s => s.a.relationship],
  ['Life stage', s => s.a.lifeStage],
  ['Consider yourself as', s => s.a.personality],
  ['Social battery', s => s.a.battery],
  ['Career choice (paid equally)', s => s.a.career],
  ['Deep conversations in a group (0-10)', s => s.a.deepConvo],
  ['Sarcastic in nature (0-10)', s => s.a.sarcastic],
  ['Financial security comes first (0-10)', s => s.a.financial],
  ['Usually initiates plans (0-10)', s => s.a.initiates],
  ['Asks questions when curious (0-10)', s => s.a.curious],
  ['Reliability importance (0-10)', s => s.a.reliability],
  ['Social circle', s => s.a.socialCircle],
  ['Talking topics', s => s.a.topics],
  ['Typical weekend', s => s.a.weekend],
  ['Career/job to a kid', s => s.a.careerToKid],
  ['Set menu budget', s => s.a.budget],
  ['Dietary / allergens', s => (s.a.dietary || []).join(', ')],
  ['First name', s => s.a.firstName],
  ['Last name', s => s.a.lastName],
  ['Phone', s => s.a.phone],
  ['Email', s => s.a.email],
  ['Date of birth', s => s.a.dob],
  ['Gender', s => s.a.gender],
  ['Country', s => s.a.country],
  ['Payment status', s => s.status],
  ['Plan', s => s.plan || ''],
  ['Coupon', s => s.coupon || ''],
  ['Amount paid (NZD)', s => (s.amountPaid != null ? (s.amountPaid / 100).toFixed(2) : '')],
  ['Stripe session', s => s.stripeSession || ''],
  ['Status updated (NZ)', s => nzTime(s.updatedAt)],
];
const lastCol = colLetter(COLUMNS.length);

function colLetter(n) {
  let s = '';
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}
function nzTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-NZ', { timeZone: 'Pacific/Auckland', hour12: false });
}
// A leading = + - @ would be evaluated as a formula by Sheets — neutralise it.
const safeCell = v => {
  if (v == null) return '';
  const s = String(v);
  return /^[=+\-@]/.test(s) ? `'${s}` : s;
};
const toRow = s => COLUMNS.map(([, f]) => safeCell(f(s)));

let sheetsApi = null;
function getSheets() {
  if (sheetsApi) return sheetsApi;
  if (!SHEET_ID) return null;
  let credentials;
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (raw) {
    credentials = raw.trim().startsWith('{') ? JSON.parse(raw) : JSON.parse(fs.readFileSync(raw, 'utf8'));
  } else if (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
    credentials = { client_email: process.env.GOOGLE_CLIENT_EMAIL, private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') };
  } else {
    return null;
  }
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  sheetsApi = google.sheets({ version: 'v4', auth });
  return sheetsApi;
}

let sheetReady = null;
async function ensureSheet() {
  const sheets = getSheets();
  if (!sheets) return false;
  if (!sheetReady) {
    sheetReady = (async () => {
      const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
      if (!meta.data.sheets.some(sh => sh.properties.title === SHEET_TAB)) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: SHEET_ID,
          requestBody: { requests: [{ addSheet: { properties: { title: SHEET_TAB, gridProperties: { frozenRowCount: 1 } } } }] },
        });
      }
      const head = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${SHEET_TAB}!A1:A1` });
      if (!head.data.values || !head.data.values.length) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: SHEET_ID,
          range: `${SHEET_TAB}!A1`,
          valueInputOption: 'RAW',
          requestBody: { values: [COLUMNS.map(([h]) => h)] },
        });
      }
      return true;
    })().catch(err => { sheetReady = null; throw err; });
  }
  return sheetReady;
}

// Simplest setup: a Google Apps Script web app bound to the sheet (see apps-script/Code.gs).
// It does the append-or-update by Submission ID, so no service account is needed.
const SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL;
async function scriptUpsert(sub) {
  const r = await fetch(SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ secret: process.env.GOOGLE_SCRIPT_SECRET || '', tab: SHEET_TAB, headers: COLUMNS.map(([h]) => h), row: toRow(sub) }),
    redirect: 'follow',
  });
  const text = await r.text();
  if (!r.ok || !/"ok":\s*true/.test(text)) throw new Error('Apps Script said: ' + text.slice(0, 200));
}

async function sheetAppend(sub) {
  if (SCRIPT_URL) return scriptUpsert(sub);
  if (!(await ensureSheet())) { console.warn('[sheets] not configured — saved locally only'); return; }
  await getSheets().spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_TAB}!A1`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [toRow(sub)] },
  });
}

// Rewrites the payment columns of an existing row, located by Submission ID.
async function sheetUpdate(sub) {
  if (SCRIPT_URL) return scriptUpsert(sub);
  if (!(await ensureSheet())) return;
  const sheets = getSheets();
  const ids = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${SHEET_TAB}!A:A` });
  const rowIdx = (ids.data.values || []).findIndex(r => r[0] === sub.id);
  if (rowIdx === -1) return sheetAppend(sub);
  const n = rowIdx + 1;
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_TAB}!A${n}:${lastCol}${n}`,
    valueInputOption: 'RAW',
    requestBody: { values: [toRow(sub)] },
  });
}

// Sheets calls shouldn't make a payment fail: queue + log, never throw to the caller.
let chain = Promise.resolve();
function queueSheet(fn, sub) {
  chain = chain.then(() => fn(sub)).catch(err => console.error('[sheets] write failed:', err.message));
  return chain;
}

// ---------- validation ----------
const OPTIONS = {
  location: ['Auckland', 'Wellington', 'None of the above'],
  lookingFor: ['meaningful friendships', 'a fun night out'],
  relationship: ['Single', 'Married', 'In a relationship', "It's complicated", 'Prefer not to say'],
  lifeStage: ['Not Working', 'Student', 'Building Foundations', 'Settled Professional', 'New to city'],
  personality: ['Outgoing', 'Reserved', 'Bit of both'],
  battery: ['Never runs out', 'Need occasional charging', 'Drains pretty fast'],
  career: ['Rom-com actor', 'Counsellor', 'Stand up comedian', 'Life Coach'],
  socialCircle: ['Small but close', 'Decent but need depth', 'Mostly online', 'Pretty much none'],
  topics: ['Pop Culture', 'Sports', 'Politics'],
  weekend: ['Out somewhere with people', 'Spending time with family', 'By myself recharging', 'Engage myself in a hobby'],
  budget: ['$45-$50', '$50-$55', '$55-$60'],
  gender: ['Female', 'Male', 'Non-binary', 'Other'],
};
const DIETARY = ['Not Applicable', 'Gluten free', 'Dairy free', 'Nut free', 'Vegan', 'Vegetarian'];
const SCALES = ['deepConvo', 'sarcastic', 'financial', 'initiates', 'curious', 'reliability'];

const ORD = n => { const v = n % 100; if (v >= 11 && v <= 13) return `${n}th`; return `${n}${['th', 'st', 'nd', 'rd'][n % 10 > 3 ? 0 : n % 10]}`; };
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// The next two Tuesdays, evaluated on Auckland's calendar (the server may run in any timezone).
function nextTuesdays(count = 2) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Auckland', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const get = t => parseInt(parts.find(p => p.type === t).value, 10);
  const d = new Date(Date.UTC(get('year'), get('month') - 1, get('day')));
  d.setUTCDate(d.getUTCDate() + ((2 - d.getUTCDay() + 7) % 7));
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push(`${ORD(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`);
    d.setUTCDate(d.getUTCDate() + 7);
  }
  return out;
}

const str = (v, max = 300) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function validateAnswers(a) {
  const out = {};
  if (!a || typeof a !== 'object') return { error: 'Missing answers.' };
  out.location = str(a.location, 40);
  if (!OPTIONS.location.includes(out.location)) return { error: 'Please choose your location.' };
  const outside = out.location === 'None of the above';

  // Someone outside Auckland/Wellington only needs to leave contact details for the waitlist.
  const pickFields = outside ? [] : ['lookingFor', 'relationship', 'lifeStage', 'personality', 'battery', 'career', 'socialCircle', 'topics', 'weekend', 'budget'];
  for (const f of pickFields) {
    out[f] = str(a[f], 80);
    if (!OPTIONS[f].includes(out[f])) return { error: `Invalid answer for ${f}.` };
  }
  if (!outside) {
    out.tuesday = str(a.tuesday, 40);
    // Wellington lists its first Tuesday as "<date> - join waitlist".
    if (!nextTuesdays(2).includes(out.tuesday.replace(/ - join waitlist$/, ''))) return { error: 'Please pick one of the listed Tuesdays.' };
    if ((out.budget === '$55-$60') === (out.location === 'Wellington') && out.budget !== '$50-$55') return { error: 'Invalid answer for budget.' };
    for (const f of SCALES) {
      const n = Number(a[f]);
      if (!Number.isInteger(n) || n < 0 || n > 10) return { error: `Invalid answer for ${f}.` };
      out[f] = n;
    }
    out.careerToKid = str(a.careerToKid, 1000);
    if (!out.careerToKid) return { error: 'Please answer the career question.' };
    const diet = Array.isArray(a.dietary) ? a.dietary : [];
    out.dietary = diet.map(d => str(d, 80)).filter(d => DIETARY.includes(d));
    if (diet.includes('Other')) {
      const other = str(a.dietaryOther, 200);
      out.dietary.push(other ? `Other: ${other}` : 'Other');
    }
    if (!out.dietary.length) return { error: 'Please answer the dietary question.' };
  }

  out.firstName = str(a.firstName, 80);
  out.lastName = str(a.lastName, 80);
  out.phone = str(a.phone, 25);
  out.email = str(a.email, 200).toLowerCase();
  if (!out.firstName || !out.lastName) return { error: 'Please enter your name.' };
  if (!/^\+?[\d\s()-]{7,20}$/.test(out.phone)) return { error: 'Please enter a valid phone number.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(out.email)) return { error: 'Please enter a valid email.' };

  if (!outside) {
    out.dob = str(a.dob, 10);
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(out.dob);
    const dobDate = m && new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    if (!dobDate || dobDate.getUTCMonth() !== +m[2] - 1) return { error: 'Please enter a valid date of birth.' };
    const now = new Date();
    const eighteen = new Date(Date.UTC(now.getUTCFullYear() - 18, now.getUTCMonth(), now.getUTCDate()));
    if (dobDate > eighteen) return { error: 'You must be 18 or older to join HeyDer.' };
    if (dobDate < new Date(Date.UTC(now.getUTCFullYear() - 100, 0, 1))) return { error: 'Please enter a valid date of birth.' };
    out.gender = str(a.gender, 30);
    if (!OPTIONS.gender.includes(out.gender)) return { error: 'Please choose your gender.' };
    out.country = str(a.country, 80);
    if (!out.country) return { error: 'Please choose your country.' };
  }
  return { value: out, outside };
}

// ---------- app ----------
const app = express();
app.set('trust proxy', 1);
// Served at both / and /type-form (e.g. behind heyder.nz/type-form): strip the prefix.
app.use((req, res, next) => {
  if (req.url === '/type-form') return res.redirect(301, '/type-form/' + (req.url.split('?')[1] ? '?' + req.url.split('?')[1] : ''));
  if (req.url.startsWith('/type-form/')) req.url = req.url.slice('/type-form'.length);
  next();
});

const hits = new Map();
function rateLimit(max, windowMs) {
  return (req, res, next) => {
    const key = `${req.ip}:${req.path}`;
    const now = Date.now();
    const rec = (hits.get(key) || []).filter(t => now - t < windowMs);
    if (rec.length >= max) return res.status(429).json({ error: 'Too many requests — please wait a moment.' });
    rec.push(now); hits.set(key, rec);
    next();
  };
}
setInterval(() => hits.clear(), 10 * 60 * 1000).unref();

// Stripe's webhook needs the raw body, so it's registered before express.json().
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) return res.status(400).send('Webhook not configured');
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  try {
    if (event.type === 'checkout.session.completed') await markPaid(event.data.object);
  } catch (err) { console.error('webhook handler:', err); }
  res.json({ received: true });
});

app.use(express.json({ limit: '50kb' }));

async function markPaid(session) {
  const id = session.metadata && session.metadata.submissionId;
  const sub = id && store[id];
  if (!sub) return null;
  if (session.payment_status && session.payment_status !== 'paid') return sub;
  if (sub.status === 'Paid' && sub.stripeSession === session.id) return sub; // webhook + verify can both fire
  Object.assign(sub, {
    status: 'Paid',
    plan: session.metadata.plan === 'subscription' ? 'Monthly membership' : 'Booking fee',
    coupon: session.metadata.couponCode || '',
    amountPaid: session.amount_total,
    stripeSession: session.id,
    updatedAt: new Date().toISOString(),
  });
  saveStore();
  await queueSheet(sheetUpdate, sub);
  return sub;
}

app.get('/api/config', (req, res) => {
  res.json({
    stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY || null,
    paymentsLive: !!(stripe && process.env.STRIPE_PUBLISHABLE_KEY),
    pricing: { oneTimeAmount: ONE_TIME_AMOUNT, subscriptionAmount: SUBSCRIPTION_AMOUNT, currency: CURRENCY },
    subscriptionEnabled: SUBSCRIPTION_ENABLED,
    skipDiscountPercent: SKIP_DISCOUNT_PERCENT,
    tuesdays: nextTuesdays(2),
  });
});

app.post('/api/submit', rateLimit(15, 60 * 1000), async (req, res) => {
  const { value, error, outside } = validateAnswers(req.body && req.body.answers);
  if (error) return res.status(400).json({ error });
  const sub = {
    id: crypto.randomUUID(),
    submittedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    a: value,
    status: outside ? 'Waitlist (outside Auckland/Wellington)' : 'Pending payment',
  };
  store[sub.id] = sub;
  saveStore();
  await queueSheet(sheetAppend, sub);
  res.json({ id: sub.id, waitlist: !!outside });
});

app.post('/api/validate-coupon', rateLimit(20, 60 * 1000), (req, res) => {
  const coupon = lookupCoupon(req.body.code);
  if (!coupon) return res.status(404).json({ valid: false, error: 'That code is invalid or has expired.' });
  const plan = req.body.plan === 'subscription' ? 'subscription' : 'one_time';
  if (!couponMatchesPlan(coupon, plan)) {
    return res.status(400).json({ valid: false, error: `That code only works for ${coupon.type === 'subscription' ? 'the monthly membership' : 'one-time reservations'}.` });
  }
  res.json({ valid: true, code: coupon.code, discountPercent: coupon.discountPercent });
});

const discounted = (amount, pct) => (pct ? Math.max(0, Math.round(amount * (1 - pct / 100))) : amount);

app.post('/api/checkout', rateLimit(10, 60 * 1000), async (req, res) => {
  try {
    const sub = store[req.body.id];
    if (!sub || sub.status === 'Waitlist (outside Auckland/Wellington)') return res.status(404).json({ error: 'Submission not found.' });
    if (sub.status === 'Paid') return res.status(409).json({ error: 'This booking is already paid.' });
    const plan = req.body.plan === 'subscription' && SUBSCRIPTION_ENABLED ? 'subscription' : 'one_time';

    // A coupon always wins over the "pay now" incentive — they never stack (same rule as the app).
    let discountPercent = 0;
    let couponCode = '';
    if (req.body.couponCode) {
      const coupon = lookupCoupon(req.body.couponCode);
      if (!coupon) return res.status(400).json({ error: 'That coupon code is invalid or has expired.' });
      if (!couponMatchesPlan(coupon, plan)) return res.status(400).json({ error: 'That code does not apply to this plan.' });
      discountPercent = coupon.discountPercent;
      couponCode = coupon.code;
    } else if (req.body.context === 'skip-offer') {
      discountPercent = SKIP_DISCOUNT_PERCENT;
    }

    const planLabel = plan === 'subscription' ? 'Monthly membership' : 'Booking fee';
    const amount = discountedAmount(plan, discountPercent);

    // A live deployment must never "complete" a booking without charging.
    if ((!stripe || !process.env.STRIPE_PUBLISHABLE_KEY) && process.env.NODE_ENV === 'production') {
      return res.status(503).json({ error: 'Payments are not set up yet. Please try again later.' });
    }
    // No Stripe keys yet: complete the booking in test mode so the whole flow can be tried end to end.
    if (!stripe || !process.env.STRIPE_PUBLISHABLE_KEY) {
      Object.assign(sub, { status: 'Paid (test mode)', plan: planLabel, coupon: couponCode, amountPaid: amount, stripeSession: 'test-mode', updatedAt: new Date().toISOString() });
      saveStore();
      await queueSheet(sheetUpdate, sub);
      return res.json({ testMode: true });
    }

    const metadata = { submissionId: sub.id, plan, ...(couponCode ? { couponCode } : {}) };
    const lineItem = plan === 'subscription'
      ? {
          price_data: {
            currency: CURRENCY,
            recurring: { interval: 'month' },
            product_data: { name: 'HeyDer Monthly Membership', description: 'Unlimited HeyDer Tuesday dinners — renews monthly, cancel anytime.' },
            unit_amount: amount,
          },
          quantity: 1,
        }
      : {
          price_data: {
            currency: CURRENCY,
            product_data: { name: 'HeyDer Booking fee', description: 'By paying you are confirming your reservation' },
            unit_amount: amount,
          },
          quantity: 1,
        };
    const session = await stripe.checkout.sessions.create({
      ui_mode: 'embedded',
      payment_method_types: ['card'],
      mode: plan === 'subscription' ? 'subscription' : 'payment',
      customer_email: sub.a.email,
      line_items: [lineItem],
      metadata,
      ...(plan === 'subscription' ? { subscription_data: { metadata } } : {}),
      return_url: `${BASE_URL}/?session_id={CHECKOUT_SESSION_ID}`,
      redirect_on_completion: 'if_required',
    });
    res.json({ clientSecret: session.client_secret, sessionId: session.id });
  } catch (err) {
    console.error('checkout:', err.message);
    res.status(500).json({ error: 'Payment setup failed. Please try again.' });
  }
});

function discountedAmount(plan, pct) {
  return discounted(plan === 'subscription' ? SUBSCRIPTION_AMOUNT : ONE_TIME_AMOUNT, pct);
}

// Fallback to the webhook: the page calls this once Stripe says the payment completed
// (or after a redirect back), so the sheet is right even if the webhook isn't wired up yet.
app.get('/api/verify/:sessionId', rateLimit(30, 60 * 1000), async (req, res) => {
  try {
    if (!stripe) return res.json({ paid: false });
    const session = await stripe.checkout.sessions.retrieve(req.params.sessionId);
    const paid = session.payment_status === 'paid';
    if (paid) await markPaid(session);
    res.json({ paid });
  } catch (err) {
    res.status(500).json({ error: 'Could not verify payment' });
  }
});

app.post('/api/skip', rateLimit(10, 60 * 1000), async (req, res) => {
  const sub = store[req.body.id];
  if (!sub) return res.status(404).json({ error: 'Submission not found.' });
  if (sub.status === 'Pending payment') {
    sub.status = 'Skipped payment';
    sub.updatedAt = new Date().toISOString();
    saveStore();
    await queueSheet(sheetUpdate, sub);
  }
  res.json({ ok: true });
});

app.use(express.static(path.join(__dirname, 'public')));

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`HeyDer form on ${BASE_URL}`);
    console.log(`  Google Sheets: ${SCRIPT_URL ? 'Apps Script webhook' : getSheets() ? 'connected config found' : 'NOT configured (saving locally only)'}`);
    console.log(`  Stripe: ${stripe && process.env.STRIPE_PUBLISHABLE_KEY ? 'live/test keys set' : 'NOT configured (test-mode checkout)'}`);
    if (getSheets()) ensureSheet().then(() => console.log('  Sheet ready')).catch(e => console.error('  Sheet error:', e.message));
  });
}
module.exports = { app, validateAnswers };
