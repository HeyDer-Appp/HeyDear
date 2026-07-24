import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/layout/Navbar';
import { useAuth } from '../context/AuthContext';

export default function Home() {
  const videoRef = useRef(null);
  const { attendeeUser } = useAuth();

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

  return (
    <div className="h-screen overflow-hidden relative bg-navy">
      <Navbar />

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
      </div>

      {/* Content — positioned in the lower third */}
      <div className="relative z-10 h-full flex flex-col justify-end px-6 md:px-12 pb-14 md:pb-16">
        <div className="max-w-xl">
          <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl text-cream leading-[1.1] mb-6">
            Weekly dinners with people looking for someone like{' '}
            <em className="text-gold not-italic">YOU.</em>
          </h1>

          <div className="flex flex-col sm:flex-row items-start gap-2">
            <Link
              to="/profile"
              className="btn-primary text-xs tracking-widest"
            >
              BUILD MY PROFILE
            </Link>
            <Link
              to={attendeeUser ? '/portal/dashboard' : '/portal/login'}
              className="font-sans text-xs text-cream/50 hover:text-cream transition-colors px-2 py-3 tracking-wide"
            >
              {attendeeUser ? 'View my bookings →' : 'Already signed up? →'}
            </Link>
          </div>

          <p className="font-sans text-cream/35 text-[11px] leading-relaxed mt-4 max-w-sm">
            By tapping Build My Profile or Sign Up you agree to our{' '}
            <a
              href="https://heyder.nz/terms-conditions/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-cream/60 transition-colors"
            >
              Terms &amp; Conditions
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
