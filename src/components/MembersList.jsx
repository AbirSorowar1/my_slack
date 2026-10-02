import { useApp } from '../contexts/AppContext';
import { UserAvatar } from './Common';

export default function MembersList({ users, onRemove, extra }) {
  const { openModal } = useApp();
  if (!users.length) return <div className="muted">No members.</div>;
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }} aria-label="Members">
      {users.map((u) => (
        <li key={u.uid} className="row" style={{ padding: '6px 0' }}>
          <button className="row grow" style={{ textAlign: 'left' }} onClick={() => openModal('profile', { uid: u.uid })}>
            <UserAvatar user={u} size={32} status={u.status} />
            <span className="grow"><b>{u.name}</b>{u.role && <span className="small muted"> · {u.role}</span>}<div className="small muted">{u.statusEmoji} {u.statusText || u.email}</div></span>
          </button>
          {extra?.(u)}
          {onRemove && <button className="btn" onClick={() => onRemove(u)} aria-label={`Remove ${u.name}`}>Remove</button>}
        </li>
      ))}
    </ul>
  );
}
