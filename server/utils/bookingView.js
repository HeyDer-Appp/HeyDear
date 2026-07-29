// Shared shape mapping a `bookings` doc (raw field_XXXXX keys, same wire
// format the old Typeform-backed Postgres schema used) to the human-readable
// aliases the admin UI (matching workspace, signups table, CSV export)
// expects — mirrors the `qr.field_xxx as intent` SQL aliases from before.
function bookingToPerson(id, booking) {
  return {
    id: booking.userId,
    bookingId: id,
    first_name: booking.firstName,
    last_name: booking.lastName,
    email: booking.email,
    phone: booking.phone,
    gender: booking.gender,
    country: booking.country,
    dob: booking.dob,
    intent: booking.field_cqCcs6psQuhE,
    personality: booking.field_L6GblNns9C7v,
    budget: booking.field_Ar4xQbXT6CLh,
    reliability_score: booking.field_1NDB7q3CaeDQ,
    life_stage: booking.field_aIpzE2elktbh,
    dietary: booking.field_OVB7lzEjSl7C || [],
    dietary_other: booking.dietary_other || '',
    career_description: booking.field_MQDZqx7wid2f,
    social_battery: booking.field_LosYJHqrbpKO,
    social_circle: booking.field_TaGZoiuhOhh2,
    relationship_status: booking.field_3zmnHXYzZn17,
    group_role: booking.group_role,
    conflict_style: booking.conflict_style,
    connection_trigger: booking.connection_trigger,
    social_recharge: booking.social_recharge,
    conversation_avoid: booking.conversation_avoid,
    first_meeting_style: booking.first_meeting_style,
    tuesday_date: booking.tuesdayDate,
    preferred_date: booking.field_CdZldwp5q09o,
    submitted_at: booking.submittedAt,
  };
}

module.exports = { bookingToPerson };
