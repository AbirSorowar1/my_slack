import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useApp } from '../contexts/AppContext';
import { db, ref, get, query, orderByChild, limitToLast } from '../firebase/database';
import { useDebounced } from '../hooks/useDb';
import { toList, dmId, formatTime } from '../utils/helpers';
import { convoPath } from '../utils/nav';
import { Modal, UserAvatar } from './Common';

export default function SearchModal() {
  const { user } = useAuth();
  const { wid, channels, members, groups, membersById } = useWorkspace();
  const { closeModal } = useApp();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const dq = useDebounced(q, 150).trim().toLowerCase();
  const [corpus, setCorpus] = useState({ msgs: [], files: [], loading: true });
  const [sel, setSel] = useState(0);

  // Load the most recent messages of every conversation you can see once, then search locally.
  useEffect(() => {
    let live = true;
    (async () => {
      const ids = [...channels.filter((c) => c.joined).map((c) => c.id), ...members.map((m) => dmId(user.uid, m.uid)), ...groups.map((g) => g.id)];
      const msgs = [];
      await Promise.all(ids.map(async (cid) => {
        try {
          const s = await get(query(ref(db, `messages/${wid}/${cid}`), orderByChild('createdAt'), limitToLast(200)));
          toList(s).forEach((m) => msgs.push({ ...m, cid }));
        } catch { /* no access / empty */ }
      }));
      let files = [];
      try { files = toList(await get(query(ref(db, `files/${wid}`), orderByChild('createdAt'), limitToLast(300)))); } catch { /* ignore */ }
      if (live) setCorpus({ msgs, files, loading: false });
    })();
    return () => { live = false; };
  }, []); // eslint-disable-line

  const nameOfConvo = (cid) => channels.find((c) => c.id === cid)?.name ? `#${channels.find((c) => c.id === cid).name}` : groups.find((g) => g.id === cid)?.name || 'Direct message';

  const results = useMemo(() => {
    if (!dq) return [];
    const out = [];
    channels.filter((c) => c.name.includes(dq) || (c.description || '').toLowerCase().includes(dq)).slice(0, 5).forEach((c) => out.push({ t: 'Channels', key: `c${c.id}`, title: `# ${c.name}`, sub: c.description, go: () => nav(convoPath(wid, c.id, user.uid)) }));
    members.filter((m) => `${m.name} ${m.email}`.toLowerCase().includes(dq)).slice(0, 5).forEach((m) => out.push({ t: 'People', key: `u${m.uid}`, title: m.name, sub: m.email, user: m, go: () => nav(`/app/${wid}/dm/${m.uid}`) }));
    corpus.msgs.filter((m) => (m.text || '').toLowerCase().includes(dq)).sort((a, b) => b.createdAt - a.createdAt).slice(0, 15).forEach((m) => out.push({
      t: 'Messages', key: `m${m.id}`, title: `${membersById[m.senderId]?.name || m.senderName} in ${nameOfConvo(m.cid)} · ${new Date(m.createdAt).toLocaleDateString()} ${formatTime(m.createdAt)}`, sub: m.text, go: () => nav(convoPath(wid, m.cid, user.uid, { msg: m.id })),
    }));
    corpus.files.filter((f) => f.name.toLowerCase().includes(dq)).slice(0, 6).forEach((f) => out.push({ t: 'Files', key: `f${f.id}`, title: `📎 ${f.name}`, sub: `${f.senderName} · ${new Date(f.createdAt).toLocaleDateString()}`, go: () => window.open(f.url, '_blank', 'noopener') }));
    return out;
  }, [dq, corpus, channels, members, groups]); // eslint-disable-line

  useEffect(() => setSel(0), [dq]);
  const pick = (r) => { closeModal(); r.go(); };
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(results.length - 1, s + 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
    if (e.key === 'Enter' && results[sel]) pick(results[sel]);
  };
  let lastType = '';
  return (
    <Modal title="Search" onClose={closeModal} wide>
      <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} placeholder="🔍 Search messages, people and channels…" aria-label="Search" autoFocus />
      <div style={{ marginTop: 10, minHeight: 120 }} role="listbox" aria-label="Search results">
        {corpus.loading && dq && <div className="muted small">Indexing recent messages…</div>}
        {!dq && <div className="muted small">Type to search. Messages searched: the latest 200 per conversation.</div>}
        {dq && !results.length && !corpus.loading && <div className="muted">No results for “{q}”.</div>}
        {results.map((r, i) => {
          const header = r.t !== lastType ? <div key={`h${r.t}`} className="small muted" style={{ fontWeight: 800, margin: '10px 0 4px' }}>{r.t}</div> : null; lastType = r.t;
          return (
            <div key={r.key}>{header}
              <button role="option" aria-selected={i === sel} className={`nav-item ${i === sel ? '' : ''}`} style={{ color: 'var(--ink)', background: i === sel ? 'var(--surface-2)' : 'transparent', alignItems: 'flex-start' }} onClick={() => pick(r)} onMouseEnter={() => setSel(i)}>
                {r.user && <UserAvatar user={r.user} size={26} />}
                <span className="grow"><b>{r.title}</b>{r.sub && <div className="small muted" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{r.sub.slice(0, 160)}</div>}</span>
              </button>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
