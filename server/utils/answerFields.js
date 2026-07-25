// Every profile-builder field, keyed by its Typeform-derived wire name.
// Shared between profile.js (submit/autosave) and portal.js (full-profile
// prefill) so the two never drift out of sync with each other.
const ANSWER_FIELDS = [
  'field_iunObNMC8bY1', 'field_cqCcs6psQuhE', 'field_CdZldwp5q09o',
  'field_3zmnHXYzZn17', 'field_aIpzE2elktbh', 'field_L6GblNns9C7v',
  'field_LosYJHqrbpKO', 'field_lS4ks7Km1VlA',
  'field_PyYcCusA8b74', 'field_Y8VLrSMSZLmb', 'field_heE41fid4m48',
  'field_H4KwwtKh8sYF', 'field_OqnhJdRIytBz', 'field_1NDB7q3CaeDQ',
  'field_TaGZoiuhOhh2', 'field_TQFTxLhIZnOf', 'field_pCwGXuvIxGTu',
  'field_MQDZqx7wid2f', 'field_Ar4xQbXT6CLh', 'field_OVB7lzEjSl7C',
  'group_role', 'conflict_style', 'connection_trigger',
  'social_recharge', 'conversation_avoid', 'first_meeting_style',
];

module.exports = { ANSWER_FIELDS };
