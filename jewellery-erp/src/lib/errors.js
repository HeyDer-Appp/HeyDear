export class AppError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AppError';
    this.code = code;
  }
}

export function errMsg(e) {
  if (!e) return 'Something went wrong.';
  if (e instanceof AppError) return e.message;
  const code = e.code || '';
  if (code === 'permission-denied' || code === 'firestore/permission-denied') return 'You do not have permission to perform this action.';
  if (code === 'unavailable') return 'Network problem. Check your connection and try again.';
  if (code === 'failed-precondition' && /index/i.test(e.message || '')) return 'A Firestore index is missing. Deploy firestore.indexes.json (see README).';
  if (code.startsWith('auth/')) {
    if (['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found', 'auth/invalid-email'].includes(code)) return 'Wrong email or password.';
    if (code === 'auth/email-already-in-use') return 'That email is already registered.';
    if (code === 'auth/weak-password') return 'Password must be at least 6 characters.';
    if (code === 'auth/too-many-requests') return 'Too many attempts. Try again in a few minutes.';
  }
  return e.message || 'Something went wrong.';
}
