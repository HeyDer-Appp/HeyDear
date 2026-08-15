require('dotenv').config();
const { admin, db, auth } = require('../firebase');

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];
  const name = process.argv[4] || 'Admin';

  if (!email || !password) {
    console.error('Usage: node scripts/createAdmin.js <email> <password> [name]');
    process.exit(1);
  }

  let userRecord;
  try {
    userRecord = await auth.createUser({ email, password, displayName: name });
  } catch (err) {
    if (err.code === 'auth/email-already-exists') {
      const existing = await auth.getUserByEmail(email);
      userRecord = await auth.updateUser(existing.uid, { password, displayName: name });
      console.log('User already existed, reset password on:', userRecord.uid);
    } else {
      throw err;
    }
  }

  await auth.setCustomUserClaims(userRecord.uid, { role: 'admin' });
  await db.collection('admins').doc(userRecord.uid).set({
    name,
    email,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  console.log('Admin ready:', email, userRecord.uid);
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
