import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import AdminLayout from '../../components/admin/AdminLayout';
import api from '../../utils/api';

const TIERS = ['Trial', 'Active', 'Founding'];

const EMPTY_COUPON_FORM = { code: '', discountPercent: '10', expiresAt: '' };

function CouponsSection() {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY_COUPON_FORM);
  const [saving, setSaving] = useState(false);

  const load = () => api.get('/admin/coupons')
    .then(r => setCoupons(r.data.coupons || []))
    .catch(console.error)
    .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const createCoupon = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/admin/coupons', {
        code: form.code,
        discountPercent: Number(form.discountPercent),
        expiresAt: form.expiresAt || null,
      });
      toast.success('Coupon created!');
      setShowAdd(false);
      setForm(EMPTY_COUPON_FORM);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create coupon');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (coupon) => {
    try {
      await api.put(`/admin/coupons/${coupon.code}`, { active: !coupon.active });
      setCoupons(prev => prev.map(c => c.code === coupon.code ? { ...c, active: !c.active } : c));
    } catch { toast.error('Failed to update coupon'); }
  };

  const removeCoupon = async (coupon) => {
    if (!confirm(`Delete coupon ${coupon.code}? This can't be undone.`)) return;
    try {
      await api.delete(`/admin/coupons/${coupon.code}`);
      setCoupons(prev => prev.filter(c => c.code !== coupon.code));
      toast.success('Coupon deleted');
    } catch { toast.error('Failed to delete coupon'); }
  };

  return (
    <div className="space-y-4 pt-2">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="font-serif text-xl text-cream">Discount Coupons</h2>
          <p className="font-sans text-cream/40 text-xs mt-1">Hand these out to ambassadors — attendees can apply one at checkout.</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary text-xs py-2 px-5">+ Create Coupon</button>
      </div>

      {showAdd && (
        <div className="card">
          <h3 className="font-sans font-semibold text-cream text-sm mb-4">New Coupon</h3>
          <form onSubmit={createCoupon} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              className="input-field uppercase"
              placeholder="Code (e.g. SARAH10)"
              required
              value={form.code}
              onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
            />
            <input
              className="input-field"
              type="number"
              min="1"
              max="100"
              placeholder="Discount %"
              required
              value={form.discountPercent}
              onChange={e => setForm(f => ({ ...f, discountPercent: e.target.value }))}
            />
            <input
              className="input-field"
              type="date"
              value={form.expiresAt}
              onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))}
            />
            <p className="font-sans text-cream/30 text-xs md:col-span-3 -mt-2">Leave the date blank for a coupon that never expires.</p>
            <div className="md:col-span-3 flex gap-3">
              <button type="submit" disabled={saving} className="btn-primary text-xs py-2 px-6 disabled:opacity-60">
                {saving ? 'Creating...' : 'Create'}
              </button>
              <button type="button" onClick={() => { setShowAdd(false); setForm(EMPTY_COUPON_FORM); }} className="btn-outline text-xs py-2 px-6">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {!loading && coupons.length === 0 && !showAdd && (
        <p className="font-sans text-cream/30 text-sm">No coupons yet.</p>
      )}

      {coupons.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {coupons.map(c => (
            <div key={c.code} className={`card ${!c.active || c.expired ? 'opacity-50' : ''}`}>
              <div className="flex items-start justify-between mb-2">
                <span className="font-mono text-gold text-sm">{c.code}</span>
                <span className="font-serif text-lg text-cream">{c.discountPercent}% off</span>
              </div>
              <p className="font-sans text-cream/40 text-xs mb-3">
                {c.expiresAt
                  ? `Expires ${new Date(c.expiresAt).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Pacific/Auckland' })}${c.expired ? ' (expired)' : ''}`
                  : 'Never expires'}
              </p>
              <div className="flex gap-3">
                <button onClick={() => toggleActive(c)} className="font-sans text-cream/50 hover:text-cream text-xs transition-colors">
                  {c.active ? 'Deactivate' : 'Activate'}
                </button>
                <button onClick={() => removeCoupon(c)} className="font-sans text-cream/30 hover:text-red-400 text-xs transition-colors">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminAmbassadors() {
  const [ambassadors, setAmbassadors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', instagram_handle: '', tier: 'Trial', notes: '' });
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    api.get('/admin/ambassadors')
      .then(r => setAmbassadors(r.data.ambassadors || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const addAmbassador = async (e) => {
    e.preventDefault();
    try {
      const r = await api.post('/admin/ambassadors', form);
      setAmbassadors(prev => [r.data.ambassador, ...prev]);
      setShowAdd(false);
      setForm({ name: '', email: '', instagram_handle: '', tier: 'Trial', notes: '' });
      toast.success('Ambassador added!');
    } catch { toast.error('Failed to add ambassador'); }
  };

  const tierColor = (tier) => ({
    'Trial': 'bg-slate/50 text-cream/60',
    'Active': 'bg-gold/15 text-gold',
    'Founding': 'bg-yellow/15 text-yellow',
  }[tier] || 'bg-slate/50 text-cream/60');

  const referralUrl = (code) => `${window.location.origin}/?ref=${code}`;

  return (
    <AdminLayout title="Ambassadors">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <p className="font-sans text-cream/50 text-sm">{ambassadors.length} ambassadors</p>
          <button onClick={() => setShowAdd(true)} className="btn-primary text-xs py-2 px-5">+ Add Ambassador</button>
        </div>

        {showAdd && (
          <div className="card">
            <h3 className="font-sans font-semibold text-cream text-sm mb-4">New Ambassador</h3>
            <form onSubmit={addAmbassador} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input className="input-field" placeholder="Full name *" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              <input className="input-field" placeholder="Email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              <input className="input-field" placeholder="Instagram handle" value={form.instagram_handle} onChange={e => setForm(f => ({ ...f, instagram_handle: e.target.value }))} />
              <select className="input-field" value={form.tier} onChange={e => setForm(f => ({ ...f, tier: e.target.value }))}>
                {TIERS.map(t => <option key={t}>{t}</option>)}
              </select>
              <textarea className="input-field md:col-span-2 resize-none" rows={2} placeholder="Notes..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              <div className="md:col-span-2 flex gap-3">
                <button type="submit" className="btn-primary text-xs py-2 px-6">Add</button>
                <button type="button" onClick={() => setShowAdd(false)} className="btn-outline text-xs py-2 px-6">Cancel</button>
              </div>
            </form>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {ambassadors.map(amb => (
            <div key={amb.id} className="card hover:border-gold/20 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-sans font-semibold text-cream">{amb.name}</p>
                  {amb.instagram_handle && (
                    <p className="font-sans text-cream/50 text-xs mt-0.5">@{amb.instagram_handle}</p>
                  )}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${tierColor(amb.tier)}`}>
                  {amb.tier}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                <div className="bg-navy/60 rounded-lg py-2">
                  <p className="font-serif text-xl text-cream">{amb.total_referrals || 0}</p>
                  <p className="font-sans text-cream/40 text-xs">Referrals</p>
                </div>
                <div className="bg-navy/60 rounded-lg py-2">
                  <p className="font-serif text-xl text-cream">{amb.dinners_attended || 0}</p>
                  <p className="font-sans text-cream/40 text-xs">Dinners</p>
                </div>
                <div className="bg-navy/60 rounded-lg py-2">
                  <p className="font-serif text-xl text-cream capitalize">{amb.active ? '✓' : '✗'}</p>
                  <p className="font-sans text-cream/40 text-xs">Active</p>
                </div>
              </div>

              <div className="bg-navy/40 rounded-lg px-3 py-2 mb-3 flex items-center gap-2">
                <span className="font-mono text-gold text-xs flex-1 truncate">{amb.referral_code}</span>
                <button
                  onClick={() => { navigator.clipboard.writeText(referralUrl(amb.referral_code)); toast.success('Link copied!'); }}
                  className="text-cream/40 hover:text-cream text-xs transition-colors"
                >copy link</button>
              </div>

              {amb.notes && <p className="font-sans text-cream/40 text-xs italic">{amb.notes}</p>}
            </div>
          ))}
        </div>

        <div className="border-t border-white/[0.06] pt-2">
          <CouponsSection />
        </div>
      </div>
    </AdminLayout>
  );
}
