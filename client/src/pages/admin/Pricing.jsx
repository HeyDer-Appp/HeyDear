import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import AdminLayout from '../../components/admin/AdminLayout';
import api from '../../utils/api';

// The API deals in cents (what Stripe wants); this page deals in dollars
// (what a human wants to type) — convert at the edges only.
const toDollars = (cents) => (cents / 100).toString();
const toCents = (dollars) => Math.round(Number(dollars) * 100);

export default function AdminPricing() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [oneTime, setOneTime] = useState('');
  const [subscription, setSubscription] = useState('');
  const [currency, setCurrency] = useState('nzd');

  useEffect(() => {
    api.get('/admin/pricing')
      .then(r => {
        setOneTime(toDollars(r.data.oneTimeAmount));
        setSubscription(toDollars(r.data.subscriptionAmount));
        setCurrency(r.data.currency);
      })
      .catch(() => toast.error('Failed to load pricing'))
      .finally(() => setLoading(false));
  }, []);

  const save = async (e) => {
    e.preventDefault();
    const oneTimeAmount = toCents(oneTime);
    const subscriptionAmount = toCents(subscription);
    if (!oneTimeAmount || !subscriptionAmount) {
      toast.error('Enter a valid price for both plans.');
      return;
    }
    setSaving(true);
    try {
      await api.put('/admin/pricing', { oneTimeAmount, subscriptionAmount });
      toast.success('Pricing updated — takes effect on the next checkout, no redeploy needed.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save pricing');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout title="Pricing">
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Pricing">
      <div className="max-w-lg">
        <p className="font-sans text-cream/50 text-sm mb-6">
          What attendees pay at signup and when booking a dinner. Changes apply immediately — the quiz and booking pages always fetch the current price, no app redeploy needed.
        </p>

        <form onSubmit={save} className="card space-y-5">
          <div>
            <label className="font-sans text-cream/50 text-xs uppercase tracking-widest block mb-1.5">
              One-time reservation ({currency.toUpperCase()})
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-cream/40">$</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={oneTime}
                onChange={e => setOneTime(e.target.value)}
                className="input-field pl-8"
              />
            </div>
            <p className="font-sans text-cream/30 text-xs mt-1">Charged once per dinner reservation.</p>
          </div>

          <div>
            <label className="font-sans text-cream/50 text-xs uppercase tracking-widest block mb-1.5">
              Monthly membership ({currency.toUpperCase()}/mo)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-cream/40">$</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={subscription}
                onChange={e => setSubscription(e.target.value)}
                className="input-field pl-8"
              />
            </div>
            <p className="font-sans text-cream/30 text-xs mt-1">Recurring charge — covers unlimited dinners for the billing period.</p>
          </div>

          <button type="submit" disabled={saving} className="btn-primary text-sm py-2.5 px-6 disabled:opacity-60">
            {saving ? 'Saving...' : 'Save Pricing'}
          </button>
        </form>
      </div>
    </AdminLayout>
  );
}
