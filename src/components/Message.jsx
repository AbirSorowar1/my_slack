import { memo, useState } from 'react';
import { UserAvatar, EmojiPicker, renderText } from './Common';
import MessageComposer from './MessageComposer';
import { formatTime, formatBytes, fileKind, FILE_ICON, canManage, canEditMessage } from '../utils/helpers';
import { votePoll, toggleReaction, editMessage, deleteMessage, togglePin, toggleSave } from '../services/messages';
import { useApp } from '../contexts/AppContext';

const QUICK = ['👍', '❤️', '😂', '🎉', '🔥'];

function Attachment({ a }) {
  const { openModal } = useApp();
  if (fileKind(a.type, a.name) === 'image') {
    return <img className="att-img" src={a.url} alt={a.name} loading="lazy" onClick={() => openModal('image', a)} />;
  }
  return (
    <div className="att">
      <span style={{ fontSize: 26 }}>{FILE_ICON[fileKind(a.type, a.name)]}</span>
      <div className="grow"><div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</div><div className="small muted">{(a.name.split('.').pop() || 'file').toUpperCase()} · {formatBytes(a.size)}</div></div>
      <a className="btn" href={a.url} target="_blank" rel="noopener noreferrer" download={a.name}>Open</a>
    </div>
  );
}

function PollView({ msg, wid, cid, uid, who }) {
  const { toast } = useApp();
  const opts = msg.poll.options;
  const votes = opts.map((_, i) => Object.keys(msg.votes?.[i] || {}));
  const total = votes.reduce((n, v) => n + v.length, 0);
  const mine = votes.findIndex((v) => v.includes(uid));
  return (
    <div className="card" style={{ marginTop: 6, maxWidth: 440 }} role="group" aria-label={`Poll: ${msg.poll.question}`}>
      <b>📊 {msg.poll.question}</b>
      {opts.map((o, i) => {
        const pct = total ? Math.round((votes[i].length / total) * 100) : 0;
        return (
          <button key={i} className="btn" aria-pressed={mine === i} title={votes[i].length ? who(votes[i]) : 'No votes yet'} onClick={() => votePoll(wid, cid, msg.id, opts.length, i, uid, mine === i).catch(() => toast('Could not vote', 'error'))}
            style={{ display: 'block', width: '100%', marginTop: 6, textAlign: 'left', position: 'relative', overflow: 'hidden', outline: mine === i ? '2px solid var(--accent)' : 'none' }}>
            <span style={{ position: 'absolute', inset: 0, width: `${pct}%`, background: 'var(--mention)', opacity: 0.7 }} />
            <span style={{ position: 'relative', display: 'flex', gap: 8 }}><span className="grow">{o}</span><span>{votes[i].length} · {pct}%</span></span>
          </button>
        );
      })}
      <div className="small muted" style={{ marginTop: 6 }}>{total} {total === 1 ? 'vote' : 'votes'} · click again to remove your vote</div>
    </div>
  );
}

function Message({ msg, wid, cid, pid, user, role, members, membersById, saved, compact, highlight, onThread, inThread }) {
  const { toast } = useApp();
  const [picker, setPicker] = useState(false);
  const [editing, setEditing] = useState(false);
  const mine = msg.senderId === user.uid;
  const sender = membersById[msg.senderId] || { name: msg.senderName, photoURL: msg.senderAvatar };
  const run = (p, err) => p.catch(() => toast(err, 'error'));
  const react = (emoji) => run(toggleReaction(wid, cid, msg.id, emoji, user.uid, !!msg.reactions?.[emoji]?.[user.uid], pid), 'Could not update reaction');
  const reactions = Object.entries(msg.reactions || {}).map(([e, u]) => [e, Object.keys(u)]).filter(([, u]) => u.length);
  const who = (ids) => ids.map((i) => membersById[i]?.name || 'Someone').join(', ');
  const isSaved = !!saved?.[`${cid}_${msg.id}`];

  return (
    <div className={`msg ${highlight ? 'hl' : ''} ${msg.pinned ? 'pinned' : ''}`} data-mid={msg.id} role="article" aria-label={`Message from ${sender.name}`} tabIndex={-1}>
      {compact ? <span style={{ width: 36, flex: 'none' }} /> : <UserAvatar user={sender} status={undefined} />}
      <div className="msg-body">
        {!compact && <div className="msg-head"><b>{sender.displayName || sender.name}</b><span className="small muted">{formatTime(msg.createdAt)}</span>{msg.edited && <span className="small muted">(edited)</span>}{msg.pinned && <span title="Pinned">📌</span>}</div>}
        {editing ? (
          <MessageComposer wid={wid} cid={cid} placeholder="Edit message" members={members}
            edit={{ text: msg.text, onCancel: () => setEditing(false), onSave: (t) => { setEditing(false); run(editMessage(wid, cid, msg.id, t, pid), 'Could not edit message'); } }} />
        ) : msg.text ? <div className="msg-text">{renderText(msg.text, members)}</div> : null}
        {msg.poll && <PollView msg={msg} wid={wid} cid={cid} uid={user.uid} who={who} />}
        {msg.attachments?.map((a) => <Attachment key={a.url} a={a} />)}
        {reactions.length > 0 && (
          <div className="reactions">
            {reactions.map(([e, ids]) => (
              <button key={e} className={`reaction ${ids.includes(user.uid) ? 'mine' : ''}`} title={`${who(ids)} reacted with ${e}`} aria-label={`${e} ${ids.length}, reacted by ${who(ids)}`} onClick={() => react(e)}>{e} {ids.length}</button>
            ))}
          </div>
        )}
        {!inThread && msg.replyCount > 0 && <button className="reply-link" onClick={() => onThread(msg.id)}>{msg.replyCount} {msg.replyCount === 1 ? 'reply' : 'replies'}</button>}
      </div>
      {!editing && (
        <div className="msg-actions" role="toolbar" aria-label="Message actions">
          {QUICK.slice(0, 3).map((e) => <button key={e} className="icon-btn" aria-label={`React ${e}`} onClick={() => react(e)}>{e}</button>)}
          <div style={{ position: 'relative' }}>
            <button className="icon-btn" aria-label="More reactions" onClick={() => setPicker((v) => !v)}>😊</button>
            {picker && <div style={{ position: 'absolute', right: 0, top: 34, zIndex: 10 }}><EmojiPicker onPick={react} onClose={() => setPicker(false)} /></div>}
          </div>
          {!inThread && <button className="icon-btn" aria-label="Reply in thread" title="Reply in thread" onClick={() => onThread(msg.id)}>💬</button>}
          <button className="icon-btn" aria-label="Copy text" title="Copy text" onClick={() => navigator.clipboard?.writeText(msg.text || '').then(() => toast('Copied', 'success'))}>⧉</button>
          {!inThread && <button className="icon-btn" aria-label={msg.pinned ? 'Unpin' : 'Pin'} title={msg.pinned ? 'Unpin' : 'Pin'} onClick={() => run(togglePin(wid, cid, msg, !!msg.pinned), 'Could not pin message')}>📌</button>}
          {!inThread && <button className="icon-btn" aria-label={isSaved ? 'Remove from saved' : 'Save'} title={isSaved ? 'Remove from saved' : 'Save'} onClick={() => run(toggleSave(user.uid, wid, cid, msg, isSaved), 'Could not save message')}>{isSaved ? '🔖' : '🏷️'}</button>}
          {canEditMessage(msg, user.uid) && <button className="icon-btn" aria-label="Edit message" title="Edit" onClick={() => setEditing(true)}>✏️</button>}
          {(mine || canManage(role)) && <button className="icon-btn" aria-label="Delete message" title="Delete" onClick={() => window.confirm('Delete this message?') && run(deleteMessage(wid, cid, msg.id, pid), 'Could not delete message')}>🗑️</button>}
        </div>
      )}
    </div>
  );
}
export default memo(Message);
