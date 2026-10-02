import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useValue } from '../hooks/useDb';
import { togglePin } from '../services/messages';
import { convoPath } from '../utils/nav';
import { EmptyState, Skeleton } from './Common';

export default function PinnedMessages({ cid }) {
  const { wid } = useWorkspace();
  const { user } = useAuth();
  const nav = useNavigate();
  const { data, loading } = useValue(`pinnedMessages/${wid}/${cid}`);
  if (loading) return <Skeleton rows={2} />;
  const items = Object.entries(data || {}).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.pinnedAt - a.pinnedAt);
  if (!items.length) return <EmptyState icon="📌" title="Nothing pinned">Pin important messages from the message toolbar.</EmptyState>;
  return (
    <div className="stack">
      {items.map((p) => (
        <div key={p.id} className="card">
          <div className="small muted">{p.senderName} · {new Date(p.createdAt).toLocaleString()}</div>
          <div style={{ margin: '4px 0', whiteSpace: 'pre-wrap' }}>{p.text}</div>
          <div className="row"><button className="btn" onClick={() => nav(convoPath(wid, cid, user.uid, { msg: p.id }))}>Jump</button>
            <button className="btn" onClick={() => togglePin(wid, cid, { id: p.id, ...p }, true)}>Unpin</button></div>
        </div>
      ))}
    </div>
  );
}
