// Fixed icebreaker prompts for the pre-dinner group chat. Each has a short
// multiple-choice answer set — no free text is allowed at this stage, so
// the option a member picks must always be validated against this list
// server-side (see server/routes/group.js).
const PROMPTS = [
  { id: 'day', text: 'How’s your day going?', options: ['Good', 'Been lazy all day', 'Busy with chores', 'Counting down to Tuesday'] },
  { id: 'excited', text: 'Excited for Tuesday?', options: ['Beyond excited', 'Nervous but excited', 'Just here for the food', 'Ask me after a wine'] },
  { id: 'pets', text: 'Got any pets?', options: ['A dog', 'A cat', 'Something weirder', 'Nah, but I want one'] },
  { id: 'movies', text: 'What type of movies are you into?', options: ['Horror', 'Comedy', 'Rom-com', 'Documentaries'] },
  { id: 'coffee_tea', text: 'Coffee or tea person?', options: ['Coffee, always', 'Tea, thanks', 'Neither, I’m feral', 'Depends on the day'] },
  { id: 'weekend', text: 'Go-to weekend activity?', options: ['Brunch with friends', 'Gym or a hike', 'Couch and a show', 'Exploring somewhere new'] },
  { id: 'music', text: 'What are you currently obsessed with, music-wise?', options: ['Pop', 'Hip-hop', 'Indie/alt', 'Whatever’s on the radio'] },
  { id: 'sleep', text: 'Early bird or night owl?', options: ['Up with the sun', 'Thriving after midnight', 'Somewhere in between', 'Depends on the coffee'] },
  { id: 'spice', text: 'Spice tolerance?', options: ['Bring the fire', 'Mild for me', 'Somewhere in the middle', 'I cry at pepper'] },
  { id: 'tuesday_alt', text: 'Ideal Tuesday night, besides this one?', options: ['Home, pyjamas, Netflix', 'Out with mates', 'Trying a new restaurant', 'Early night, big day tomorrow'] },
  { id: 'travel', text: 'Dream travel destination?', options: ['Tropical beach', 'European city', 'Off the grid somewhere', 'Wherever the flight’s cheapest'] },
  { id: 'bar_order', text: 'What’s your order at a bar?', options: ['Wine', 'Beer', 'Cocktail', 'Something non-alcoholic'] },
  { id: 'food_weakness', text: 'Biggest food weakness?', options: ['Pizza', 'Dessert', 'Anything cheesy', 'I don’t discriminate'] },
  { id: 'eggs', text: 'How do you take your eggs?', options: ['Scrambled', 'Fried', 'Poached', 'I don’t do eggs'] },
  { id: 'star_sign', text: 'Star sign energy, or nah?', options: ['Full believer', 'Just for fun', 'Total skeptic', 'What’s a star sign'] },
  { id: 'binge', text: 'Last show you binged?', options: ['Something trashy', 'A true crime doco', 'A comedy', 'Still working through my list'] },
];

function getPrompt(id) {
  return PROMPTS.find(p => p.id === id) || null;
}

module.exports = { PROMPTS, getPrompt };
