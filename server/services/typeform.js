const axios = require('axios');
const { admin, db, auth } = require('../firebase');

const TYPEFORM_FORM_ID = process.env.TYPEFORM_FORM_ID || 'OAxjrKyW';
const TYPEFORM_BASE_URL = 'https://api.typeform.com';

const typeformClient = () =>
  axios.create({
    baseURL: TYPEFORM_BASE_URL,
    headers: { Authorization: `Bearer ${process.env.TYPEFORM_API_KEY}` },
  });

const QUIZ_QUESTIONS = [
  {
    id: 'iunObNMC8bY1',
    type: 'yes_no',
    title: 'Are you in Auckland?',
    description: 'We are currently curating dinners only in Auckland.',
    required: true,
    disqualifyIfNo: true,
  },
  {
    id: 'cqCcs6psQuhE',
    type: 'multiple_choice',
    title: "I'm looking for",
    required: true,
    choices: ['Meaningful friendships', 'A fun night out'],
  },
  {
    id: 'CdZldwp5q09o',
    type: 'multiple_choice',
    title: 'Which Tuesday night works for you?',
    required: true,
    choices: ['30th June 2026', '7th July 2026'],
    dynamic: true,
  },
  {
    id: '3zmnHXYzZn17',
    type: 'multiple_choice',
    title: 'Relationship status',
    required: true,
    choices: ['Single', 'Married', 'In a relationship', "It's complicated", 'Prefer not to say'],
  },
  {
    id: 'aIpzE2elktbh',
    type: 'multiple_choice',
    title: 'Life stage',
    required: true,
    choices: ['Not Working', 'Student', 'Building Foundations', 'Settled Professional', 'New to city'],
  },
  {
    id: 'L6GblNns9C7v',
    type: 'multiple_choice',
    title: 'Would you consider yourself as',
    required: true,
    choices: ['Outgoing', 'Reserved', 'Bit of both'],
  },
  {
    id: 'LosYJHqrbpKO',
    type: 'multiple_choice',
    title: 'Social battery',
    required: true,
    choices: ['Never runs out', 'Need occasional charging', 'Drains pretty fast'],
  },
  {
    id: 'lS4ks7Km1VlA',
    type: 'multiple_choice',
    title: 'If paid equally which career would you choose',
    required: true,
    choices: ['Rom-com actor', 'Counsellor', 'Stand up comedian', 'Life Coach'],
  },
  {
    id: 'PyYcCusA8b74',
    type: 'opinion_scale',
    title: 'I enjoy having deep conversations in a group',
    min: 0,
    max: 10,
    required: true,
  },
  {
    id: 'Y8VLrSMSZLmb',
    type: 'opinion_scale',
    title: 'I am sarcastic in nature',
    min: 0,
    max: 10,
    required: true,
  },
  {
    id: 'heE41fid4m48',
    type: 'opinion_scale',
    title: 'Financial security comes first',
    min: 0,
    max: 10,
    required: true,
  },
  {
    id: 'H4KwwtKh8sYF',
    type: 'opinion_scale',
    title: 'I usually initiate plans',
    min: 0,
    max: 10,
    required: true,
  },
  {
    id: 'OqnhJdRIytBz',
    type: 'opinion_scale',
    title: 'You straight up ask questions when curious',
    min: 0,
    max: 10,
    required: true,
  },
  {
    id: '1NDB7q3CaeDQ',
    type: 'opinion_scale',
    title: 'How important is reliability to you? (0 = low, 10 = high)',
    min: 0,
    max: 10,
    required: true,
  },
  {
    id: 'TaGZoiuhOhh2',
    type: 'multiple_choice',
    title: 'My social circle is',
    required: true,
    choices: ['Small but close', 'Decent but need depth', 'Mostly online', 'Pretty much none'],
  },
  {
    id: 'TQFTxLhIZnOf',
    type: 'multiple_choice',
    title: 'Favourite conversation topics',
    required: true,
    choices: ['Pop Culture', 'Sports', 'Politics'],
  },
  {
    id: 'pCwGXuvIxGTu',
    type: 'multiple_choice',
    title: 'Most weekends you are',
    required: true,
    choices: ['Out with people', 'Family time', 'Solo recharging', 'Hobby engagement'],
  },
  {
    id: 'MQDZqx7wid2f',
    type: 'long_text',
    title: 'How would you describe your career/job to a kid?',
    required: true,
    placeholder: 'Be creative...',
  },
  {
    id: 'Ar4xQbXT6CLh',
    type: 'multiple_choice',
    title: 'Budget for set menu?',
    description: 'Restaurants rated 4.3+ with allergen accommodations',
    required: true,
    choices: ['$45-$50', '$50-$55'],
  },
  {
    id: 'OVB7lzEjSl7C',
    type: 'multiple_choice',
    title: 'Dietary preferences',
    required: false,
    multiple: true,
    choices: ['Not Applicable', 'Gluten free', 'Dairy free', 'Nut free', 'Vegan', 'Vegetarian'],
  },
  {
    id: 'contact',
    type: 'contact',
    title: 'Your contact details',
    required: true,
    fields: ['first_name', 'last_name', 'phone', 'email'],
  },
  {
    id: 'personal',
    type: 'personal',
    title: 'A little more about you',
    required: true,
    fields: ['dob', 'gender', 'country'],
  },
];

async function fetchFormQuestions() {
  if (!process.env.TYPEFORM_API_KEY) return QUIZ_QUESTIONS;
  try {
    const client = typeformClient();
    const response = await client.get(`/forms/${TYPEFORM_FORM_ID}`);
    return response.data.fields || QUIZ_QUESTIONS;
  } catch {
    return QUIZ_QUESTIONS;
  }
}

async function importTypeformResponses() {
  if (!process.env.TYPEFORM_API_KEY) {
    console.log('No Typeform API key. Skipping import.');
    return 0;
  }

  const client = typeformClient();
  let pageToken = null;
  let imported = 0;

  do {
    const params = { page_size: 200 };
    if (pageToken) params.before = pageToken;

    const response = await client.get(`/forms/${TYPEFORM_FORM_ID}/responses`, { params });
    const { items, page_count } = response.data;

    for (const item of items) {
      try {
        const didImport = await processTypeformResponse(item);
        if (didImport) imported++;
      } catch (err) {
        console.error(`Failed to import response ${item.response_id}:`, err.message);
      }
    }

    const last = items[items.length - 1];
    pageToken = last ? last.token : null;

    if (!page_count || page_count <= 1) break;
  } while (pageToken);

  console.log(`Imported ${imported} responses from Typeform.`);
  return imported;
}

// Historical pre-launch signups collected via Typeform, before the app (and
// Firebase Auth) existed. Each response becomes a real Firebase Auth user
// (no password set — they'd use "forgot password" to claim the account) plus
// a users/ + bookings/ doc, same shape a live signup produces.
async function processTypeformResponse(item) {
  const fieldMap = {};
  for (const answer of (item.answers || [])) {
    const fid = answer.field?.id;
    if (!fid) continue;
    switch (answer.type) {
      case 'boolean': fieldMap[fid] = answer.boolean; break;
      case 'choice': fieldMap[fid] = answer.choice?.label; break;
      case 'choices': fieldMap[fid] = answer.choices?.labels; break;
      case 'number': fieldMap[fid] = answer.number; break;
      case 'text': fieldMap[fid] = answer.text; break;
      case 'date': fieldMap[fid] = answer.date; break;
      default: fieldMap[fid] = answer[answer.type]; break;
    }
  }

  const firstName = fieldMap['XvAFQSFcsFTu_first_name'] || fieldMap['XvAFQSFcsFTu']?.first_name || '';
  const lastName = fieldMap['XvAFQSFcsFTu_last_name'] || fieldMap['XvAFQSFcsFTu']?.last_name || '';
  const email = fieldMap['XvAFQSFcsFTu_email'] || fieldMap['XvAFQSFcsFTu']?.email || '';
  const phone = fieldMap['XvAFQSFcsFTu_phone_number'] || '';

  if (!email) return false;

  const existingResponse = await db.collection('bookings')
    .where('typeformResponseId', '==', item.response_id)
    .limit(1)
    .get();
  if (!existingResponse.empty) return false;

  let uid;
  try {
    const userRecord = await auth.createUser({ email, displayName: `${firstName} ${lastName}`.trim() || undefined });
    uid = userRecord.uid;
  } catch (err) {
    if (err.code !== 'auth/email-already-exists') throw err;
    uid = (await auth.getUserByEmail(email)).uid;
  }

  const dietary = fieldMap['OVB7lzEjSl7C'];
  const dietaryArray = Array.isArray(dietary) ? dietary : dietary ? [dietary] : [];
  const dateStr = fieldMap['CdZldwp5q09o'];
  const tuesdayDate = dateStr ? parseTuesdayDate(dateStr) : null;

  const answers = {
    field_iunObNMC8bY1: fieldMap['iunObNMC8bY1'] ?? null,
    field_cqCcs6psQuhE: fieldMap['cqCcs6psQuhE'] || null,
    field_CdZldwp5q09o: fieldMap['CdZldwp5q09o'] || null,
    field_3zmnHXYzZn17: fieldMap['3zmnHXYzZn17'] || null,
    field_aIpzE2elktbh: fieldMap['aIpzE2elktbh'] || null,
    field_L6GblNns9C7v: fieldMap['L6GblNns9C7v'] || null,
    field_LosYJHqrbpKO: fieldMap['LosYJHqrbpKO'] || null,
    field_lS4ks7Km1VlA: fieldMap['lS4ks7Km1VlA'] || null,
    field_PyYcCusA8b74: fieldMap['PyYcCusA8b74'] ?? null,
    field_Y8VLrSMSZLmb: fieldMap['Y8VLrSMSZLmb'] ?? null,
    field_heE41fid4m48: fieldMap['heE41fid4m48'] ?? null,
    field_H4KwwtKh8sYF: fieldMap['H4KwwtKh8sYF'] ?? null,
    field_OqnhJdRIytBz: fieldMap['OqnhJdRIytBz'] ?? null,
    field_1NDB7q3CaeDQ: fieldMap['1NDB7q3CaeDQ'] ?? null,
    field_TaGZoiuhOhh2: fieldMap['TaGZoiuhOhh2'] || null,
    field_TQFTxLhIZnOf: fieldMap['TQFTxLhIZnOf'] || null,
    field_pCwGXuvIxGTu: fieldMap['pCwGXuvIxGTu'] || null,
    field_MQDZqx7wid2f: fieldMap['MQDZqx7wid2f'] || null,
    field_Ar4xQbXT6CLh: fieldMap['Ar4xQbXT6CLh'] || null,
    field_OVB7lzEjSl7C: dietaryArray,
  };

  const userRef = db.collection('users').doc(uid);
  await userRef.set({
    firstName, lastName, email, phone,
    gender: fieldMap['7s7uZcoVh3kP']?.gender || null,
    country: fieldMap['7s7uZcoVh3kP']?.country || null,
    dob: fieldMap['7s7uZcoVh3kP']?.date_of_birth || null,
    city: 'Auckland',
    referralCode: null,
    profileComplete: true,
    ...answers,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  await db.collection('bookings').add({
    userId: uid,
    typeformResponseId: item.response_id,
    tuesdayDate,
    firstName, lastName, email, phone,
    gender: fieldMap['7s7uZcoVh3kP']?.gender || null,
    country: fieldMap['7s7uZcoVh3kP']?.country || null,
    dob: fieldMap['7s7uZcoVh3kP']?.date_of_birth || null,
    ...answers,
    matched: false,
    tableId: null,
    dinnerId: null,
    submittedAt: item.submitted_at ? admin.firestore.Timestamp.fromDate(new Date(item.submitted_at)) : admin.firestore.FieldValue.serverTimestamp(),
  });

  return true;
}

function parseTuesdayDate(str) {
  const months = {
    January: 1, February: 2, March: 3, April: 4, May: 5, June: 6,
    July: 7, August: 8, September: 9, October: 10, November: 11, December: 12,
  };
  const match = str.match(/(\d+)(?:st|nd|rd|th)?\s+(\w+)\s+(\d{4})/);
  if (!match) return null;
  const [, day, monthName, year] = match;
  const month = months[monthName];
  if (!month) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

module.exports = { QUIZ_QUESTIONS, fetchFormQuestions, importTypeformResponses, processTypeformResponse };
