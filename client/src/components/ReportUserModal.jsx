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
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-5" onClick={onClose}>
      <div className="quiz-card w-full max-w-sm space-y-4" onClick={e => e.stopPropagation()}>
        {submitted ? (
          <>
            <p className="font-serif text-xl text-cream">Report submitted</p>
            <p className="font-sans text-cream/60 text-sm leading-relaxed">
              Thanks — our team reviews every report and will follow up if we need more information.
              If this involves a child safety concern or is urgent, also email{' '}
              <a href="mailto:info@heyder.nz" className="text-gold hover:text-yellow">info@heyder.nz</a> directly.
            </p>
            <button onClick={onClose} className="quiz-cta w-full">Close</button>
          </>
        ) : (
          <>
            <p className="font-serif text-xl text-cream">Report {userName || 'this user'}</p>
            <p className="font-sans text-cream/50 text-xs leading-relaxed">
              This goes straight to our team, not to {userName || 'them'}. We review every report.
            </p>
            <div className="space-y-1.5">
              {REASONS.map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl border font-sans text-sm transition-colors ${
                    reason === r
                      ? 'border-gold bg-gold/10 text-cream'
                      : 'border-white/10 bg-white/[0.03] text-cream/70 hover:border-gold/30'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <textarea
              value={details}
              onChange={e => setDetails(e.target.value)}
              placeholder="Any extra detail that would help us (optional)"
              rows={3}
              maxLength={2000}
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-cream placeholder-cream/25 font-sans text-sm focus:outline-none focus:border-gold/50 resize-none"
            />
            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-cream/70 font-sans text-sm hover:bg-white/[0.04] transition-colors disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!reason || submitting}
                className="quiz-cta flex-1 disabled:opacity-40"
              >
                {submitting ? 'Submitting...' : 'Submit report'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
