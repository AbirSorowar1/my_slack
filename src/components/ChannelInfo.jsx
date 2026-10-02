import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useApp } from '../contexts/AppContext';
import { updateChannel, deleteChannel, leaveChannel, joinChannel, addChannelMember, removeChannelMember } from '../services/channels';
import { renameGroup, addGroupMember, removeGroupMember } from '../services/groups';
import { canManage, friendlyError } from '../utils/helpers';
import MembersList from './MembersList';
import PinnedMessages from './PinnedMessages';
import FileBrowser from './FileBrowser';

export default function ChannelInfo({ convo, initialTab = 'about', onClose }) {
  const { user } = useAuth();
  const { wid, role, members, membersById } = useWorkspace();
  const { toast } = useApp();
  const nav = useNavigate();
  const [tab, setTab] = useState(initialTab);
  const [addId, setAddId] = useState('');
  const ch = convo.channel;
  const isChannel = convo.kind === 'channel';
  const isGroup = convo.kind === 'group';
  const manage = isChannel ? canManage(role) || ch?.createdBy === user.uid : isGroup;
  const ids = convo.memberIds || [];
  const err = (e) => toast(friendlyError(e), 'error');

  const edit = async (field, label) => {
    const v = window.prompt(label, field === 'name' ? convo.title : ch?.description || '');
    if (v == null || (field === 'name' && !v.trim())) return;
    try {
      if (isChannel) await updateChannel(wid, convo.id, { [field]: field === 'name' ? v.trim().toLowerCase().replace(/\s+/g, '-') : v });
      else await renameGroup(wid, convo.id, v.trim());
    } catch (e) { err(e); }
  };
  const addMember = async () => {
    if (!addId) return;
    try { await (isChannel ? addChannelMember(addId, wid, convo.id) : addGroupMember(wid, convo.id, addId)); setAddId(''); } catch (e) { err(e); }
  };
  const nonMembers = members.filter((m) => !ids.includes(m.uid));

  return (
    <aside className="panel" aria-label="Details">
      <div className="panel-head"><span className="grow">{convo.kind === 'dm' ? 'Conversation' : isGroup ? 'Group' : `#${convo.title}`}</span><button className="icon-btn" aria-label="Close details" onClick={onClose}>✕</button></div>
      <div className="panel-body">
        <div className="tabs" role="tablist">
          {[['about', 'About'], ['members', `Members ${ids.length}`], ['files', 'Files'], ['pins', 'Pins']].map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
        </div>
        {tab === 'about' && (
          <div className="stack">
            <div><div className="small muted">Name</div><div className="row"><b className="grow">{isChannel ? `# ${convo.title}` : convo.title}</b>{manage && convo.kind !== 'dm' && <button className="btn" onClick={() => edit('name', 'Rename')}>Rename</button>}</div></div>
            {isChannel && <div><div className="small muted">Description</div><div className="row"><span className="grow">{ch?.description || 'No description yet.'}</span>{manage && <button className="btn" onClick={() => edit('description', 'Channel description')}>Edit</button>}</div></div>}
            {ch?.createdAt && <div><div className="small muted">Created</div>{new Date(ch.createdAt).toLocaleDateString()}</div>}
            {isChannel && <div><div className="small muted">Visibility</div><div className="row"><span className="grow">{ch?.isPrivate ? '🔒 Private — only members can read' : '# Public — anyone in the workspace can read'}</span>{manage && <button className="btn" onClick={() => updateChannel(wid, convo.id, { isPrivate: !ch.isPrivate }).catch(err)}>Make {ch?.isPrivate ? 'public' : 'private'}</button>}</div></div>}
            <div className="sep" />
            {isChannel && (convo.joined ? <button className="btn" onClick={() => leaveChannel(user.uid, wid, convo.id).then(() => nav(`/app/${wid}`)).catch(err)}>Leave channel</button> : <button className="btn primary" onClick={() => joinChannel(user.uid, wid, convo.id).catch(err)}>Join channel</button>)}
            {isGroup && <button className="btn" onClick={() => removeGroupMember(wid, convo.id, user.uid).then(() => nav(`/app/${wid}`)).catch(err)}>Leave group</button>}
            {isChannel && manage && <button className="btn danger" onClick={() => window.confirm(`Delete #${convo.title} and all its messages?`) && deleteChannel(wid, convo.id).then(() => nav(`/app/${wid}`)).catch(err)}>Delete channel</button>}
          </div>
        )}
        {tab === 'members' && (
          <>
            {manage && convo.kind !== 'dm' && nonMembers.length > 0 && (
              <div className="row" style={{ marginBottom: 12 }}>
                <select value={addId} onChange={(e) => setAddId(e.target.value)} aria-label="Add a member"><option value="">Add a member…</option>{nonMembers.map((m) => <option key={m.uid} value={m.uid}>{m.name}</option>)}</select>
                <button className="btn primary" onClick={addMember} disabled={!addId}>Add</button>
              </div>
            )}
            <MembersList users={ids.map((i) => membersById[i]).filter(Boolean)}
              onRemove={manage && convo.kind !== 'dm' ? (u) => (isChannel ? removeChannelMember(u.uid, wid, convo.id) : removeGroupMember(wid, convo.id, u.uid)).catch(err) : null} />
          </>
        )}
        {tab === 'files' && <FileBrowser cid={convo.id} compact />}
        {tab === 'pins' && <PinnedMessages cid={convo.id} />}
      </div>
    </aside>
  );
}
