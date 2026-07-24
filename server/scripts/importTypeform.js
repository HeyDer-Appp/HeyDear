require('dotenv').config();
const { importTypeformResponses } = require('../services/typeform');

async function main() {
  console.log('Starting Typeform import...');
  try {
    const count = await importTypeformResponses();
    console.log(`Done. Imported ${count} responses.`);
    process.exit(0);
  } catch (err) {
    console.error('Import failed:', err);
    process.exit(1);
  }
}

main();
