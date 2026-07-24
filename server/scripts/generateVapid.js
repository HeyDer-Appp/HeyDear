const webpush = require('web-push');
const keys = webpush.generateVAPIDKeys();
console.log('\n✓ Add these to server/.env:\n');
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log('\n✓ Add this to client/.env:\n');
console.log(`VITE_VAPID_PUBLIC_KEY=${keys.publicKey}\n`);
