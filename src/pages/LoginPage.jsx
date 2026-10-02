import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { friendlyError } from '../utils/helpers';

export default function LoginPage() {
  const { signIn } = useAuth();
  const { toast } = useApp();
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try { await signIn(); } catch (e) { toast(friendlyError(e, 'Authentication failed'), 'error'); } finally { setBusy(false); }
  };
  return (
    <main className="login">
      <div className="login-card">
        <div className="logo" aria-hidden>〰</div>
        <h1>Tidepool</h1>
        <p className="muted">Channels, threads and direct messages for your team, live as they happen.</p>
        <button className="btn primary" style={{ width: '100%', padding: 12, marginTop: 14 }} onClick={go} disabled={busy}>
          {busy ? 'Opening Google…' : 'Continue with Google'}
        </button>
        <p className="small muted" style={{ marginTop: 18 }}>Signing in creates your profile the first time.</p>
      </div>
    </main>
  );
}
