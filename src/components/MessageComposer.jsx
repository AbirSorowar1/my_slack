import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { sendMessage, setTyping, registerFile } from '../services/messages';
import { uploadToStorage } from '../firebase/storage';
import { compressImage } from '../utils/image';
import { handleOf, formatBytes, fileKind, FILE_ICON, friendlyError } from '../utils/helpers';
import { EmojiPicker, UserAvatar } from './Common';

const MAX_BYTES = 25 * 1024 * 1024;

function MessageComposer({ wid, cid, placeholder, threadParent = null, edit = null, members = [], allowGroupMention = true, onSent }) {
  const { user } = useAuth();
  const { toast } = useApp();
  const draftKey = edit ? null : `tp.draft.${wid}.${cid}.${threadParent?.id || ''}`;
  const [value, setValue] = useState(() => { if (edit) return edit.text; try { return localStorage.getItem(draftKey) || ''; } catch { return ''; } });
  useEffect(() => { if (!draftKey) return; try { if (value) localStorage.setItem(draftKey, value); else localStorage.removeItem(draftKey); } catch { /* storage unavailable */ } }, [value, draftKey]);
  const [pending, setPending] = useState([]); // {id,name,size,type,progress,url,path,error,preview}
  const [emoji, setEmoji] = useState(false);
  const [mention, setMention] = useState(null); // {query, start}
  const [sel, setSel] = useState(0);
  const ta = useRef(null);
  const fileInput = useRef(null);
  const typingTimer = useRef(null);
  const typingOn = useRef(false);

  useEffect(() => { if (edit) ta.current?.focus(); }, [edit]);
  
  useEffect(() => () => { stopTyping(); }, []); // eslint-disable-line
  useEffect(() => { const el = ta.current; if (el) { el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 200)}px`; } }, [value]);

  function stopTyping() {
    clearTimeout(typingTimer.current);
    if (typingOn.current && !edit && !threadParent) { typingOn.current = false; setTyping(wid, cid, user, false).catch(() => {}); }
  }
  function pingTyping() {
    if (edit || threadParent) return;
    if (!typingOn.current) { typingOn.current = true; setTyping(wid, cid, user, true).catch(() => {}); }
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(stopTyping, 3000);
  }

  const options = useMemo(() => {
    if (!mention) return [];
    const q = mention.query.toLowerCase();
    const people = members.filter((m) => m.uid !== user.uid && handleOf(m).startsWith(q)).slice(0, 6).map((m) => ({ key: m.uid, label: handleOf(m), user: m }));
    const specials = allowGroupMention ? ['here', 'channel'].filter((s) => s.startsWith(q)).map((s) => ({ key: s, label: s })) : [];
    return [...specials, ...people];
  }, [mention, members, user.uid, allowGroupMention]);

  function onChange(e) {
    const v = e.target.value; setValue(v); pingTyping();
    const caret = e.target.selectionStart;
    const m = /(^|\s)@([\w.-]*)$/.exec(v.slice(0, caret));
    if (m) { setMention({ query: m[2], start: caret - m[2].length - 1 }); setSel(0); } else setMention(null);
  }
  function pickMention(o) {
    const caret = ta.current.selectionStart;
    const next = `${value.slice(0, mention.start)}@${o.label} ${value.slice(caret)}`;
    setValue(next); setMention(null);
    requestAnimationFrame(() => { const pos = mention.start + o.label.length + 2; ta.current.focus(); ta.current.setSelectionRange(pos, pos); });
  }
  function insert(text) {
    const el = ta.current; const s = el.selectionStart; const e = el.selectionEnd;
    setValue(value.slice(0, s) + text + value.slice(e));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + text.length, s + text.length); });
  }

  async function addFiles(files) {
    for (const original of files) {
      if (original.size > MAX_BYTES) { toast(`${original.name} is larger than 25 MB`, 'error'); continue; }
      const id = Math.random().toString(36).slice(2);
      const file = await compressImage(original);
      const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
      setPending((p) => [...p, { id, name: original.name, size: file.size, type: file.type, progress: 0, preview }]);
      uploadToStorage(`workspaces/${wid}/${user.uid}/${Date.now()}_${original.name.replace(/[^\w.-]/g, '_')}`, file, (progress) => setPending((p) => p.map((x) => (x.id === id ? { ...x, progress } : x))))
        .then(({ url, path }) => setPending((p) => p.map((x) => (x.id === id ? { ...x, url, path, progress: 100 } : x))))
        .catch((e) => { toast(friendlyError(e, 'Upload failed'), 'error'); setPending((p) => p.filter((x) => x.id !== id)); });
    }
  }
  const onPaste = (e) => {
    const files = [...(e.clipboardData?.files || [])].filter((f) => f.type.startsWith('image/'));
    if (files.length) { e.preventDefault(); addFiles(files); }
  };

  const uploading = pending.some((p) => !p.url);
  const canSend = !uploading && (value.trim() || pending.length);

  function send() {
    if (!canSend) return;
    if (edit) { edit.onSave(value); return; }
    let text = value; let poll = null;
    if (/^\/shrug\b/.test(text)) text = `${text.replace(/^\/shrug\s*/, '')} ¯\\_(ツ)_/¯`.trim();
    else if (/^\/poll\b/.test(text)) {
      const q = [...text.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
      if (q.length < 3 || q.length > 9) { toast('Usage: /poll "Question" "Option 1" "Option 2"', 'error'); return; }
      poll = { question: q[0], options: q.slice(1) }; text = '';
    }
    const atts = pending.filter((p) => p.url).map(({ name, size, type, url, path }) => ({ name, size, type, url, path }));
    setValue(''); setPending([]); setMention(null); stopTyping();
    sendMessage({ user, wid, cid, text, attachments: atts, threadParent, members, poll })
      .then(() => onSent?.())
      .catch((e) => { toast(friendlyError(e, 'Failed to send message'), 'error'); setValue(text); });
    atts.forEach((a) => registerFile(wid, { ...a, senderId: user.uid, senderName: user.displayName || user.name, cid }).catch(() => {}));
  }

  function onKeyDown(e) {
    if (mention && options.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => (s + 1) % options.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => (s - 1 + options.length) % options.length); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pickMention(options[sel]); return; }
      if (e.key === 'Escape') { setMention(null); return; }
    }
    if (e.key === 'Escape' && edit) { edit.onCancel(); return; }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } // Ctrl/Cmd+Enter also lands here
  }

  return (
    <div className="composer" style={edit ? { margin: '6px 0 0' } : undefined}>
      {mention && options.length > 0 && (
        <div className="pop" role="listbox" aria-label="Mention suggestions" style={{ minWidth: 220 }}>
          {options.map((o, i) => (
            <button key={o.key} role="option" aria-selected={i === sel} className={`opt ${i === sel ? 'sel' : ''}`} onMouseDown={(e) => { e.preventDefault(); pickMention(o); }}>
              {o.user ? <UserAvatar user={o.user} size={22} /> : <span>📣</span>}@{o.label}
            </button>
          ))}
        </div>
      )}
      {pending.length > 0 && (
        <div className="row" style={{ padding: 8, flexWrap: 'wrap' }}>
          {pending.map((p) => (
            <div key={p.id} className="att" style={{ margin: 0, width: 220 }}>
              {p.preview ? <img src={p.preview} alt="" width={40} height={40} style={{ objectFit: 'cover', borderRadius: 6 }} /> : <span style={{ fontSize: 24 }}>{FILE_ICON[fileKind(p.type, p.name)]}</span>}
              <div className="grow small"><div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                <div className="muted">{formatBytes(p.size)}{!p.url && ` · ${p.progress}%`}</div>{!p.url && <div className="progress"><i style={{ width: `${p.progress}%` }} /></div>}</div>
              <button className="icon-btn" aria-label={`Remove ${p.name}`} onClick={() => setPending((l) => l.filter((x) => x.id !== p.id))}>✕</button>
            </div>
          ))}
        </div>
      )}
      <textarea ref={ta} rows={1} value={value} onChange={onChange} onKeyDown={onKeyDown} onPaste={onPaste} aria-label={placeholder} placeholder={placeholder} />
      {!edit && value.startsWith('/') && <div className="small muted" style={{ padding: '0 12px 6px' }}>Commands: <b>/poll</b> "Question" "A" "B" · <b>/shrug</b> your text</div>}
      <div className="composer-bar">
        <div style={{ position: 'relative' }}>
          <button className="icon-btn" aria-label="Add emoji" onClick={() => setEmoji((v) => !v)}>😊</button>
          {emoji && <EmojiPicker onPick={insert} onClose={() => setEmoji(false)} />}
        </div>
        <button className="icon-btn" aria-label="Attach files or images" onClick={() => fileInput.current.click()}>📎</button>
        <button className="icon-btn" aria-label="Mention someone" onClick={() => { insert('@'); setMention({ query: '', start: (ta.current?.selectionStart || 0) }); }}>@</button>
        <input ref={fileInput} type="file" multiple hidden onChange={(e) => { addFiles([...e.target.files]); e.target.value = ''; }} />
        <span className="grow" />
        {edit && <button className="btn" onClick={edit.onCancel}>Cancel</button>}
        <button className="btn primary" onClick={send} disabled={!canSend} aria-label={edit ? 'Save edit' : 'Send message'} style={{ marginLeft: 6 }}>{edit ? 'Save' : uploading ? 'Uploading…' : 'Send'}</button>
      </div>
    </div>
  );
}
export default memo(MessageComposer);
