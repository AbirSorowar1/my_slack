import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useValue } from '../hooks/useDb';
import { remove, ref, db } from '../firebase/database';
import { convoPath } from '../utils/nav';
import { EmptyState, Skeleton } from './Common';

export default function SavedMessages() {
  const { user } = useAuth();
  const { wid, channels } = useWorkspace();
  const nav = useNavigate();
  const { data, loading } = useValue(`savedMessages/${user.uid}/${wid}`);
  const items = Object.entries(data || {}).map(([k, v]) => ({ k, ...v })).sort((a, b) => b.savedAt - a.savedAt);
  return (
    <div className="main" style={{ flex: 1, padding: 20, overflow: 'auto' }}>
      <h2 style={{ marginTop: 0 }}>Saved items</h2>
      {loading ? <Skeleton rows={3} /> : !items.length ? <EmptyState icon="🔖" title="Nothing saved yet">Use the save button on any message to keep it here.</EmptyState> : (
        <div className="stack" style={{ maxWidth: 720 }}>
          {items.map((s) => (
            <div className="card" key={s.k}>
              <div className="small muted">{s.senderName} · {channels.find((c) => c.id === s.cid)?.name ? `#${channels.find((c) => c.id === s.cid).name}` : 'direct message'} · {new Date(s.createdAt).toLocaleString()}</div>
              <div style={{ whiteSpace: 'pre-wrap', margin: '6px 0' }}>{s.text}</div>
              <div className="row"><button className="btn" onClick={() => nav(convoPath(wid, s.cid, user.uid, { msg: s.mid }))}>Go to message</button>
                <button className="btn" onClick={() => remove(ref(db, `savedMessages/${user.uid}/${wid}/${s.k}`))}>Remove</button></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
