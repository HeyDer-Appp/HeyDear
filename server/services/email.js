const nodemailer = require('nodemailer');

let transporter;

function getTransporter() {
  if (transporter) return transporter;

  if (process.env.EMAIL_PROVIDER === 'resend') {
    const { Resend } = require('resend');
    return new Resend(process.env.RESEND_API_KEY);
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter;
}

function baseTemplate(title, content) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>${title}</title>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Jost:wght@300;400;500;600&display=swap" rel="stylesheet"/>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #ffffff; font-family: 'Jost', Arial, sans-serif; }
  .outer { background: #ffffff; padding: 32px 16px; }
  .container { max-width: 600px; margin: 0 auto; background: #434c59; border-radius: 12px; overflow: hidden; }
  .header { background: #0a0f1a; padding: 28px 32px; text-align: center; border-bottom: 1px solid rgba(245,237,216,0.08); }
  .header img { width: 160px; height: auto; }
  .body { padding: 36px 32px; background: #353d4a; }
  .body h1 { font-family: 'Cormorant Garamond', Georgia, serif; color: #F5EDD8; font-size: 28px; font-weight: 600; margin-bottom: 16px; line-height: 1.2; }
  .body h2 { font-family: 'Cormorant Garamond', Georgia, serif; color: #F5EDD8; font-size: 22px; font-weight: 500; margin-bottom: 12px; }
  .body p { color: #F5EDD8; font-size: 15px; line-height: 1.7; margin-bottom: 16px; }
  .body .muted { color: rgba(245,237,216,0.6); font-size: 13px; }
  .accent { color: #f0c040; font-weight: 700; }
  .gold { color: #C4956A; }
  .divider { border: none; border-top: 1px solid rgba(245,237,216,0.12); margin: 24px 0; }
  .card { background: #131c2e; border-radius: 8px; padding: 20px 24px; margin: 20px 0; border: 1px solid rgba(245,237,216,0.08); }
  .card p { margin-bottom: 8px; }
  .btn { display: inline-block; background: #C4956A; color: #0a0f1a; font-family: 'Jost', Arial, sans-serif; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; padding: 14px 32px; border-radius: 4px; text-decoration: none; margin: 8px 0; }
  .emoji-row { font-size: 24px; margin: 8px 0; }
  .person-fact { background: #0a0f1a; border-radius: 6px; padding: 12px 16px; margin: 8px 0; border-left: 3px solid #C4956A; }
  .footer { background: #0a0f1a; padding: 24px 32px; text-align: center; }
  .footer p { color: rgba(245,237,216,0.5); font-size: 12px; line-height: 1.6; }
  .footer a { color: #C4956A; text-decoration: none; }
  .footer .tagline { color: rgba(245,237,216,0.4); font-style: italic; font-size: 13px; margin-bottom: 8px; }
  @media (max-width: 600px) { .body { padding: 24px 20px; } .header { padding: 20px; } .footer { padding: 20px; } }
</style>
</head>
<body>
<div class="outer">
<div class="container">
  <div class="header">
    <img src="https://heyder.nz/wp-content/uploads/2026/04/logo1.png" alt="HeyDer" />
  </div>
  <div class="body">
    ${content}
  </div>
  <div class="footer">
    <p class="tagline">Meet people, not profiles.</p>
    <p>
      <a href="https://heyder.nz">heyder.nz</a> &nbsp;•&nbsp;
      <a href="mailto:hello@heyder.nz">hello@heyder.nz</a>
    </p>
    <p style="margin-top:8px;">Auckland, New Zealand &nbsp;•&nbsp; © 2026 HeyDer</p>
  </div>
</div>
</div>
</body>
</html>`;
}

const templates = {
  confirmation: (data) => ({
    subject: 'You\'re in — HeyDer is finding your group 🎉',
    html: baseTemplate('Booking Confirmed', `
      <h1>Welcome to HeyDer, ${data.firstName}.</h1>
      <p>Your $5 booking is confirmed. We're now working on finding you the right group for your Tuesday dinner.</p>
      <div class="card">
        <p><span class="accent">— — —</span></p>
        <p>You asked for: <strong>${data.intent}</strong></p>
        <p>Preferred date: <strong>${data.tuesdayDate}</strong></p>
        <p>Budget: <strong>${data.budget}</strong></p>
        ${data.dietary ? `<p>Dietary: <strong>${data.dietary}</strong></p>` : ''}
      </div>
      <p>You'll hear from us once we've found your group. That email comes with a little anticipation — sit tight.</p>
      <p>In the meantime, the best thing you can do is show up with curiosity.</p>
      <hr class="divider"/>
      <p class="muted">Questions? Reply to this email or reach us at info@heyder.nz. Cancellations must be made 48 hours before your dinner for a refund.</p>
    `),
  }),

  groupFound: (data) => ({
    subject: 'Your group is ready — dinner is 48 hours away 🍽️',
    html: baseTemplate('Your Group Is Ready', `
      <h1>Your people have been found.</h1>
      <p>The matching is done. Your table is set for <strong class="gold">Tuesday ${data.date} at 7pm</strong>.</p>
      <div class="card">
        <p><span class="accent">— — —</span></p>
        <p>48 hours from now, you'll be sitting across from people who wanted to meet someone like you.</p>
        <p>We won't tell you who they are yet. But we'll give you a glimpse in 24 hours — just enough to make the anticipation worth it.</p>
      </div>
      <p>The restaurant and all details will be revealed <strong>24 hours before your dinner</strong>.</p>
      <p>One thing to do right now: <strong>block your Tuesday evening</strong>. The conversation tends to run long.</p>
      <hr class="divider"/>
      <p class="muted">Your booking is confirmed for ${data.date}. To cancel, please contact us at least 48 hours before the event.</p>
    `),
  }),

  groupGlimpse: (data) => ({
    subject: 'A glimpse of your table — dinner is in 48 hours 👀',
    html: baseTemplate('Your Table Glimpse', `
      <h1>Your table, revealed.</h1>
      <p>No names yet. But here's who you're about to meet — <strong class="gold">${data.dinnerDate}</strong> at 7pm.</p>
      <hr class="divider"/>
      ${data.members.map((m, i) => `
        <div class="person-fact">
          <div class="emoji-row">${m.flagEmoji} ${m.genderEmoji}</div>
          <p>${m.uniqueFact || 'A story waiting to be shared.'}</p>
        </div>
      `).join('')}
      <hr class="divider"/>
      <p>Including you, that's <strong>${data.memberCount} people</strong> who chose to show up. Every single one of them did what most people talk about — they actually showed up.</p>
      <p>Full details including venue drop <strong>24 hours before dinner</strong>.</p>
      <div class="card">
        <p><span class="accent">— — —</span></p>
        <p class="muted">No phones at the table for the first 30 minutes. That's not a rule. That's a request from everyone who's done this before.</p>
      </div>
    `),
  }),

  venueReveal: (data) => ({
    subject: `Tonight's dinner — here's where to go 📍`,
    html: baseTemplate('Venue Revealed', `
      <h1>Tonight. ${data.time}. Here's where.</h1>
      <div class="card">
        <p><span class="accent">— — —</span></p>
        <h2>${data.restaurantName}</h2>
        <p>${data.restaurantAddress}</p>
        <p>Booking name: <strong>${data.bookingName}</strong></p>
        <p>Time: <strong>${data.time}</strong></p>
        ${data.dietaryNote ? `<p>Dietary note on file: <strong>${data.dietaryNote}</strong></p>` : ''}
      </div>
      <p>The set menu is <strong>${data.menuPrice}</strong> per person, paid at the venue.</p>
      <hr class="divider"/>
      <h2>Two Truths and a Lie</h2>
      <p>One of tonight's rituals. Your table will each share two true things and one lie. Guess who's bluffing — there's a reward waiting.</p>
      ${data.twoTruthsLie ? `
      <div class="card">
        <p>${data.twoTruthsLie}</p>
      </div>
      ` : ''}
      <hr class="divider"/>
      <p>You chose to show up. That's already the hardest part. Tonight, just be curious.</p>
      <p class="muted">Questions? Reply to this email. See you at ${data.restaurantName}.</p>
    `),
  }),

  reminder: (data) => ({
    subject: 'Tonight\'s the night — dinner in a few hours 🌙',
    html: baseTemplate('Dinner Tonight', `
      <h1>Tonight's the night, ${data.firstName}.</h1>
      <p>Your HeyDer dinner is <strong class="gold">tonight at ${data.time}</strong>.</p>
      <div class="card">
        <p><span class="accent">— — —</span></p>
        <h2>${data.restaurantName}</h2>
        <p>${data.restaurantAddress}</p>
        <p>Booking name: <strong>${data.bookingName}</strong></p>
      </div>
      <p>The people at your table are expecting you. So is the conversation. So is the ritual.</p>
      <p>See you there.</p>
    `),
  }),

  postDinnerFeedback: (data) => ({
    subject: 'How was last night? We want to know 💬',
    html: baseTemplate('Post-Dinner Feedback', `
      <h1>How was it, ${data.firstName}?</h1>
      <p>Last night's dinner at ${data.restaurantName} — we'd love to hear about it.</p>
      <p>It takes 2 minutes. Your feedback directly shapes who we match and how we run the experience.</p>
      <div style="text-align:center; margin: 32px 0;">
        <a href="${data.feedbackUrl}" class="btn">Share Your Feedback</a>
      </div>
      <hr class="divider"/>
      <p class="muted">If you'd like to book again, your next Tuesday dinner is just a quiz away at heyder.nz</p>
    `),
  }),
};

async function sendEmail({ to, subject, html }) {
  const provider = process.env.EMAIL_PROVIDER;
  const from = process.env.EMAIL_FROM || 'HeyDer <info@heyder.nz>';

  if (provider === 'resend') {
    const { Resend } = require('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);
    return resend.emails.send({ from, to, subject, html });
  }

  const t = getTransporter();
  return t.sendMail({ from, to, subject, html });
}

async function sendConfirmationEmail(user, quizData) {
  const tmpl = templates.confirmation({
    firstName: user.first_name,
    intent: quizData.field_cqCcs6psQuhE,
    tuesdayDate: quizData.field_CdZldwp5q09o,
    budget: quizData.field_Ar4xQbXT6CLh,
    dietary: (quizData.field_OVB7lzEjSl7C || []).join(', '),
  });
  return sendEmail({ to: user.email, ...tmpl });
}

async function sendGroupFoundEmail(user, dinner) {
  const tmpl = templates.groupFound({
    firstName: user.first_name,
    date: new Date(dinner.date).toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'long' }),
  });
  return sendEmail({ to: user.email, ...tmpl });
}

async function sendGroupGlimpseEmail(user, members, dinnerDate) {
  const tmpl = templates.groupGlimpse({
    firstName: user.first_name,
    dinnerDate: new Date(dinnerDate).toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'long' }),
    members,
    memberCount: members.length,
  });
  return sendEmail({ to: user.email, ...tmpl });
}

async function sendVenueRevealEmail(user, venue, tableData) {
  const tmpl = templates.venueReveal({
    firstName: user.first_name,
    restaurantName: venue.name,
    restaurantAddress: venue.address,
    bookingName: venue.booking_name,
    time: venue.booking_time || '7:00 PM',
    menuPrice: `$${venue.menu_price_min}–$${venue.menu_price_max}`,
    dietaryNote: tableData.dietary,
    twoTruthsLie: null,
  });
  return sendEmail({ to: user.email, ...tmpl });
}

async function sendReminderEmail(user, venue) {
  const tmpl = templates.reminder({
    firstName: user.first_name,
    restaurantName: venue.name,
    restaurantAddress: venue.address,
    bookingName: venue.booking_name,
    time: venue.booking_time || '7:00 PM',
  });
  return sendEmail({ to: user.email, ...tmpl });
}

async function sendFeedbackEmail(user, dinner, restaurantName) {
  const feedbackUrl = `${process.env.CLIENT_URL}/feedback/${dinner.id}?uid=${user.id}`;
  const tmpl = templates.postDinnerFeedback({
    firstName: user.first_name,
    restaurantName,
    feedbackUrl,
  });
  return sendEmail({ to: user.email, ...tmpl });
}

module.exports = {
  sendEmail,
  sendConfirmationEmail,
  sendGroupFoundEmail,
  sendGroupGlimpseEmail,
  sendVenueRevealEmail,
  sendReminderEmail,
  sendFeedbackEmail,
  templates,
  baseTemplate,
};
