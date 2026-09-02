import React, { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { flagUrl } from '../../utils/flags';
import BottomNav from '../../components/BottomNav';
import ReportUserModal from '../../components/ReportUserModal';

const AVATAR_FALLBACK = 'https://heyder.nz/wp-content/uploads/2026/06/account-2.png';

function PolaroidCard({ photo }) {
  return (
    <div className="bg-[#f5edd8] rounded-sm p-1.5 shadow-[0_6px_18px_rgba(0,0,0,0.4)] select-none">
      <div className="w-full aspect-square bg-black/20 overflow-hidden">
        <img src={photo.photo} alt="" className="w-full h-full object-cover" draggable={false} />
      </div>
    </div>
  );
}

export default function PersonProfile() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showReport, setShowReport] = useState(false);

  const fetchProfile = () => api.get(`/connections/profile/${userId}`)
    .then(res => { setData(res.data); setError(null); })
    .catch(err => setError(err.response?.data?.error || 'Could not load this profile.'));

  useEffect(() => {
    setLoading(true);
    fetchProfile().finally(() => setLoading(false));
  }, [userId]);

  const header = (
    <nav className="relative z-10 flex items-center justify-between px-6 py-5 border-b border-white/[0.06] backdrop-blur">
      <button onClick={() => navigate(-1)} className="font-sans text-cream/50 text-sm hover:text-cream transition-colors">← Back</button>
      <img src="https://heyder.nz/wp-content/uploads/2026/04/logo1.png" alt="HeyDer" className="h-7" />
      <div className="w-10" />
    </nav>
  );

  if (loading) {
    return (
      <div className="quiz-bg min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="quiz-bg min-h-screen relative overflow-hidden pb-24">
        {header}
        <div className="relative z-10 max-w-lg mx-auto px-5 py-20 text-center">
          <p className="font-serif text-2xl text-cream mb-3">Can't view this profile</p>
          <p className="font-sans text-cream/50 text-sm">{error}</p>
        </div>
        <BottomNav />
      </div>
    );
  }

  const handleConnect = async () => {
    setBusy(true);
    try {
      await api.post('/connections/request', { toUserId: userId });
      toast.success('Connect request sent!');
      fetchProfile();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not send that request.');
    } finally {
      setBusy(false);
    }
  };

  const handleAccept = async () => {
    setBusy(true);
    try {
      await api.post(`/connections/requests/${data.request_id}/accept`);
      toast.success('Connected!');
      fetchProfile();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not accept that request.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="quiz-bg min-h-screen relative overflow-hidden pb-24">
      {header}
      <div className="relative z-10 max-w-lg mx-auto px-5 py-8 space-y-6">
        <div className="flex flex-col items-center text-center">
          <img src={data.photo || AVATAR_FALLBACK} alt="" className="w-24 h-24 rounded-full object-cover border-2 border-gold/30" />
          <h1 className="font-serif text-2xl text-cream mt-4 flex items-center gap-2">
            {data.first_name || 'Guest'}
            {data.country && flagUrl(data.country) && (
              <img src={flagUrl(data.country)} alt={data.country} className="h-4 rounded-[2px]" />
            )}
          </h1>
          {data.full_profile && (
            <div className="flex items-center gap-6 mt-4">
              <div className="text-center">
                <p className="font-serif text-2xl text-gold">{data.dinners_attended}</p>
                <p className="font-sans text-cream/40 text-[11px] uppercase tracking-widest">Dinners</p>
              </div>
              <div className="text-center">
                <p className="font-serif text-2xl text-gold">{data.connections_count}</p>
                <p className="font-sans text-cream/40 text-[11px] uppercase tracking-widest">Connections</p>
              </div>
            </div>
          )}

          <div className="mt-6 w-full max-w-[240px]">
            {data.connection_status === 'connected' && (
              <Link to={`/portal/dm/${data.connection_id}`} className="quiz-cta w-full flex items-center justify-center gap-2">
                💬 Message
              </Link>
            )}
            {data.connection_status === 'none' && (
              <button onClick={handleConnect} disabled={busy} className="quiz-cta w-full disabled:opacity-60">
                {busy ? 'Sending...' : '+ Connect'}
              </button>
            )}
            {data.connection_status === 'pending_outgoing' && (
              <div className="w-full text-center py-3 rounded-2xl border border-white/10 text-cream/40 text-sm font-sans">
                Request sent
              </div>
            )}
            {data.connection_status === 'pending_incoming' && (
              <button onClick={handleAccept} disabled={busy} className="quiz-cta w-full disabled:opacity-60">
                {busy ? 'Accepting...' : 'Accept connect request'}
              </button>
            )}
          </div>
        </div>

        {data.full_profile ? (
          <div>
            <p className="font-sans font-semibold text-cream/50 text-xs uppercase tracking-widest mb-3">Photos</p>
            {data.photos.length === 0 ? (
              <p className="font-sans text-cream/30 text-sm italic">No photos shared yet.</p>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {data.photos.map(p => <PolaroidCard key={p.id} photo={p} />)}
              </div>
            )}
          </div>
        ) : (
          <div className="quiz-card text-center py-8">
            <p className="font-sans text-cream/40 text-sm">
              Connect with {data.first_name || 'them'} to see their dinners, connections, and photos.
            </p>
          </div>
        )}

        <div className="text-center pt-2">
          <button
            onClick={() => setShowReport(true)}
            className="font-sans text-cream/25 hover:text-red-400 text-xs transition-colors"
          >
            Report {data.first_name || 'this user'}
          </button>
        </div>
      </div>

      {showReport && (
        <ReportUserModal userId={userId} userName={data.first_name} onClose={() => setShowReport(false)} />
      )}

      <BottomNav />
    </div>
  );
}
