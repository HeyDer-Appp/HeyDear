import React, { useState } from 'react';
import toast from 'react-hot-toast';
import api from '../utils/api';

const REASONS = [
  'Inappropriate behaviour',
  'Harassment or threats',
  'Underage user',
  'Impersonation or fake profile',
  'Something else',
];

// Required for Google Play's child safety standards policy — any
// social/dating-category app must let users report a safety concern
// in-app, not just describe a policy on paper. Every submission is
// stored (safetyReports collection) and emailed to info@heyder.nz for
// a human to review — see POST /api/portal/report.
export default function ReportUserModal({ userId, userName, onClose }) {
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!reason || submitting) return;
    setSubmitting(true);
    try {
      await api.post('/portal/report', { reportedUserId: userId, reason, details });
      setSubmitted(true);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not submit that report.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-navy/50 backdrop-blur-sm flex items-center justify-center p-5" onClick={onClose}>
      <div className="glass-card w-full max-w-sm space-y-4" onClick={e => e.stopPropagation()}>
        {submitted ? (
          <>
            <p className="font-serif font-bold text-xl text-navy">Thanks.</p>
            <p className="font-sans text-navy/72 text-sm leading-relaxed">
              We review every report. Urgent or child safety? Also email{' '}
              <a href="mailto:info@heyder.nz" className="text-plum hover:text-plum">info@heyder.nz</a>. Emergency: call 111.
            </p>
            <button onClick={onClose} className="plum-cta w-full">Close</button>
          </>
        ) : (
          <>
            <p className="font-serif font-bold text-xl text-navy">Report {userName || 'user'}</p>
            <p className="font-sans text-navy/65 text-xs">Only our team sees this.</p>
            <div className="space-y-1.5">
              {REASONS.map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl border font-sans text-sm transition-colors ${
                    reason === r
                      ? 'border-plum bg-plum/10 text-navy'
                      : 'border-navy/15 bg-white/30 text-navy/80 hover:border-plum/30'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <textarea
              value={details}
              onChange={e => setDetails(e.target.value)}
              placeholder="Details (optional)"
              rows={3}
              maxLength={2000}
              className="w-full bg-white/40 border border-navy/15 rounded-xl px-4 py-3 text-navy placeholder-navy/40 font-sans text-sm focus:outline-none focus:border-plum/50 resize-none"
            />
            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl border border-navy/15 text-navy/80 font-sans text-sm hover:bg-white/60 transition-colors disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!reason || submitting}
                className="plum-cta flex-1 disabled:opacity-40"
              >
                {submitting ? '...' : 'Send'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
