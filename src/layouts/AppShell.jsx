import { Navigate, Route, Routes, useParams, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useApp } from '../contexts/AppContext';
import { useOnline, useKey } from '../hooks/useDb';
import { dmId } from '../utils/helpers';
import Sidebar from './Sidebar';
import ChatView from '../components/ChatView';
import SavedMessages from '../components/SavedMessages';
import FileBrowser from '../components/FileBrowser';
import ModalHost from '../components/Modals';
import SettingsPage from '../pages/SettingsPage';
import UserMenu from '../components/UserMenu';
import { Skeleton, EmptyState } from '../components/Common';

function ChannelRoute() {
  const { cid } = useParams();
  const { channels } = useWorkspace();
  const c = channels.find((x) => x.id === cid);
  if (!c) return <div className="main" style={{ flex: 1 }}><EmptyState icon="🔍" title="Channel not found">It may have been deleted, or it's private and you're not a member.</EmptyState></div>;
  return <ChatView key={cid} convo={{ id: c.id, kind: 'channel', title: c.name, description: c.description, channel: c, joined: c.joined, memberIds: c.members }} />;
}
function DmRoute() {
  const { uid } = useParams();
  const { user } = useAuth();
  const { membersById } = useWorkspace();
  const other = membersById[uid];
  if (!other) return <div className="main" style={{ flex: 1 }}><EmptyState icon="👤" title="Person not found">They aren't a member of this workspace.</EmptyState></div>;
  const id = dmId(user.uid, uid);
  return <ChatView key={id} convo={{ id, kind: 'dm', title: uid === user.uid ? `${other.name} (you)` : other.name, description: `${other.statusEmoji || ''} ${other.statusText || ''}`.trim(), joined: true, memberIds: [user.uid, uid] }} />;
}
function GroupRoute() {
  const { gid } = useParams();
  const { groups } = useWorkspace();
  const g = groups.find((x) => x.id === gid);
  if (!g) return <div className="main" style={{ flex: 1 }}><Skeleton /></div>;
  return <ChatView key={gid} convo={{ id: gid, kind: 'group', title: g.name, joined: true, memberIds: g.members }} />;
}
function Home() {
  const { wid, channels, loading } = useWorkspace();
  if (loading) return <div className="main" style={{ flex: 1 }}><Skeleton /></div>;
  const first = channels.find((c) => c.name === 'general' && c.joined) || channels.find((c) => c.joined) || channels[0];
  return first ? <Navigate to={`/app/${wid}/channel/${first.id}`} replace /> : (
    <div className="main" style={{ flex: 1 }}><EmptyState icon="🌊" title="No channels yet">Create your first channel from the sidebar.</EmptyState></div>
  );
}

export default function AppShell() {
  const ws = useWorkspace();
  const { drawer, setDrawer, openModal, closeModal, modal } = useApp();
  const { online, connected } = useOnline();
  const [showOk, setShowOk] = useState(false);
  const down = !online || !connected;

  useEffect(() => { if (ws.wid) localStorage.setItem('tp.lastWs', ws.wid); }, [ws.wid]);
  useEffect(() => { if (!down) return undefined; setShowOk(true); return undefined; }, [down]);
  useEffect(() => { if (down || !showOk) return undefined; const t = setTimeout(() => setShowOk(false), 2500); return () => clearTimeout(t); }, [down, showOk]);

  const totalUnread = ws.channels.reduce((n, c) => n + (c.unread || 0), 0) + ws.groups.reduce((n, g) => n + (g.unread || 0), 0) + ws.dms.reduce((n, d) => n + (d.unread || 0), 0);
  useEffect(() => { document.title = totalUnread ? `(${totalUnread}) Tidepool` : 'Tidepool'; return () => { document.title = 'Tidepool'; }; }, [totalUnread]);

  useKey((e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openModal('search'); }
    else if (e.key === 'Escape') { if (modal) closeModal(); else setDrawer(false); }
  });

  if (ws.loading) return <div className="shell"><div className="topbar" /><div className="sidebar" /><div className="main"><Skeleton /></div></div>;
  if (!ws.workspace || !ws.role) {
    return <div style={{ height: '100%', display: 'grid', placeItems: 'center' }}><EmptyState icon="🚫" title="Workspace unavailable">It was deleted or you're no longer a member. <Link to="/">Choose another workspace</Link></EmptyState></div>;
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {down && <div className="banner" role="status">{online ? 'Reconnecting…' : "You're offline"}</div>}
      {!down && showOk && <div className="banner ok" role="status">Connected</div>}
      <div className="shell" style={{ flex: 1, minHeight: 0 }}>
        <header className="topbar">
          <button className="icon-btn hamb" aria-label="Open sidebar" onClick={() => setDrawer(!drawer)}>☰</button>
          <button className="search" onClick={() => openModal('search')} aria-label="Search (Ctrl+K)">🔍 Search messages, people and channels… <span className="kbd small" style={{ float: 'right', opacity: 0.7 }}>Ctrl K</span></button>
          <button className="icon-btn" aria-label={`Notifications, ${ws.unreadNotifications} unread`} onClick={() => openModal('notifications')} style={{ position: 'relative', width: 'auto', padding: '0 8px' }}>
            🔔{(ws.unreadNotifications + ws.invites.length) > 0 && <span className="badge" style={{ marginLeft: 4 }}>{ws.unreadNotifications + ws.invites.length}</span>}
          </button>
          <UserMenu />
        </header>
        <Sidebar open={drawer} />
        <div style={{ display: 'flex', minWidth: 0, minHeight: 0, gridColumn: 'span 2' }}>
          <Routes>
            <Route index element={<Home />} />
            <Route path="channel/:cid" element={<ChannelRoute />} />
            <Route path="dm/:uid" element={<DmRoute />} />
            <Route path="group/:gid" element={<GroupRoute />} />
            <Route path="saved" element={<SavedMessages />} />
            <Route path="files" element={<FileBrowser />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="" replace />} />
          </Routes>
        </div>
      </div>
      <ModalHost />
    </div>
  );
}
