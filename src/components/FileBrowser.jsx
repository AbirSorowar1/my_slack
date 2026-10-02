import { useMemo, useState } from 'react';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useMessageList } from '../hooks/useDb';
import { formatBytes, fileKind, FILE_ICON } from '../utils/helpers';
import { Skeleton, EmptyState } from './Common';
import { useApp } from '../contexts/AppContext';

export default function FileBrowser({ cid = null, compact = false }) {
  const { wid, membersById, channels } = useWorkspace();
  const { openModal } = useApp();
  const { list, loading } = useMessageList(`files/${wid}`, 300);
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('all');
  const [sort, setSort] = useState('new');

  const files = useMemo(() => {
    let l = list.filter((f) => (!cid || f.cid === cid) && (kind === 'all' || fileKind(f.type, f.name) === kind) && f.name.toLowerCase().includes(q.toLowerCase()));
    l = [...l].sort((a, b) => (sort === 'name' ? a.name.localeCompare(b.name) : sort === 'size' ? b.size - a.size : b.createdAt - a.createdAt));
    return l;
  }, [list, cid, q, kind, sort]);

  return (
    <div className={compact ? '' : 'main'} style={compact ? undefined : { flex: 1, padding: 20, overflow: 'auto' }}>
      {!compact && <h2 style={{ marginTop: 0 }}>Files</h2>}
      <div className="row" style={{ flexWrap: 'wrap', marginBottom: 12 }}>
        <input style={{ flex: 2, minWidth: 140 }} placeholder="Search files" aria-label="Search files" value={q} onChange={(e) => setQ(e.target.value)} />
        <select aria-label="File type" value={kind} onChange={(e) => setKind(e.target.value)} style={{ flex: 1 }}>
          <option value="all">All types</option><option value="image">Images</option><option value="pdf">PDF</option><option value="doc">Documents</option><option value="sheet">Spreadsheets</option><option value="archive">Archives</option><option value="other">Other</option>
        </select>
        <select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value)} style={{ flex: 1 }}><option value="new">Newest</option><option value="name">Name</option><option value="size">Size</option></select>
      </div>
      {loading ? <Skeleton rows={3} /> : files.length === 0 ? <EmptyState icon="📁" title="No files">Files shared in conversations show up here.</EmptyState> : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {files.map((f) => {
            const k = fileKind(f.type, f.name);
            const chName = channels.find((c) => c.id === f.cid)?.name;
            return (
              <li key={f.id} className="att" style={{ maxWidth: 'none' }}>
                {k === 'image' ? <img src={f.url} alt="" width={44} height={44} loading="lazy" style={{ objectFit: 'cover', borderRadius: 6, cursor: 'zoom-in' }} onClick={() => openModal('image', f)} /> : <span style={{ fontSize: 28 }}>{FILE_ICON[k]}</span>}
                <div className="grow"><b style={{ overflowWrap: 'anywhere' }}>{f.name}</b>
                  <div className="small muted">{formatBytes(f.size)} · {membersById[f.senderId]?.name || f.senderName} · {new Date(f.createdAt).toLocaleDateString()}{chName && ` · #${chName}`}</div></div>
                <a className="btn" href={f.url} target="_blank" rel="noopener noreferrer" download={f.name}>Open</a>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
