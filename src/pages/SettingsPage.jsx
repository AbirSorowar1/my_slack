import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useApp } from '../contexts/AppContext';
import { useValue } from '../hooks/useDb';
import { updateProfile, saveSettings } from '../services/users';
import { updateWorkspace, deleteWorkspace, leaveWorkspace, inviteByEmail, addExistingUserByEmail, revokeInvite, removeMember, setMemberRole } from '../services/workspaces';
import { deleteChannel } from '../services/channels';
import { ensureDemoData } from '../services/channels';
import { uploadToStorage } from '../firebase/storage';
import { compressImage } from '../utils/image';
import { canManage, friendlyError } from '../utils/helpers';
import MembersList from '../components/MembersList';
import { STATUS_PRESETS } from '../components/UserMenu';

const TABS = ['Account', 'Appearance', 'Notifications', 'Privacy', 'Workspace', 'Shortcuts'];

export default function SettingsPage() {
  const [tab, setTab] = useState('Account');
  return (
    <div className="main settings" style={{ flex: 1 }}>
      <nav aria-label="Settings sections">{TABS.map((t) => <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>)}</nav>
      <section>
        {tab === 'Account' && <Account />}
        {tab === 'Appearance' && <Appearance />}
        {tab === 'Notifications' && <Notifications />}
        {tab === 'Privacy' && <Privacy />}
        {tab === 'Workspace' && <WorkspaceTab />}
        {tab === 'Shortcuts' && <Shortcuts />}
      </section>
    </div>
  );
}

function Account() {
  const { user } = useAuth(); const { toast } = useApp();
  const [f, setF] = useState({ name: user.name || '', displayName: user.displayName || '', bio: user.bio || '', timezone: user.timezone || '', statusEmoji: user.statusEmoji || '', statusText: user.statusText || '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = async () => { try { await updateProfile(user.uid, f); toast('Profile saved', 'success'); } catch (e) { toast(friendlyError(e), 'error'); } };
  const photo = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try { const small = await compressImage(file, 512); const { url } = await uploadToStorage(`avatars/${user.uid}/avatar_${Date.now()}`, small); await updateProfile(user.uid, { photoURL: url }); toast('Photo updated', 'success'); }
    catch (err) { toast(friendlyError(err, 'Upload failed'), 'error'); }
  };
  return (
    <div className="stack" style={{ maxWidth: 520 }}>
      <h2>Account</h2>
      <label className="field">Profile photo<input type="file" accept="image/*" onChange={photo} /></label>
      <label className="field">Email<input value={user.email} disabled /></label>
      <label className="field">Full name<input value={f.name} onChange={set('name')} maxLength={80} /></label>
      <label className="field">Display name (used for @mentions)<input value={f.displayName} onChange={set('displayName')} maxLength={80} /></label>
      <label className="field">About<textarea rows={3} value={f.bio} onChange={set('bio')} maxLength={500} /></label>
      <label className="field">Time zone<input value={f.timezone} onChange={set('timezone')} placeholder="Asia/Dhaka" /></label>
      <div className="field">Custom status</div>
      <div className="row"><input style={{ width: 70 }} value={f.statusEmoji} onChange={set('statusEmoji')} placeholder="😀" aria-label="Status emoji" maxLength={4} /><input value={f.statusText} onChange={set('statusText')} placeholder="What's your status?" aria-label="Status text" maxLength={80} /></div>
      <div className="row" style={{ flexWrap: 'wrap' }}>{STATUS_PRESETS.map(([e, t]) => <button key={t} className="btn" onClick={() => setF({ ...f, statusEmoji: e, statusText: t })}>{e} {t}</button>)}</div>
      <div><button className="btn primary" onClick={save}>Save changes</button></div>
    </div>
  );
}

function Appearance() {
  const { theme, setTheme, density, setDensity } = useApp();
  return (
    <div className="stack" style={{ maxWidth: 420 }}>
      <h2>Appearance</h2>
      <label className="field">Theme<select value={theme} onChange={(e) => setTheme(e.target.value)}><option value="system">Match system</option><option value="light">Light</option><option value="dark">Dark</option></select></label>
      <label className="field">Message density<select value={density} onChange={(e) => setDensity(e.target.value)}><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></label>
    </div>
  );
}

function Notifications() {
  const { user } = useAuth(); const { settings } = useWorkspace(); const { toast } = useApp();
  const flag = (k, def = true) => (settings[k] === undefined ? def : settings[k]);
  const toggle = (k) => (e) => saveSettings(user.uid, { [k]: e.target.checked }).catch(() => toast('Could not save setting', 'error'));
  const desktop = async (e) => {
    if (e.target.checked && 'Notification' in window && Notification.permission !== 'granted') {
      const p = await Notification.requestPermission();
      if (p !== 'granted') { toast('Desktop notifications were blocked by the browser', 'error'); return; }
    }
    saveSettings(user.uid, { desktop: e.target.checked });
  };
  return (
    <div style={{ maxWidth: 420 }}>
      <h2>Notifications</h2>
      <label className="check"><input type="checkbox" checked={flag('notifyMentions')} onChange={toggle('notifyMentions')} /> Mentions</label>
      <label className="check"><input type="checkbox" checked={flag('notifyDms')} onChange={toggle('notifyDms')} /> Direct and group messages</label>
      <label className="check"><input type="checkbox" checked={flag('notifyThreads')} onChange={toggle('notifyThreads')} /> Thread replies</label>
      <label className="check"><input type="checkbox" checked={flag('sound')} onChange={toggle('sound')} /> Play a sound</label>
      <label className="check"><input type="checkbox" checked={flag('desktop', false)} onChange={desktop} disabled={!('Notification' in window)} /> Desktop notifications {!('Notification' in window) && '(not supported)'}</label>
    </div>
  );
}

function Privacy() {
  const { user } = useAuth(); const { toast } = useApp();
  const set = (patch) => updateProfile(user.uid, patch).catch(() => toast('Could not save setting', 'error'));
  return (
    <div className="stack" style={{ maxWidth: 420 }}>
      <h2>Privacy</h2>
      <label className="field">Online status<select value={user.manualStatus || 'auto'} onChange={(e) => set({ manualStatus: e.target.value })}><option value="auto">Automatic (online when active)</option><option value="away">Always show as away</option><option value="dnd">Do not disturb</option></select></label>
      <label className="check"><input type="checkbox" checked={!!user.hideEmail} onChange={(e) => set({ hideEmail: e.target.checked })} /> Hide my email on my profile</label>
      <p className="small muted">Profile data is visible to other signed-in users of this app; hiding your email only hides it in the interface.</p>
    </div>
  );
}

function WorkspaceTab() {
  const { user } = useAuth(); const { wid, workspace, role, members, channels } = useWorkspace(); const { toast } = useApp(); const nav = useNavigate();
  const [name, setName] = useState(workspace.name); const [icon, setIcon] = useState(workspace.icon || '🌊'); const [desc, setDesc] = useState(workspace.description || '');
  const [email, setEmail] = useState(''); const [inviteRole, setInviteRole] = useState('member');
  const { data: invites } = useValue(canManage(role) ? `invitations/byWorkspace/${wid}` : null);
  const manage = canManage(role); const owner = role === 'owner';
  const err = (e) => toast(friendlyError(e), 'error');
  return (
    <div className="stack" style={{ maxWidth: 640 }}>
      <h2>Workspace</h2>
      <div className="small muted">You are {role === 'admin' ? 'an' : 'a'} <b>{role}</b>. Created {workspace.createdAt ? new Date(workspace.createdAt).toLocaleDateString() : ''} · {members.length} members · {channels.length} channels</div>
      {manage ? (
        <>
          <div className="row"><input style={{ width: 70 }} value={icon} onChange={(e) => setIcon(e.target.value)} aria-label="Workspace icon" maxLength={4} /><input value={name} onChange={(e) => setName(e.target.value)} aria-label="Workspace name" maxLength={60} /></div>
          <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Description" aria-label="Workspace description" />
          <div><button className="btn primary" onClick={() => updateWorkspace(wid, { name: name.trim(), icon, description: desc }).then(() => toast('Workspace updated', 'success')).catch(err)}>Save workspace</button></div>
        </>
      ) : <div><b>{workspace.icon} {workspace.name}</b><div className="muted">{workspace.description}</div></div>}

      <div className="sep" /><h3 style={{ margin: 0 }}>Members</h3>
      <MembersList users={members} onRemove={manage ? (u) => (u.role !== 'owner' && u.uid !== user.uid && window.confirm(`Remove ${u.name}?`) ? removeMember(u.uid, wid).catch(err) : null) : null}
        extra={(u) => (owner && u.role !== 'owner' ? <select aria-label={`Role for ${u.name}`} style={{ width: 'auto' }} value={u.role} onChange={(e) => setMemberRole(wid, u.uid, e.target.value).catch(err)}><option value="admin">Admin</option><option value="member">Member</option></select> : null)} />

      {manage && (<>
        <div className="sep" /><h3 style={{ margin: 0 }}>Invitations</h3>
        <div className="row"><input type="email" placeholder="teammate@company.com" aria-label="Invite by email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <select aria-label="Invite role" style={{ width: 'auto' }} value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}><option value="member">Member</option><option value="admin">Admin</option></select>
          <button className="btn primary" disabled={!/\S+@\S+\.\S+/.test(email)} onClick={async () => {
            try {
              const r = await addExistingUserByEmail(wid, workspace, user, email, inviteRole);
              if (r.already) toast('They are already in this workspace');
              else if (r.found) toast('Added to the workspace — they can chat right away', 'success');
              else { await inviteByEmail(wid, workspace, user, email, inviteRole); toast('Not signed up yet. Invitation saved; they join when they sign in with this email.', 'success'); }
              setEmail('');
            } catch (e) { err(e); }
          }}>Add / Invite</button></div>
        <div className="small muted">If the person has already signed in to this app, they are added instantly. Otherwise an invitation is saved for their first sign-in.</div>
        {Object.entries(invites || {}).map(([ek, v]) => <div key={ek} className="row"><span className="grow">{v.email} <span className="muted small">({v.role}, pending)</span></span><button className="btn" onClick={() => revokeInvite(wid, ek).catch(err)}>Revoke</button></div>)}
        <div className="sep" /><h3 style={{ margin: 0 }}>Channels</h3>
        {channels.map((c) => <div className="row" key={c.id}><span className="grow">{c.isPrivate ? '🔒' : '#'} {c.name} <span className="muted small">· {c.members.length} members</span></span><button className="btn" onClick={() => window.confirm(`Delete #${c.name}?`) && deleteChannel(wid, c.id).catch(err)}>Delete</button></div>)}
        <div><button className="btn" onClick={() => ensureDemoData(user, wid).then(() => toast('Demo channels ready', 'success')).catch(err)}>Create starter channels (#general, #announcements, #random)</button></div>
      </>)}

      <div className="sep" />
      {!owner && <div><button className="btn" onClick={() => window.confirm('Leave this workspace?') && leaveWorkspace(user.uid, wid).then(() => nav('/')).catch(err)}>Leave workspace</button></div>}
      {owner && <div><button className="btn danger" onClick={() => window.confirm(`Delete “${workspace.name}” and everything in it? This cannot be undone.`) && deleteWorkspace(user.uid, wid).then(() => nav('/')).catch(err)}>Delete workspace</button></div>}
    </div>
  );
}

function Shortcuts() {
  const rows = [['Ctrl / Cmd + K', 'Open search'], ['Esc', 'Close dialog, menu or drawer'], ['Enter', 'Send message (also Ctrl/Cmd + Enter)'], ['Shift + Enter', 'New line'], ['@', 'Mention a person, @here or @channel'], ['↑ ↓ then Enter', 'Pick a mention or search result']];
  return <div><h2>Keyboard shortcuts</h2><table><tbody>{rows.map(([k, d]) => <tr key={k}><td style={{ padding: '6px 20px 6px 0' }}><kbd>{k}</kbd></td><td>{d}</td></tr>)}</tbody></table></div>;
}
