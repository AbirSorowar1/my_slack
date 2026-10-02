import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useApp } from '../contexts/AppContext';
import { markNotificationRead, clearNotification } from '../services/messages';
import { acceptInvite, declineInvite } from '../services/workspaces';
import { convoPath } from '../utils/nav';
import { relativeTime } from '../utils/helpers';
import { Modal, EmptyState } from './Common';

const LABEL = { mention: 'mentioned you', thread: 'replied to your thread', dm: 'sent you a message', group: 'posted in your group', workspace: 'added you to a workspace' };

export default function NotificationPanel() {
  const { user } = useAuth();
  const { notifications, invites, wid } = useWorkspace();
  const { closeModal, toast } = useApp();
  const nav = useNavigate();
  const open = (n) => {
    markNotificationRead(user.uid, n.id);
    closeModal();
    if (n.wid && !n.cid) nav(`/app/${n.wid}`);
    else if (n.wid && n.cid) nav(convoPath(n.wid, n.cid, user.uid, n.type === 'thread' ? { thread: n.mid } : { msg: n.mid }));
  };
  const markAll = () => notifications.filter((n) => !n.read).forEach((n) => markNotificationRead(user.uid, n.id));
  return (
    <Modal title="Notifications" onClose={closeModal} footer={<><button className="btn" onClick={markAll}>Mark all read</button></>}>
      {invites.map((i) => (
        <div key={i.wid} className="card row" style={{ marginBottom: 8 }}>
          <span style={{ fontSize: 22 }}>{i.workspaceIcon}</span><div className="grow"><b>Invitation to {i.workspaceName}</b><div className="small muted">from {i.invitedByName}</div></div>
          <button className="btn primary" onClick={async () => { try { await acceptInvite(user, i.wid, i); closeModal(); nav(`/app/${i.wid}`); } catch { toast('Could not accept the invitation', 'error'); } }}>Join</button>
          <button className="btn" onClick={() => declineInvite(user, i.wid)}>Decline</button>
        </div>
      ))}
      {!notifications.length && !invites.length && <EmptyState icon="🔔" title="You're all caught up">Mentions, replies and direct messages will appear here.</EmptyState>}
      {notifications.map((n) => (
        <div key={n.id} className="row" style={{ padding: '8px 0', borderBottom: '1px solid var(--line)', opacity: n.read ? 0.6 : 1 }}>
          <button className="grow" style={{ textAlign: 'left' }} onClick={() => open(n)}>
            <b>{n.fromName}</b> {LABEL[n.type] || 'notified you'}<div className="small muted">{n.preview}</div><div className="small muted">{relativeTime(n.createdAt)}</div>
          </button>
          {!n.read && <button className="btn" onClick={() => markNotificationRead(user.uid, n.id)}>Mark read</button>}
          <button className="icon-btn" aria-label="Dismiss" onClick={() => clearNotification(user.uid, n.id)}>✕</button>
        </div>
      ))}
    </Modal>
  );
}
