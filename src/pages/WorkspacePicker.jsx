import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { useWorkspaceIndex } from '../contexts/WorkspaceContext';
import { createWorkspace, acceptInvite, declineInvite } from '../services/workspaces';
import { db, ref, get } from '../firebase/database';
import { FullSpinner } from '../components/Common';
import { friendlyError } from '../utils/helpers';

export default function WorkspacePicker() {
  const { user, signOut } = useAuth();
  const { toast } = useApp();
  const nav = useNavigate();
  const { ids, invites } = useWorkspaceIndex();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ids || ids.length === 0) return;
    const last = localStorage.getItem('tp.lastWs');
    nav(`/app/${ids.includes(last) ? last : ids[0]}`, { replace: true });
  }, [ids, nav]);

  if (!ids) return <FullSpinner label="Finding your workspaces…" />;
  if (ids.length) return <FullSpinner label="Opening workspace…" />;

  const create = async (e) => {
    e.preventDefault(); if (!name.trim()) return;
    setBusy(true);
    try { const { wid, cid } = await createWorkspace(user, { name: name.trim() }); nav(`/app/${wid}/channel/${cid}`); }
    catch (err) { toast(friendlyError(err, 'Could not create the workspace'), 'error'); setBusy(false); }
  };
  const accept = async (inv) => {
    try { await acceptInvite(user, inv.wid, inv); nav(`/app/${inv.wid}`); } catch (err) { toast(friendlyError(err, 'Could not accept the invitation'), 'error'); }
  };
  return (
    <main className="login">
      <div className="login-card">
        <h1>Welcome, {user.name?.split(' ')[0]}</h1>
        {invites.length > 0 && (
          <div className="stack" style={{ marginBottom: 18 }}>
            <b>Invitations</b>
            {invites.map((i) => (
              <div key={i.wid} className="card row"><span style={{ fontSize: 24 }}>{i.workspaceIcon}</span><div className="grow"><b>{i.workspaceName}</b><div className="small muted">from {i.invitedByName}</div></div>
                <button className="btn primary" onClick={() => accept(i)}>Join</button><button className="btn" onClick={() => declineInvite(user, i.wid)}>Decline</button></div>
            ))}
          </div>
        )}
        <p className="muted">Create a workspace for your team. You'll start with a #general channel.</p>
        <form onSubmit={create} className="stack">
          <label className="field">Workspace name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Design" maxLength={60} autoFocus /></label>
          <button className="btn primary" disabled={busy || !name.trim()}>{busy ? 'Creating…' : 'Create workspace'}</button>
        </form>
        <button className="btn ghost small" style={{ marginTop: 12 }} onClick={signOut}>Sign out</button>
      </div>
    </main>
  );
}
