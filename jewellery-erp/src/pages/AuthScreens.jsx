import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, isConfigured } from '../lib/firebase';
import { errMsg } from '../lib/errors';
import { runInitialSetup } from '../services/admin';
import { Button, ErrorBox, Field } from '../components/ui';
import { useApp } from '../context/Auth';

export function ConfigMissing() {
  return (
    <div className="auth">
      <div className="card stack">
        <h1>Firebase not configured</h1>
        <p className="muted">Copy <code>.env.example</code> to <code>.env</code>, fill in your Firebase web-app keys, then restart the dev server.</p>
        <ol className="muted" style={{ paddingLeft: 18, margin: 0 }}>
          <li>Firebase console → create a project</li>
          <li>Build → Authentication → enable <b>Email/Password</b></li>
          <li>Build → Firestore Database → create database</li>
          <li>Project settings → Your apps → add a Web app → copy the config into <code>.env</code></li>
          <li>Deploy <code>firestore.rules</code> and <code>firestore.indexes.json</code> (see README)</li>
        </ol>
      </div>
    </div>
  );
}

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      setError(errMsg(err));
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <form className="card stack" onSubmit={submit}>
        <div>
          <h1>Jewellery ERP</h1>
          <p className="muted center" style={{ margin: '4px 0 0' }}>Sign in to continue</p>
        </div>
        <ErrorBox error={error} />
        <Field label="Email"><input type="email" autoFocus required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" /></Field>
        <Field label="Password"><input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></Field>
        <Button variant="gold" className="lg" loading={busy} type="submit">Sign in</Button>
        {import.meta.env.VITE_DEMO && (
          <div className="alert info small">
            <b>Demo mode</b> - sample data, resets on refresh. Password for all: <code>demo123</code>
            <div className="row wrap" style={{ marginTop: 8, gap: 6 }}>
              {['owner', 'staff', 'staff2'].map((r) => (
                <button type="button" key={r} className="btn ghost sm" onClick={() => { setEmail(`${r}@demo.com`); setPassword('demo123'); }}>{r}</button>
              ))}
            </div>
          </div>
        )}
      </form>
    </div>
  );
}

export function Denied() {
  const { error, logout } = useApp();
  return (
    <div className="auth">
      <div className="card stack">
        <h1>No access</h1>
        <p className="muted center">{error}</p>
        <Button variant="ghost" onClick={logout}>Sign out</Button>
      </div>
    </div>
  );
}

export function LoadError() {
  const { error } = useApp();
  return (
    <div className="auth">
      <div className="card stack">
        <h1>Could not load</h1>
        <ErrorBox error={error} />
        <p className="muted small">Usually this means the Firestore rules or indexes have not been deployed yet, or the Firebase keys in <code>.env</code> are wrong.</p>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    </div>
  );
}

// First-run wizard: shown only while meta/setup does not exist.
export function Setup() {
  const [f, setF] = useState({ ownerName: '', email: '', password: '', company: '', gstin: '', phone: '', branchName: '', branchCode: '', city: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await runInitialSetup({
        email: f.email.trim(), password: f.password, ownerName: f.ownerName,
        company: { name: f.company, gstin: f.gstin, phone: f.phone },
        branch: { name: f.branchName, code: f.branchCode, city: f.city, phone: f.phone },
      });
      window.location.reload();
    } catch (err) {
      setError(errMsg(err));
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <form className="card stack" style={{ maxWidth: 560 }} onSubmit={submit}>
        <div>
          <h1>Welcome</h1>
          <p className="muted center" style={{ margin: '4px 0 0' }}>One-time setup: create the owner account, your company and first branch.</p>
        </div>
        <ErrorBox error={error} />
        <h3>Owner account</h3>
        <div className="grid g2">
          <Field label="Your name"><input required value={f.ownerName} onChange={set('ownerName')} /></Field>
          <Field label="Email"><input type="email" required value={f.email} onChange={set('email')} /></Field>
        </div>
        <Field label="Password" hint="At least 6 characters"><input type="password" minLength={6} required value={f.password} onChange={set('password')} autoComplete="new-password" /></Field>
        <h3>Company</h3>
        <div className="grid g2">
          <Field label="Shop / company name"><input required value={f.company} onChange={set('company')} /></Field>
          <Field label="GSTIN (optional)"><input value={f.gstin} onChange={set('gstin')} /></Field>
        </div>
        <h3>First branch</h3>
        <div className="grid g3">
          <Field label="Branch name"><input required value={f.branchName} onChange={set('branchName')} placeholder="Main Showroom" /></Field>
          <Field label="Branch code" hint="Used in invoice numbers"><input required value={f.branchCode} onChange={set('branchCode')} placeholder="NGP01" maxLength={8} /></Field>
          <Field label="City"><input value={f.city} onChange={set('city')} /></Field>
        </div>
        <Button variant="gold" className="lg" loading={busy} type="submit">Create my workspace</Button>
      </form>
    </div>
  );
}
