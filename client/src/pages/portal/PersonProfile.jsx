import React, { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { flagUrl } from '../../utils/flags';
import BottomNav from '../../components/BottomNav';
import ReportUserModal from '../../components/ReportUserModal';
import { Stagger, Rise } from '../../components/Motion';

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
  const [confirmUnconnect, setConfirmUnconnect] = useState(false);

  const fetchProfile = () => api.get(`/connections/profile/${userId}`)
    .then(res => { setData(res.data); setError(null); })
    .catch(err => setError(err.response?.data?.error || 'Could not load this profile.'));

  useEffect(() => {
    setLoading(true);
    fetchProfile().finally(() => setLoading(false));
  }, [userId]);

  const header = (
    <nav
      className="relative z-10 flex items-center justify-between px-6 pb-5"
      style={{ paddingTop: 'calc(1.25rem + env(safe-area-inset-top))' }}
    >
      <button onClick={() => navigate(-1)} className="font-sans text-navy/65 text-sm hover:text-navy transition-colors">← Back</button>
      <img src="https://heyder.nz/wp-content/uploads/2026/04/logo1.png" alt="HeyDer" className="h-7 brightness-0" />
      <div className="w-10" />
    </nav>
  );

  if (loading) {
    return (
      <div className="portal-bg min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-plum border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="portal-bg min-h-screen relative overflow-hidden pb-nav">
        {header}
        <div className="relative z-10 max-w-lg mx-auto px-5 py-20 text-center">
          <p className="font-serif text-2xl text-navy mb-3">Not available.</p>
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

  const handleUnconnect = async () => {
    setBusy(true);
    try {
      await api.post(`/connections/${userId}/unconnect`);
      toast.success('Unconnected.');
      setConfirmUnconnect(false);
      fetchProfile();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not unconnect.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="portal-bg min-h-screen relative overflow-hidden pb-nav">
      {header}
      <Stagger className="relative z-10 max-w-lg mx-auto px-5 py-8 space-y-6">
        <Rise className="flex flex-col items-center text-center">
          <img src={data.photo || AVATAR_FALLBACK} alt="" className="w-28 h-28 rounded-full object-cover border-2 border-plum/30 shadow-[0_10px_28px_rgba(22,24,29,0.2)]" />
          <h1 className="font-serif font-bold text-3xl text-navy mt-4 flex items-center gap-2">
            {data.first_name || 'Guest'}
            {data.country && flagUrl(data.country) && (
              <img src={flagUrl(data.country)} alt={data.country} className="h-4 rounded-[2px]" />
            )}
          </h1>
          {data.full_profile && (
            <div className="flex items-center gap-6 mt-4">
              <div className="text-center">
                <p className="font-serif text-2xl text-plum">{data.dinners_attended}</p>
                <p className="font-sans text-navy/55 text-[11px] uppercase tracking-widest">Dinners</p>
              </div>
              <div className="text-center">
                <p className="font-serif text-2xl text-plum">{data.connections_count}</p>
                <p className="font-sans text-navy/55 text-[11px] uppercase tracking-widest">Connections</p>
              </div>
            </div>
          )}

          <div className="mt-6 w-full max-w-[240px]">
            {data.connection_status === 'connected' && (
              <>
                <Link to={`/portal/dm/${data.connection_id}`} className="plum-cta w-full flex items-center justify-center gap-2">
                  Message
                </Link>
                {confirmUnconnect ? (
                  <div className="mt-3 text-center">
                    <p className="font-sans text-navy/65 text-xs mb-2">Unconnect?</p>
                    <div className="flex items-center justify-center gap-4">
                      <button onClick={handleUnconnect} disabled={busy} className="font-sans text-red-700 text-xs hover:text-red-800 transition-colors disabled:opacity-60">
                        {busy ? '...' : 'Yes'}
                      </button>
                      <button onClick={() => setConfirmUnconnect(false)} className="font-sans text-navy/55 text-xs hover:text-navy transition-colors">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setConfirmUnconnect(true)} className="mt-3 w-full font-sans text-navy/45 hover:text-navy/72 text-xs transition-colors">
                    Unconnect
                  </button>
                )}
              </>
            )}
            {data.connection_status === 'none' && (
              <button onClick={handleConnect} disabled={busy} className="plum-cta w-full disabled:opacity-60">
                {busy ? 'Sending...' : '+ Connect'}
              </button>
            )}
            {data.connection_status === 'pending_outgoing' && (
              <div className="w-full text-center py-3 rounded-2xl border border-navy/15 text-navy/55 text-sm font-sans">
                Request sent
              </div>
            )}
            {data.connection_status === 'pending_incoming' && (
              <button onClick={handleAccept} disabled={busy} className="plum-cta w-full disabled:opacity-60">
                {busy ? '...' : 'Accept'}
              </button>
            )}
          </div>
        </Rise>

        {data.full_profile ? (
          <Rise>
            {data.photos.length === 0 ? (
              <p className="font-sans text-navy/45 text-sm text-center">No photos yet.</p>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {data.photos.map(p => <PolaroidCard key={p.id} photo={p} />)}
              </div>
            )}
          </Rise>
        ) : (
          <Rise className="glass-card text-center py-8">
            <p className="font-sans text-navy/55 text-sm">Connect to see more.</p>
          </Rise>
        )}

        <Rise className="text-center pt-2">
          <button
            onClick={() => setShowReport(true)}
            className="font-sans text-navy/40 hover:text-red-700 text-xs transition-colors"
          >
            Report
          </button>
        </Rise>
      </Stagger>

      {showReport && (
        <ReportUserModal userId={userId} userName={data.first_name} onClose={() => setShowReport(false)} />
      )}

      <BottomNav />
    </div>
  );
}
