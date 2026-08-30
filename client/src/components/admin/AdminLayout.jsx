import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const navItems = [
  { label: 'Dashboard', href: '/admin/dashboard', icon: '⊞' },
  { label: 'Matching', href: '/admin/matching', icon: '⇄' },
  { label: 'Signups', href: '/admin/signups', icon: '✦' },
  { label: 'Album', href: '/admin/content', icon: '📷' },
  { label: 'Dinners', href: '/admin/dinners', icon: '🍽' },
  { label: 'Restaurants', href: '/admin/restaurants', icon: '📍' },
  { label: 'Feedback', href: '/admin/feedback', icon: '💬' },
  { label: 'Analytics', href: '/admin/analytics', icon: '◎' },
  { label: 'Ambassadors', href: '/admin/ambassadors', icon: '★' },
  { label: 'Pricing', href: '/admin/pricing', icon: '$' },
  { label: 'Subscriptions', href: '/admin/subscriptions', icon: '✦' },
];

export default function AdminLayout({ children, title }) {
  const { logout, adminUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login');
  };

  return (
    <div className="min-h-screen bg-navy flex">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-56' : 'w-14'} flex-shrink-0 bg-deep-card border-r border-white/5 flex flex-col transition-all duration-200`}>
        <div className="p-4 border-b border-white/5 flex items-center gap-3">
          <img src="https://heyder.nz/wp-content/uploads/2026/04/logo1.png" alt="HeyDer" className="h-6 flex-shrink-0" />
          {sidebarOpen && <span className="font-sans text-cream/40 text-xs tracking-widest uppercase">Admin</span>}
        </div>

        <nav className="flex-1 py-4">
          {navItems.map(item => {
            const active = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm font-sans transition-all mb-1 ${
                  active
                    ? 'bg-gold/15 text-cream border border-gold/20'
                    : 'text-cream/50 hover:text-cream hover:bg-white/5'
                }`}
                title={!sidebarOpen ? item.label : undefined}
              >
                <span className="flex-shrink-0 w-4 text-center">{item.icon}</span>
                {sidebarOpen && item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/5">
          {sidebarOpen && (
            <p className="font-sans text-cream/30 text-xs mb-3 truncate">{adminUser?.email}</p>
          )}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-cream/40 hover:text-cream hover:bg-white/5 font-sans text-xs transition-colors"
          >
            <span>⏻</span>
            {sidebarOpen && 'Sign out'}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-deep-card border-b border-white/5 px-6 py-4 flex items-center gap-4">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-cream/40 hover:text-cream transition-colors"
          >
            ☰
          </button>
          <h1 className="font-sans font-semibold text-cream text-base">{title}</h1>
        </header>
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
