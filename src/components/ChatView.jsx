import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useApp } from '../contexts/AppContext';
import { useMessageList, useValue } from '../hooks/useDb';
import { markRead, joinChannel, setChannelPref } from '../services/channels';
import { formatDay } from '../utils/helpers';
import Message from './Message';
import MessageComposer from './MessageComposer';
import ThreadPanel from './ThreadPanel';
import ChannelInfo from './ChannelInfo';
import { Skeleton, EmptyState } from './Common';

function TypingIndicator({ wid, cid, uid }) {
  const { data } = useValue(`typing/${wid}/${cid}`);
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 2000); return () => clearInterval(t); }, []);
  const names = Object.entries(data || {}).filter(([u, v]) => u !== uid && Date.now() - v.at < 6000).map(([, v]) => v.name);
  let text = '';
  if (names.length === 1) text = `${names[0]} is typing…`;
  else if (names.length === 2) text = `${names[0]} and ${names[1]} are typing…`;
  else if (names.length > 2) text = 'Several people are typing…';
  return <div className="typing" aria-live="polite">{text}</div>;
}

/** convo: { id, kind: 'channel'|'dm'|'group', title, description?, channel?, joined, memberIds } */
export default function ChatView({ convo }) {
  const { user } = useAuth();
  const { wid, role, members, membersById, unreadOf } = useWorkspace();
  const unreadAtOpen = useRef(null);
  const { setDrawer } = useApp();
  const [sp, setSp] = useSearchParams();
  const [limit, setLimit] = useState(50);
  const { list, loading, error, hasMore } = useMessageList(`messages/${wid}/${convo.id}`, limit);
  const { data: savedMap } = useValue(`savedMessages/${user.uid}/${wid}`);
  const box = useRef(null);
  const atBottom = useRef(true);
  const prevHeight = useRef(0);
  const threadId = sp.get('thread');
  const panel = sp.get('panel');
  const target = sp.get('msg');

  useEffect(() => { setLimit(target ? 500 : 50); atBottom.current = true; }, [convo.id]); // eslint-disable-line

  useLayoutEffect(() => {
    const el = box.current; if (!el) return;
    if (prevHeight.current) { el.scrollTop += el.scrollHeight - prevHeight.current; prevHeight.current = 0; }
    else if (atBottom.current) el.scrollTop = el.scrollHeight;
  }, [list.length, loading, convo.id]);

  useEffect(() => {
    if (!target || loading) return;
    const el = box.current?.querySelector(`[data-mid="${target}"]`);
    if (el) el.scrollIntoView({ block: 'center' });
  }, [target, loading, list.length]);

  useEffect(() => { if (!loading && unreadAtOpen.current === null) unreadAtOpen.current = unreadOf(convo.id); }, [loading]); // eslint-disable-line

  useEffect(() => {
    if (!convo.joined || loading) return;
    const go = () => { if (!document.hidden) markRead(user.uid, wid, convo.id).catch(() => {}); };
    go(); document.addEventListener('visibilitychange', go);
    return () => document.removeEventListener('visibilitychange', go);
  }, [convo.id, convo.joined, list.length, loading, user.uid, wid]);

  const setParam = (k, v) => { const n = new URLSearchParams(sp); if (v) n.set(k, v); else n.delete(k); if (k === 'thread' && v) n.delete('panel'); if (k === 'panel' && v) n.delete('thread'); setSp(n, { replace: true }); };
  const onThread = (id) => setParam('thread', id);
  const threadMsg = threadId ? list.find((m) => m.id === threadId) : null;

  const rows = useMemo(() => {
    const out = []; let lastDay = ''; let prev = null;
    const newFrom = unreadAtOpen.current > 0 ? list.length - unreadAtOpen.current : -1;
    list.forEach((m, idx) => {
      if (idx === newFrom) out.push({ type: 'new', key: 'new' });
      const day = m.createdAt ? new Date(m.createdAt).toDateString() : lastDay || new Date().toDateString();
      if (day !== lastDay) { out.push({ type: 'day', key: `d${day}`, label: formatDay(m.createdAt || Date.now()) }); lastDay = day; prev = null; }
      const compact = prev && prev.senderId === m.senderId && m.createdAt - prev.createdAt < 300000 && !prev.attachments;
      out.push({ type: 'msg', key: m.id, m, compact }); prev = m;
    });
    return out;
  }, [list]);

  const canPost = convo.joined;
  const starred = convo.channel?.starred; const muted = convo.channel?.muted;
  const wsStar = (k, v) => setChannelPref(user.uid, wid, convo.id, k, v);

  return (
    <>
      <section className="main" aria-label={convo.title} style={{ flex: 1 }}>
        <div className="chat-header">
          <button className="icon-btn hamb" aria-label="Open sidebar" onClick={() => setDrawer(true)}>☰</button>
          <div className="grow">
            <h2>{convo.kind === 'channel' ? (convo.channel?.isPrivate ? '🔒 ' : '# ') : ''}{convo.title}</h2>
            {convo.description && <div className="small muted" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{convo.description}</div>}
          </div>
          {convo.kind === 'channel' && convo.joined && <>
            <button className="icon-btn" aria-label={starred ? 'Unstar channel' : 'Star channel'} aria-pressed={!!starred} onClick={() => wsStar('starred', !starred)}>{starred ? '★' : '☆'}</button>
            <button className="icon-btn" aria-label={muted ? 'Unmute channel' : 'Mute channel'} aria-pressed={!!muted} onClick={() => wsStar('muted', !muted)}>{muted ? '🔕' : '🔔'}</button>
          </>}
          <button className="icon-btn" aria-label="Pinned messages" onClick={() => setParam('panel', panel === 'pins' ? null : 'pins')}>📌</button>
          <button className="icon-btn" aria-label="Details" onClick={() => setParam('panel', panel === 'info' ? null : 'info')}>ⓘ</button>
        </div>

        <div className="messages" ref={box} onScroll={(e) => { const el = e.currentTarget; atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; }}>
          {error ? <EmptyState icon="⚠️" title="Unable to load messages">You may not have access to this conversation, or the connection dropped.</EmptyState>
            : loading ? <Skeleton />
            : (
              <>
                {hasMore && <div style={{ textAlign: 'center', padding: 8 }}><button className="btn" onClick={() => { prevHeight.current = box.current.scrollHeight; atBottom.current = false; setLimit((l) => l + 50); }}>Load older messages</button></div>}
                {rows.length === 0 && <EmptyState icon="💬" title={convo.kind === 'channel' ? `This is the start of #${convo.title}` : 'No messages yet'}>Say hello — messages appear for everyone instantly.</EmptyState>}
                {rows.map((r) => r.type === 'day'
                  ? <div key={r.key} className="day-sep">{r.label}</div>
                  : r.type === 'new' ? <div key={r.key} className="day-sep new-sep" role="separator">New messages</div>
                  : <Message key={r.key} msg={r.m} compact={r.compact} wid={wid} cid={convo.id} user={user} role={role} members={members} membersById={membersById}
                      saved={savedMap} highlight={target === r.m.id} onThread={onThread} />)}
              </>
            )}
        </div>
        <TypingIndicator wid={wid} cid={convo.id} uid={user.uid} />
        {canPost
          ? <MessageComposer wid={wid} cid={convo.id} members={convo.kind === 'channel' ? members.filter((m) => convo.channel?.members?.includes(m.uid)) : members} allowGroupMention={convo.kind !== 'dm'}
              placeholder={`Message ${convo.kind === 'channel' ? '#' : ''}${convo.title}`} onSent={() => { atBottom.current = true; }} />
          : <div className="composer" style={{ padding: 14 }}><div className="row"><span className="grow muted">You're previewing #{convo.title}.</span><button className="btn primary" onClick={() => joinChannel(user.uid, wid, convo.id)}>Join channel</button></div></div>}
      </section>

      {threadId && <ThreadPanel parent={threadMsg} parentId={threadId} wid={wid} cid={convo.id} onClose={() => setParam('thread', null)} canPost={canPost} />}
      {!threadId && (panel === 'info' || panel === 'pins') && <ChannelInfo convo={convo} initialTab={panel === 'pins' ? 'pins' : 'about'} onClose={() => setParam('panel', null)} />}
    </>
  );
}
