import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useApp } from '../contexts/AppContext';
import { updateProfile } from '../services/users';
import { UserAvatar } from './Common';

export const STATUS_PRESETS = [['🧑‍💻', 'Working'], ['🍔', 'At lunch'], ['🏠', 'Working from home'], ['🚫', 'Do not disturb'], ['🎉', 'Vacation']];

export default function UserMenu() {
  const { user, signOut } = useAuth();
  const { wid, membersById } = useWorkspace();
  const { openModal, theme, setTheme } = useApp();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const h = (e) => { if (!box.current?.contains(e.target)) setOpen(false); };
    const k = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', h); document.addEventListener('keydown', k);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k); };
  }, [open]);
  const me = membersById[user.uid] || user;
  const setStatus = (emoji, text) => updateProfile(user.uid, { statusEmoji: emoji, statusText: text, manualStatus: text === 'Do not disturb' ? 'dnd' : user.manualStatus === 'dnd' ? 'auto' : user.manualStatus || 'auto' });
  const item = { display: 'flex', width: '100%', padding: '8px 12px', textAlign: 'left', borderRadius: 0 };
  return (
    <div style={{ position: 'relative' }} ref={box}>
      <button aria-haspopup="menu" aria-expanded={open} aria-label="User menu" onClick={() => setOpen(!open)}><UserAvatar user={me} size={30} status={me.status || 'online'} /></button>
      {open && (
        <div className="pop" role="menu" style={{ right: 0, left: 'auto', top: 38, bottom: 'auto', width: 270, color: 'var(--ink)' }}>
          <div className="row" style={{ padding: 12 }}><UserAvatar user={me} size={40} /><div className="grow"><b>{user.name}</b><div className="small muted">{user.email}</div></div></div>
          <div className="small muted" style={{ padding: '0 12px 4px' }}>Set a status</div>
          {STATUS_PRESETS.map(([e, t]) => <button role="menuitem" key={t} className="opt" onClick={() => { setStatus(e, t); setOpen(false); }}>{e} {t}</button>)}
          <button role="menuitem" style={item} className="opt" onClick={() => { updateProfile(user.uid, { statusEmoji: '', statusText: '', manualStatus: 'auto' }); setOpen(false); }}>✖ Clear status</button>
          <div className="sep" style={{ margin: 0 }} />
          <button role="menuitem" className="opt" onClick={() => { setOpen(false); openModal('profile', { uid: user.uid }); }}>👤 View profile</button>
          <button role="menuitem" className="opt" onClick={() => { setOpen(false); nav(`/app/${wid}/settings`); }}>⚙️ Settings</button>
          <button role="menuitem" className="opt" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? '☀️ Light mode' : '🌙 Dark mode'}</button>
          <button role="menuitem" className="opt" onClick={signOut}>↩ Sign out</button>
        </div>
      )}
    </div>
  );
}
