import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useApp } from '../contexts/AppContext';
import { createChannel } from '../services/channels';
import { createGroup } from '../services/groups';
import { createWorkspace } from '../services/workspaces';
import { friendlyError, relativeTime } from '../utils/helpers';
import { Modal, UserAvatar } from './Common';
import SearchModal from './SearchModal';
import NotificationPanel from './NotificationPanel';

function CreateChannel() {
  const { user } = useAuth(); const { wid } = useWorkspace(); const { closeModal, toast } = useApp(); const nav = useNavigate();
  const [name, setName] = useState(''); const [desc, setDesc] = useState(''); const [priv, setPriv] = useState(false); const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try { const cid = await createChannel(user, wid, { name, description: desc, isPrivate: priv }); closeModal(); nav(`/app/${wid}/channel/${cid}`); }
    catch (e) { toast(friendlyError(e, 'Could not create the channel'), 'error'); setBusy(false); }
  };
  return (
    <Modal title="Create a channel" onClose={closeModal} footer={<><button className="btn" onClick={closeModal}>Cancel</button><button className="btn primary" disabled={!name.trim() || busy} onClick={submit}>Create channel</button></>}>
      <div className="stack">
        <label className="field">Name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="design-reviews" maxLength={40} onKeyDown={(e) => e.key === 'Enter' && name.trim() && submit()} /></label>
        <label className="field">Description (optional)<input value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={200} /></label>
        <label className="check"><input type="checkbox" checked={priv} onChange={(e) => setPriv(e.target.checked)} /> Make private — only members can read it</label>
      </div>
    </Modal>
  );
}

function NewDm() {
  const { user } = useAuth(); const { wid, members } = useWorkspace(); const { closeModal } = useApp(); const nav = useNavigate();
  const [q, setQ] = useState('');
  const list = members.filter((m) => `${m.name} ${m.email}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <Modal title="Direct message" onClose={closeModal}>
      <input placeholder="Search people" aria-label="Search people" value={q} onChange={(e) => setQ(e.target.value)} />
      <div style={{ marginTop: 8 }}>
        {list.map((m) => (
          <button key={m.uid} className="row nav-item" style={{ color: 'var(--ink)' }} onClick={() => { closeModal(); nav(`/app/${wid}/dm/${m.uid}`); }}>
            <UserAvatar user={m} size={30} status={m.status} /><span className="grow"><b>{m.name}{m.uid === user.uid ? ' (you)' : ''}</b><div className="small muted">{m.email}</div></span>
          </button>
        ))}
        {!list.length && <div className="muted">No one matches “{q}”.</div>}
      </div>
    </Modal>
  );
}

function NewGroup() {
  const { user } = useAuth(); const { wid, members } = useWorkspace(); const { closeModal, toast } = useApp(); const nav = useNavigate();
  const [name, setName] = useState(''); const [picked, setPicked] = useState([]);
  const others = members.filter((m) => m.uid !== user.uid);
  const submit = async () => {
    try {
      const names = name.trim() || [user.name, ...others.filter((m) => picked.includes(m.uid)).map((m) => m.name)].map((n) => n.split(' ')[0]).join(', ');
      const gid = await createGroup(user, wid, names, picked); closeModal(); nav(`/app/${wid}/group/${gid}`);
    } catch (e) { toast(friendlyError(e, 'Could not create the group'), 'error'); }
  };
  return (
    <Modal title="New group message" onClose={closeModal} footer={<><button className="btn" onClick={closeModal}>Cancel</button><button className="btn primary" disabled={picked.length < 1} onClick={submit}>Create group</button></>}>
      <label className="field">Group name (optional)<input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} /></label>
      <div className="small muted" style={{ margin: '12px 0 4px' }}>Add people</div>
      {others.map((m) => (
        <label key={m.uid} className="check"><input type="checkbox" checked={picked.includes(m.uid)} onChange={(e) => setPicked((p) => (e.target.checked ? [...p, m.uid] : p.filter((x) => x !== m.uid)))} /> <UserAvatar user={m} size={24} /> {m.name}</label>
      ))}
      {!others.length && <div className="muted">Invite teammates to the workspace first.</div>}
    </Modal>
  );
}

function Switcher() {
  const { user } = useAuth(); const { workspaceList, wid } = useWorkspace(); const { closeModal, toast } = useApp(); const nav = useNavigate();
  const [name, setName] = useState('');
  const create = async () => { try { const r = await createWorkspace(user, { name: name.trim() }); closeModal(); nav(`/app/${r.wid}/channel/${r.cid}`); } catch (e) { toast(friendlyError(e), 'error'); } };
  return (
    <Modal title="Workspaces" onClose={closeModal}>
      {workspaceList.map((w) => (
        <button key={w.id} className="row nav-item" style={{ color: 'var(--ink)', fontWeight: w.id === wid ? 800 : 500 }} onClick={() => { localStorage.setItem('tp.lastWs', w.id); closeModal(); nav(`/app/${w.id}`); }}>
          <span style={{ fontSize: 22 }}>{w.icon}</span><span className="grow">{w.name}</span>{w.id === wid && <span>✓</span>}
        </button>
      ))}
      <div className="sep" />
      <div className="row"><input placeholder="New workspace name" aria-label="New workspace name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} /><button className="btn primary" disabled={!name.trim()} onClick={create}>Create</button></div>
    </Modal>
  );
}

function Profile({ uid }) {
  const { user } = useAuth(); const { membersById, wid } = useWorkspace(); const { closeModal } = useApp(); const nav = useNavigate();
  const u = membersById[uid];
  if (!u) return <Modal title="Profile" onClose={closeModal}>User not found.</Modal>;
  const hidden = u.hideEmail && u.uid !== user.uid;
  return (
    <Modal title="Profile" onClose={closeModal} footer={u.uid !== user.uid ? <button className="btn primary" onClick={() => { closeModal(); nav(`/app/${wid}/dm/${uid}`); }}>Message</button> : <button className="btn primary" onClick={() => { closeModal(); nav(`/app/${wid}/settings`); }}>Edit profile</button>}>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <UserAvatar user={u} size={96} status={u.status} />
        <div className="stack grow" style={{ gap: 4 }}>
          <h2 style={{ margin: 0 }}>{u.name}</h2>
          {u.displayName && u.displayName !== u.name && <div className="muted">@{u.displayName}</div>}
          <div>{u.statusEmoji} {u.statusText}</div>
          <div className="small muted">{u.status === 'offline' ? `Last active ${relativeTime(u.lastActive)}` : u.status === 'dnd' ? 'Do not disturb' : u.status === 'away' ? 'Away' : 'Online'}</div>
        </div>
      </div>
      <div className="sep" />
      <div className="stack">
        {u.bio && <div><div className="small muted">About</div>{u.bio}</div>}
        {!hidden && <div><div className="small muted">Email</div><a href={`mailto:${u.email}`}>{u.email}</a></div>}
        {u.timezone && <div><div className="small muted">Time zone</div>{u.timezone} · local time {new Date().toLocaleTimeString([], { timeZone: u.timezone, hour: 'numeric', minute: '2-digit' })}</div>}
        {u.joinedAt && <div><div className="small muted">Joined</div>{new Date(u.joinedAt).toLocaleDateString()}</div>}
        <div><div className="small muted">Role</div>{u.role}</div>
      </div>
    </Modal>
  );
}

function ImageViewer({ a }) {
  const { closeModal } = useApp();
  return (
    <Modal title={a.name} onClose={closeModal} wide footer={<><a className="btn" href={a.url} target="_blank" rel="noopener noreferrer">Open full size</a><a className="btn primary" href={a.url} download={a.name} target="_blank" rel="noopener noreferrer">Download</a></>}>
      <img src={a.url} alt={a.name} style={{ maxWidth: '100%', maxHeight: '60vh', display: 'block', margin: '0 auto' }} />
    </Modal>
  );
}

export default function ModalHost() {
  const { modal } = useApp();
  if (!modal) return null;
  const { type, props } = modal;
  switch (type) {
    case 'search': return <SearchModal />;
    case 'notifications': return <NotificationPanel />;
    case 'createChannel': return <CreateChannel />;
    case 'newDm': return <NewDm />;
    case 'newGroup': return <NewGroup />;
    case 'switcher': return <Switcher />;
    case 'profile': return <Profile uid={props.uid} />;
    case 'image': return <ImageViewer a={props} />;
    default: return null;
  }
}
