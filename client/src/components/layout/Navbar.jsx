import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function Navbar() {
  const { attendeeUser, loading } = useAuth();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-5">
      <Link to="/" className="relative z-50">
        <img
          src="https://heyder.nz/wp-content/uploads/2026/04/logo1.png"
          alt="HeyDer"
          className="h-8 w-auto"
        />
      </Link>
      {!loading && (
        <Link
          to={attendeeUser ? '/portal/dashboard' : '/portal/login'}
          className="relative z-50 font-sans text-xs text-cream/70 hover:text-cream border border-cream/20 hover:border-cream/40 rounded-full px-4 py-2 tracking-widest uppercase transition-colors"
        >
          {attendeeUser ? 'My Account' : 'Login'}
        </Link>
      )}
    </nav>
  );
}
