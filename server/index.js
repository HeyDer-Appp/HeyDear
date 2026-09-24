require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');

const { apiLimiter } = require('./middleware/rateLimiter');

const pushService = require('./services/push');
const scheduler = require('./services/scheduler');
const pushRoutes = require('./routes/push');
const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const paymentRoutes = require('./routes/payments');
const portalRoutes = require('./routes/portal');
const feedbackRoutes = require('./routes/feedback');
const typeformRoutes = require('./routes/typeform');
const albumRoutes = require('./routes/album');
const groupRoutes = require('./routes/group');
const connectionsRoutes = require('./routes/connections');
const partnersRoutes = require('./routes/partners');
const adminRemindersRoutes = require('./routes/admin/reminders');

const adminSignupsRoutes = require('./routes/admin/signups');
const adminMatchingRoutes = require('./routes/admin/matching');
const adminAnalyticsRoutes = require('./routes/admin/analytics');
const adminDinnersRoutes = require('./routes/admin/dinners');
const adminRestaurantsRoutes = require('./routes/admin/restaurants');
const adminAmbassadorsRoutes = require('./routes/admin/ambassadors');
const adminContentRoutes = require('./routes/admin/content');
const adminCouponsRoutes = require('./routes/admin/coupons');
const adminPricingRoutes = require('./routes/admin/pricing');
const adminSubscriptionsRoutes = require('./routes/admin/subscriptions');

if (process.env.NODE_ENV === 'production') {
  const required = [
    'FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY',
    'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET',
  ];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    console.error(`Missing required environment variable(s) in production: ${missing.join(', ')}`);
    process.exit(1);
  }
}

const app = express();

// Render/Railway sit in front of this app as a reverse proxy — without this,
// express-rate-limit and req.ip both see the proxy's IP for every request.
app.set('trust proxy', 1);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(morgan('combined'));

// ALLOWED_ORIGINS is a comma-separated list so multiple frontends (the main
// site + the separate admin-panel site, which share this same backend) can
// both call the API. Falls back to CLIENT_URL for back-compat with the
// single-origin setup. Browsers never send a trailing slash on the Origin
// header, but it's an easy typo to make when pasting a URL into an env var
// (happened in prod) — strip it so a stray "/" doesn't silently break CORS.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim().replace(/\/$/, ''))
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Server-to-server / curl requests send no Origin header at all — let those through.
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Stripe webhook needs raw body
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api', apiLimiter);

app.get('/api/health', (req, res) => res.json({ status: 'ok', version: '1.0.0' }));

pushService.init();

app.use('/api/auth', authRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/portal', portalRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/typeform', typeformRoutes);
app.use('/api/album', albumRoutes);
app.use('/api/group', groupRoutes);
app.use('/api/connections', connectionsRoutes);
app.use('/api/partners', partnersRoutes);
app.use('/api/admin/reminders', adminRemindersRoutes);

app.use('/api/admin/signups', adminSignupsRoutes);
app.use('/api/admin/matching', adminMatchingRoutes);
app.use('/api/admin/analytics', adminAnalyticsRoutes);
app.use('/api/admin/dinners', adminDinnersRoutes);
app.use('/api/admin/restaurants', adminRestaurantsRoutes);
app.use('/api/admin/ambassadors', adminAmbassadorsRoutes);
app.use('/api/admin/content', adminContentRoutes);
app.use('/api/admin/coupons', adminCouponsRoutes);
app.use('/api/admin/pricing', adminPricingRoutes);
app.use('/api/admin/subscriptions', adminSubscriptionsRoutes);

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong' });
});

const PORT = process.env.PORT || 3001;

function start() {
  const server = app.listen(PORT, () => {
    console.log(`HeyDer server running on port ${PORT}`);
    console.log(`Admin setup: POST http://localhost:${PORT}/api/auth/admin/setup`);
  });

  // Polls every 5 minutes for confirmed tables whose glimpse/venue reveal
  // time has just passed, pushing to that table once each — the same
  // long-running process that serves the API, no separate cron infra.
  scheduler.start();

  const shutdown = (signal) => {
    console.log(`\n${signal} received, shutting down gracefully...`);
    server.close(() => process.exit(0));
    // Force-exit if connections don't drain in time.
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start();

module.exports = app;
