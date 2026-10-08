const { auth } = require('../firebase');
const banned = require('../utils/banned');

// verifyIdToken throws for two very different reasons: the token itself is
// bad (expired, malformed, wrong project...) or something on OUR side failed
// (certificate fetch, network, misconfigured credentials). Only the first is
// a 401 — the app signs people out on a 401, so answering 401 for a server
// problem would log everyone out during an outage. Anything else is a 503,
// which the app treats as "try again".
const TOKEN_PROBLEM_CODES = new Set([
  'auth/id-token-expired',
  'auth/id-token-revoked',
  'auth/invalid-id-token',
  'auth/argument-error',
  'auth/invalid-argument',
  'auth/user-disabled',
  'auth/user-not-found',
]);

function rejectToken(err, res) {
  if (TOKEN_PROBLEM_CODES.has(err && err.code)) {
    return res.status(401).json({ error: 'Invalid token' });
  }
  console.error('Auth check failed for a server-side reason:', err && (err.code || err.message));
  return res.status(503).json({ error: 'Service temporarily unavailable, please try again.' });
}

const adminAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = await auth.verifyIdToken(token);
    if (decoded.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    req.admin = { id: decoded.uid, email: decoded.email };
    next();
  } catch (err) {
    return rejectToken(err, res);
  }
};

const attendeeAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = await auth.verifyIdToken(token);
    // Banned by the team — answered as an invalid token so the app signs them out.
    if (banned.has(decoded.uid)) return res.status(401).json({ error: 'This account has been suspended.' });
    req.user = { id: decoded.uid, email: decoded.email };
    next();
  } catch (err) {
    return rejectToken(err, res);
  }
};

module.exports = { adminAuth, attendeeAuth };
