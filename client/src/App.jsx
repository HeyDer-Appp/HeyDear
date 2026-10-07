import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { AuthProvider, useAuth } from './context/AuthContext';
import NativePushBootstrap from './components/NativePushBootstrap';
import PullToRefresh from './components/PullToRefresh';
import OfflineBanner from './components/OfflineBanner';

class ErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) return (
      <div className="min-h-screen bg-navy flex items-center justify-center p-8 text-center">
        <div className="max-w-sm">
          <p className="font-serif text-2xl text-cream mb-3">Something went wrong</p>
          <p className="font-sans text-cream/50 text-sm mb-6">{this.state.error.message}</p>
          <button onClick={() => { this.setState({ error: null }); window.history.back(); }} className="btn-outline text-xs py-2 px-6">Go back</button>
        </div>
      </div>
    );
    return this.props.children;
  }
}

import Home from './pages/Home';
import About from './pages/About';
import Quiz from './pages/Quiz';
import QuizSuccess from './pages/QuizSuccess';
import Feedback from './pages/Feedback';
import PrivacyPolicy from './pages/PrivacyPolicy';
import DeleteAccount from './pages/DeleteAccount';
import ChildSafety from './pages/ChildSafety';
import PartnerWithUs from './pages/PartnerWithUs';
import TermsConditions from './pages/TermsConditions';

import PortalLogin from './pages/portal/Login';
import PortalDashboard from './pages/portal/Dashboard';
import PortalEditProfile from './pages/portal/EditProfile';
import PortalMyAlbum from './pages/portal/MyAlbum';
import PortalBookDinner from './pages/portal/BookDinner';
import PortalChat from './pages/portal/Chat';
import PortalGroupChat from './pages/portal/GroupChat';
import PortalPersonProfile from './pages/portal/PersonProfile';
import PortalDirectChat from './pages/portal/DirectChat';

import AdminLogin from './pages/admin/Login';
import AdminDashboard from './pages/admin/Dashboard';
import AdminSignups from './pages/admin/Signups';
import AdminMatching from './pages/admin/Matching';
import AdminAnalytics from './pages/admin/Analytics';
import AdminAmbassadors from './pages/admin/Ambassadors';
import AdminPricing from './pages/admin/Pricing';
import AdminSubscriptions from './pages/admin/Subscriptions';
import AdminDinners from './pages/admin/Dinners';
import AdminRestaurants from './pages/admin/Restaurants';
import AdminContent from './pages/admin/Content';
import AdminFeedback from './pages/admin/Feedback';

function AdminRoute({ children }) {
  const { adminUser, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-navy flex items-center justify-center"><div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" /></div>;
  return adminUser ? children : <Navigate to="/admin/login" replace />;
}

function PortalRoute({ children }) {
  const { attendeeUser, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{ background: '#E7DFC5' }}><div className="w-8 h-8 border-2 border-plum border-t-transparent rounded-full animate-spin" /></div>;
  return attendeeUser ? children : <Navigate to="/portal/login" replace />;
}

// Building your profile requires being signed in first — same guard as the
// rest of the attendee portal, just aliased for clarity at the call site.
const ProfileRoute = PortalRoute;

// The native app's WebView loads the plain site root — same marketing
// homepage (hero video and all) any first-time visitor gets — every cold
// start, before there's been any chance to check whether this is actually
// a signed-in attendee reopening the app. A useEffect-after-render redirect
// still let that homepage flash on screen for a moment first; blocking here
// instead, before Home ever mounts, means an already-signed-in attendee
// never sees it at all. Gated to native only — the actual website's "/"
// showing the marketing page for a logged-in browser session is unrelated.
function HomeRoute() {
  const { attendeeUser, loading } = useAuth();
  if (Capacitor.isNativePlatform()) {
    // A plain navy div here read as broken/frozen rather than loading —
    // same logo + spinner every other loading state in the app already
    // uses (PortalRoute/AdminRoute included), so this brief moment looks
    // intentional instead of blank.
    if (loading) return (
      <div className="min-h-screen bg-navy flex flex-col items-center justify-center gap-6">
        <img src="https://heyder.nz/wp-content/uploads/2026/04/logo1.png" alt="HeyDer" className="h-9" />
        <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
    if (attendeeUser) return <Navigate to="/portal/dashboard" replace />;
  }
  return <Home />;
}

// In the native app, coming back from minimised (not a cold start — that's
// HomeRoute's job above) landed wherever the WebView's last URL happened to
// be, instead of the dashboard — jarring since that could be several taps
// deep. Skipped for a pending Stripe checkout, since Quiz.jsx/BookDinner.jsx's
// own resume listeners need to run on that exact page to check whether the
// payment went through; forcing a navigate away here would race and break
// that check.
function useResumeToDashboard() {
  useEffect(() => {
    const mark = (e) => { if (e.target && e.target.type === 'file') window.__heyderPickerAt = Date.now(); };
    document.addEventListener('click', mark, true);
    return () => document.removeEventListener('click', mark, true);
  }, []);
  const navigate = useNavigate();
  const location = useLocation();
  const { attendeeUser } = useAuth();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const listenerPromise = CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (!isActive || !attendeeUser) return;
      if (sessionStorage.getItem('heyder_pending_session_id')) return;
      if (location.pathname.startsWith('/admin')) return;
      if (location.pathname === '/portal/dashboard') return;
      // Coming back from the phone's photo picker (also an app pause/resume).
      if (Date.now() - (window.__heyderPickerAt || 0) < 5 * 60 * 1000) return;
      if (location.pathname.startsWith('/portal/profile') || location.pathname === '/profile') return;
      // Just tapped a notification — that tap is taking us somewhere specific.
      if (Date.now() - (window.__heyderNotifTapAt || 0) < 4000) return;
      navigate('/portal/dashboard');
    });
    return () => { listenerPromise.then(l => l.remove()); };
  }, [attendeeUser, navigate, location.pathname]);
}

function AppRoutes() {
  useResumeToDashboard();
  const { pathname, state: locationState } = useLocation();
  // The page behind everything is dark by default; on the beige app screens
  // that showed as a dark blink whenever one screen left before the next drew.
  const beige = pathname.startsWith('/portal') || pathname.startsWith('/profile');
  useEffect(() => {
    const c = beige ? '#E7DFC5' : '';
    document.documentElement.style.backgroundColor = c;
    document.body.style.backgroundColor = c;
  }, [beige]);
  return (
    <>
    <NativePushBootstrap />
    <OfflineBanner />
    {pathname.startsWith('/portal') && <PullToRefresh />}
    {/* No route fade for the profile-completion handoff: Quiz.jsx has already
        dissolved into the same map the dashboard starts on, and a fade from
        transparent here would make that map blink at the swap. */}
    <div key={pathname} className={beige && !locationState?.justCompletedProfile ? (locationState?.swipeDir ? `route-slide-${locationState.swipeDir}` : 'route-fade') : undefined}>
    <Routes>
      <Route path="/" element={<HomeRoute />} />
      <Route path="/about" element={<About />} />
      <Route path="/quiz" element={<Navigate to="/profile" replace />} />
      <Route path="/profile" element={<ProfileRoute><Quiz /></ProfileRoute>} />
      <Route path="/profile/success" element={<ProfileRoute><QuizSuccess /></ProfileRoute>} />
      <Route path="/feedback/:dinnerId" element={<Feedback />} />
      <Route path="/privacy-policy" element={<PrivacyPolicy />} />
      <Route path="/delete-account" element={<DeleteAccount />} />
      <Route path="/child-safety" element={<ChildSafety />} />
      <Route path="/partner-with-us" element={<PartnerWithUs />} />
      <Route path="/terms-conditions" element={<TermsConditions />} />

      <Route path="/portal/login" element={<PortalLogin />} />
      <Route path="/portal" element={<PortalRoute><PortalDashboard /></PortalRoute>} />
      <Route path="/portal/dashboard" element={<PortalRoute><PortalDashboard /></PortalRoute>} />
      <Route path="/portal/profile" element={<PortalRoute><PortalEditProfile /></PortalRoute>} />
      <Route path="/portal/book" element={<PortalRoute><PortalBookDinner /></PortalRoute>} />
      <Route path="/portal/album" element={<PortalRoute><PortalMyAlbum /></PortalRoute>} />
      <Route path="/portal/chat" element={<PortalRoute><PortalChat /></PortalRoute>} />
      <Route path="/portal/group-chat" element={<PortalRoute><PortalGroupChat /></PortalRoute>} />
      <Route path="/portal/person/:userId" element={<PortalRoute><PortalPersonProfile /></PortalRoute>} />
      <Route path="/portal/dm/:connectionId" element={<PortalRoute><PortalDirectChat /></PortalRoute>} />

      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
      <Route path="/admin/dashboard" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
      <Route path="/admin/signups" element={<AdminRoute><AdminSignups /></AdminRoute>} />
      <Route path="/admin/matching" element={<AdminRoute><AdminMatching /></AdminRoute>} />
      <Route path="/admin/analytics" element={<AdminRoute><AdminAnalytics /></AdminRoute>} />
      <Route path="/admin/ambassadors" element={<AdminRoute><AdminAmbassadors /></AdminRoute>} />
      <Route path="/admin/pricing" element={<AdminRoute><AdminPricing /></AdminRoute>} />
      <Route path="/admin/subscriptions" element={<AdminRoute><AdminSubscriptions /></AdminRoute>} />
      <Route path="/admin/dinners" element={<AdminRoute><AdminDinners /></AdminRoute>} />
      <Route path="/admin/restaurants" element={<AdminRoute><AdminRestaurants /></AdminRoute>} />
      <Route path="/admin/content" element={<AdminRoute><AdminContent /></AdminRoute>} />
      <Route path="/admin/feedback" element={<AdminRoute><AdminFeedback /></AdminRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </div>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#353d4a',
            color: '#F5EDD8',
            border: '1px solid rgba(245,237,216,0.08)',
            fontFamily: 'Jost, sans-serif',
          },
          success: { iconTheme: { primary: '#E8A854', secondary: '#353d4a' } },
          error: { iconTheme: { primary: '#ef4444', secondary: '#353d4a' } },
        }}
      />
      <ErrorBoundary>
        <AppRoutes />
      </ErrorBoundary>
    </AuthProvider>
  );
}
