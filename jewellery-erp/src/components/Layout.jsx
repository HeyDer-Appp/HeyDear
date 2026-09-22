import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { LayoutDashboard, Receipt, FileText, Users, Boxes, Building2, ShieldCheck, Settings as Cog, ScrollText, Menu, LogOut } from 'lucide-react';
import { useApp } from '../context/Auth';
import { P, can } from '../lib/permissions';
import { ROLES } from '../lib/constants';

const NAV = [
  {
    h: 'Daily work',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, perm: P.VIEW_DASHBOARD, end: true },
      { to: '/bill', label: 'New Bill', icon: Receipt, perm: P.CREATE_BILL },
      { to: '/invoices', label: 'Bills', icon: FileText, perm: P.VIEW_INVOICES },
      { to: '/customers', label: 'Customers', icon: Users, perm: P.VIEW_CUSTOMERS },
      { to: '/inventory', label: 'Inventory', icon: Boxes, perm: P.VIEW_STOCK },
    ],
  },
  {
    h: 'Owner',
    items: [
      { to: '/branches', label: 'Branches', icon: Building2, perm: P.MANAGE_BRANCHES },
      { to: '/staff', label: 'Staff', icon: ShieldCheck, perm: P.MANAGE_STAFF },
      { to: '/settings', label: 'Settings', icon: Cog, perm: P.MANAGE_SETTINGS },
      { to: '/audit', label: 'Activity log', icon: ScrollText, perm: P.VIEW_AUDIT },
    ],
  },
];

export default function Layout() {
  const { profile, company, branches, branchId, setBranchId, isOwner, logout, branchName } = useApp();
  const [open, setOpen] = useState(false);
  useLocation(); // re-render on navigation so the drawer closes

  return (
    <div className="app">
      <aside className={`side ${open ? 'open' : ''}`} onClick={() => setOpen(false)}>
        <div className="brand">
          {company.name}
          <small>Jewellery billing</small>
        </div>
        <nav className="nav">
          {NAV.map((g) => {
            const items = g.items.filter((i) => can(profile, i.perm));
            if (!items.length) return null;
            return (
              <div key={g.h}>
                <div className="nav-h">{g.h}</div>
                {items.map((i) => (
                  <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => (isActive ? 'active' : '')}>
                    <i.icon size={17} /> {i.label}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>
      </aside>

      <div className="main">
        <header className="top">
          <button className="icon-btn menu-btn" onClick={() => setOpen((o) => !o)} aria-label="Menu"><Menu size={20} /></button>
          <div className="grow" />
          {isOwner ? (
            <label className="row small muted" style={{ gap: 6 }}>
              Working at
              <select value={branchId} onChange={(e) => setBranchId(e.target.value)} style={{ width: 'auto', minHeight: 34, padding: '5px 10px' }}>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}
              </select>
            </label>
          ) : (
            <span className="badge gold">{branchName(profile.branchId)}</span>
          )}
          <div className="right" style={{ lineHeight: 1.2 }}>
            <div className="bold">{profile.name}</div>
            <div className="small muted">{ROLES[profile.role]}</div>
          </div>
          <button className="icon-btn" onClick={logout} title="Sign out" aria-label="Sign out"><LogOut size={18} /></button>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
