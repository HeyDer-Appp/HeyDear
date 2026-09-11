import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// How long the fade-out plays before we actually change route — has to
// match the CSS transition duration below, or the swap happens mid-fade and
// looks like a cut. The profile builder's own arrival then takes a full
// second to reveal itself on top of that same navy, so together this reads
// as one slow, deliberate motion rather than a snap-cut.
const EXIT_DURATION = 550;

export default function Home() {
  const videoRef = useRef(null);
  const navigate = useNavigate();
  const { attendeeUser } = useAuth();
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    // React sets `muted` as a JS property slightly after the initial paint,
    // which can lose the race against the browser's autoplay policy check
    // (it wants the video muted at the moment play() is attempted) and
    // silently fall back to showing the poster with a play button instead.
    // Forcing muted + play() imperatively avoids that gap.
    video.muted = true;
    const playPromise = video.play();
    if (playPromise) playPromise.catch(() => {});
  }, []);

  const handleEnter = (e) => {
    e.preventDefault();
    setExiting(true);
    setTimeout(() => navigate(attendeeUser ? '/portal/dashboard' : '/profile'), EXIT_DURATION);
  };

  return (
    <div className="h-screen overflow-hidden relative bg-navy cursor-pointer" onClick={handleEnter}>
      {/* Logo only — no login/account link on this screen. Stops the click
          from also bubbling up into the whole-page "click anywhere to
          continue" handler, since this has its own destination (home). */}
      <Link
        to="/"
        onClick={e => e.stopPropagation()}
        className={`fixed top-0 left-0 z-50 px-6 py-5 transition-opacity duration-200 ${exiting ? 'opacity-0' : 'opacity-100'}`}
      >
        <img
          src="https://heyder.nz/wp-content/uploads/2026/04/logo1.png"
          alt="HeyDer"
          className="h-8 w-auto"
        />
      </Link>

      {/* Full-screen hero */}
      <div className="absolute inset-0">
        <video
          ref={videoRef}
          src="https://heyder.nz/wp-content/uploads/2026/07/Untitled-design.mp4"
          poster="https://heyder.nz/wp-content/uploads/2026/04/medium-shot-friends-eating-pizza.jpg-scaled.jpeg"
          autoPlay
          muted
          loop
          playsInline
          className="w-full h-full object-cover object-center"
        />
        {/* Dark gradient overlays */}
        <div className="absolute inset-0 bg-navy/60" />
        <div className="absolute inset-0 bg-gradient-to-t from-navy via-navy/20 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-navy/50 via-transparent to-transparent" />
        {/* Fades the whole hero to navy on exit, so the route swap lands on
            a solid color instead of cutting mid-video. */}
        <div
          className={`absolute inset-0 bg-navy transition-opacity ease-in duration-[550ms] ${exiting ? 'opacity-100' : 'opacity-0'}`}
        />
      </div>

      {/* No button — the entire screen is clickable (see the outer div's
          onClick above); this is just a text hint, left-aligned in the same
          spot the button used to sit. */}
      <div className="relative z-10 h-full flex flex-col items-start justify-end px-6 md:px-12 pb-28 md:pb-32">
        <p
          className={`font-poppins font-light text-sm tracking-wide transition-opacity duration-200 ${exiting ? 'opacity-0' : 'home-enter-hint'}`}
          style={{ color: '#F7F2E0' }}
        >
          Click anywhere to continue
        </p>
      </div>
    </div>
  );
}
