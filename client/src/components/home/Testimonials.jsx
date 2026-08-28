import React from 'react';

const testimonials = [
  {
    text: "OMG! how did I end up talking for 3 hours to people I haven't met before. This wasn't what I was expecting when I signed up for this event. The set menu for our table was yummy and the company was perfect for some deep conversations and banter. Still thinking about it as I type. Can't wait to do this again.",
    author: 'HeyDer Attendee',
    stars: 5,
  },
  {
    text: "The staff asked us to leave as the restaurant was closing. That says a lot about how this experience felt. Everyone was being real and the conversations went deep. The food and drinks at the venue were well organised. 2nd June dinner booked already. Much needed refresher.",
    author: 'HeyDer Attendee',
    stars: 5,
  },
  {
    text: "What an amazing concept of meeting new people over amazing cuisine. I am sold and would highly recommend people give this a try. It's that social experiment that I am supportive of and in a world where we are connected online yet lonelier than ever, HeyDer might be the most human thing you do all year.",
    author: 'HeyDer Attendee',
    stars: 5,
  },
];

function Stars({ count }) {
  return (
    <div className="flex gap-1 mb-4">
      {[...Array(count)].map((_, i) => (
        <svg key={i} width="16" height="16" viewBox="0 0 24 24" fill="#f0c040">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </div>
  );
}

export default function Testimonials() {
  return (
    <section className="py-20 px-6 bg-deep-card/30">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <span className="font-sans text-gold text-xs tracking-widest uppercase font-semibold mb-4 block">What They Said</span>
          <h2 className="section-title">
            Don't take our word<br />
            <em className="text-gold not-italic">for it.</em>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <div
              key={i}
              className="bg-dark-card rounded-2xl p-8 border border-white/5 flex flex-col transition-all duration-300 hover:scale-[1.02] hover:border-gold/20 hover:shadow-lg hover:shadow-black/30"
            >
              <Stars count={t.stars} />
              <p className="font-sans text-cream/75 text-sm leading-relaxed flex-1 italic">
                "{t.text}"
              </p>
              <div className="mt-6 pt-6 border-t border-white/5">
                <p className="font-sans text-gold text-xs font-semibold tracking-wider uppercase">{t.author}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Social proof image */}
        <div className="mt-16 flex flex-col items-center gap-6">
          <img
            src="https://heyder.nz/wp-content/uploads/2026/04/imgi_12_toppng.com-instagram-sticker-heart-737x545-1.png"
            alt="Instagram"
            className="w-24 opacity-80"
          />
          <p className="font-sans text-cream/50 text-sm">
            Follow our journey{' '}
            <a
              href="https://www.instagram.com/heyder.nz"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold hover:text-yellow transition-colors"
            >
              @heyder.nz
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
