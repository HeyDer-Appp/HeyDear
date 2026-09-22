import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { getDoc } from 'firebase/firestore';
import { auth } from '../lib/firebase';
import { DEFAULT_COMPANY, DEFAULT_RULES } from '../lib/constants';
import { can as canDo } from '../lib/permissions';
import { isSetupDone, loadConfig } from '../services/admin';
import { ref } from '../services/common';

const Ctx = createContext(null);
const BRANCH_KEY = 'jerp.activeBranch';

export function AuthProvider({ children }) {
  const [status, setStatus] = useState('loading'); // loading | setup | anon | denied | ready | error
  const [error, setError] = useState('');
  const [fbUser, setFbUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [config, setConfig] = useState({ company: DEFAULT_COMPANY, rules: DEFAULT_RULES, branches: [] });
  const [ownerBranch, setOwnerBranch] = useState(() => {
    try { return localStorage.getItem(BRANCH_KEY) || ''; } catch { return ''; }
  });

  const refreshConfig = useCallback(async () => {
    const c = await loadConfig();
    setConfig(c);
    return c;
  }, []);

  useEffect(() => onAuthStateChanged(auth, async (u) => {
    setFbUser(u);
    setError('');
    try {
      if (!u) {
        // resolve first so the signed-in shell never renders without a profile
        const done = await isSetupDone();
        setProfile(null);
        setStatus(done ? 'anon' : 'setup');
        return;
      }
      const snap = await getDoc(ref('users', u.uid));
      if (!snap.exists()) { setStatus('denied'); setError('Your account has no ERP profile yet. Ask the owner to add you.'); return; }
      const p = { uid: u.uid, ...snap.data() };
      if (p.active === false) { setStatus('denied'); setError('Your account has been deactivated.'); return; }
      setProfile(p);
      await refreshConfig();
      setStatus('ready');
    } catch (e) {
      setStatus('error');
      setError(e.message || String(e));
    }
  }), [refreshConfig]);

  const isOwner = profile?.role === 'owner';
  const branchId = isOwner ? (ownerBranch && config.branches.some((b) => b.id === ownerBranch) ? ownerBranch : config.branches[0]?.id || '') : profile?.branchId || '';
  const branch = config.branches.find((b) => b.id === branchId) || null;

  const setBranchId = useCallback((id) => {
    setOwnerBranch(id);
    try { localStorage.setItem(BRANCH_KEY, id); } catch { /* ignore */ }
  }, []);

  const value = useMemo(() => ({
    status, error, fbUser, actor: profile, profile, isOwner,
    ...config, branchId, branch, setBranchId, refreshConfig,
    can: (perm) => canDo(profile, perm),
    branchName: (id) => config.branches.find((b) => b.id === id)?.name || id || '-',
    logout: () => signOut(auth),
  }), [status, error, fbUser, profile, isOwner, config, branchId, branch, setBranchId, refreshConfig]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useApp = () => useContext(Ctx);
