import { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useMessageList } from '../hooks/useDb';
import Message from './Message';
import MessageComposer from './MessageComposer';
import { Skeleton } from './Common';

export default function ThreadPanel({ parent, parentId, wid, cid, onClose, canPost }) {
  const { user } = useAuth();
  const { role, members, membersById } = useWorkspace();
  const { list, loading } = useMessageList(`threads/${wid}/${cid}/${parentId}`, 200);
  const end = useRef(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [list.length]);
  const common = { wid, cid, user, role, members, membersById, inThread: true };
  return (
    <aside className="panel" aria-label="Thread">
      <div className="panel-head"><span className="grow">Thread</span><button className="icon-btn" aria-label="Close thread" onClick={onClose}>✕</button></div>
      <div className="panel-body" style={{ padding: 0 }}>
        {parent ? <Message msg={parent} {...common} pid={undefined} /> : <div className="muted" style={{ padding: 16 }}>Original message unavailable.</div>}
        <div className="day-sep">{parent?.replyCount || list.length} replies</div>
        {loading ? <Skeleton rows={2} /> : list.map((m) => <Message key={m.id} msg={m} pid={parentId} {...common} />)}
        <div ref={end} />
      </div>
      {canPost && parent && (
        <div style={{ paddingTop: 8 }}>
          <MessageComposer key={parent.id} wid={wid} cid={cid} threadParent={parent} members={members} placeholder="Reply in thread" />
        </div>
      )}
    </aside>
  );
}
