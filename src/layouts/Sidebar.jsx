import { NavLink, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useApp } from '../contexts/AppContext';
import { StatusDot } from '../components/Common';
import { dmId } from '../utils/helpers';

const Item = ({ to, children, unread, muted, end }) => (
  <NavLink to={to} end={end} onClick={() => {}} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''} ${unread ? 'unread' : ''} ${muted ? 'muted-ch' : ''}`}>
    {children}{unread > 0 && <span className="badge" aria-label={`${unread} unread`}>{unread > 99 ? '99+' : unread}</span>}
  </NavLink>
);

export default function Sidebar({ open }) {
  const { wid, workspace, channels, dms, groups } = useWorkspace();
  const { user } = useAuth();
  const { openModal, setDrawer } = useApp();
  const nav = useNavigate();
  const starred = channels.filter((c) => c.starred && c.joined);
  const joined = channels.filter((c) => c.joined && !c.starred);
  const others = channels.filter((c) => !c.joined);
  const close = () => setDrawer(false);
  const sideLabel = (c) => <><span style={{ opacity: 0.7 }}>{c.isPrivate ? '🔒' : '#'}</span><span className="grow" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</span></>;
  return (
    <nav className={`sidebar ${open ? 'open' : ''}`} aria-label="Workspace navigation" onClick={(e) => e.target.closest('a') && close()}>
      <button className="ws-btn" onClick={() => openModal('switcher')} aria-label="Switch workspace">
        <span className="ws-icon">{workspace?.icon || '🌊'}</span><span className="grow" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{workspace?.name}</span><span>▾</span>
      </button>
      <div style={{ marginTop: 8 }}>
        <Item to={`/app/${wid}/saved`}>🔖 Saved items</Item>
        <Item to={`/app/${wid}/files`}>📁 Files</Item>
      </div>
      {starred.length > 0 && <><h3>Starred</h3>{starred.map((c) => <Item key={c.id} to={`/app/${wid}/channel/${c.id}`} unread={c.unread} muted={c.muted}>{sideLabel(c)}</Item>)}</>}
      <h3>Channels <button aria-label="Create channel" onClick={() => openModal('createChannel')}>＋</button></h3>
      {joined.map((c) => <Item key={c.id} to={`/app/${wid}/channel/${c.id}`} unread={c.unread} muted={c.muted}>{sideLabel(c)}</Item>)}
      {others.length > 0 && <div className="small" style={{ margin: '8px 10px 2px', color: '#8db3ad' }}>Browse more</div>}
      {others.map((c) => <Item key={c.id} to={`/app/${wid}/channel/${c.id}`} muted>{sideLabel(c)}</Item>)}
      {!channels.length && <div className="small" style={{ padding: '4px 10px', color: '#8db3ad' }}>No channels yet.</div>}
      <h3>Groups <button aria-label="New group message" onClick={() => openModal('newGroup')}>＋</button></h3>
      {groups.map((g) => <Item key={g.id} to={`/app/${wid}/group/${g.id}`} unread={g.unread}><span>👥</span><span className="grow" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.name}</span></Item>)}
      <h3>Direct messages <button aria-label="New direct message" onClick={() => openModal('newDm')}>＋</button></h3>
      <Item to={`/app/${wid}/dm/${user.uid}`} unread={0}><StatusDot status="online" /><span className="grow">{user.name} (you)</span></Item>
      {dms.map((m) => <Item key={m.uid} to={`/app/${wid}/dm/${m.uid}`} unread={m.unread}><StatusDot status={m.status} /><span className="grow" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</span></Item>)}
      <div style={{ flex: 1 }} />
      <button className="nav-item" onClick={() => nav(`/app/${wid}/settings`)}>⚙️ Settings</button>
    </nav>
  );
}
