import { useEffect, useRef } from 'react';

const COLORS = ['#0f7b6c', '#b4501e', '#4b54e8', '#8a3fa8', '#2a7fb8', '#a3342d', '#5a7d1f'];
const colorFor = (s = '') => COLORS[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];

export function UserAvatar({ user, size = 36, status }) {
  const name = user?.displayName || user?.name || user?.senderName || '?';
  const src = user?.photoURL || user?.senderAvatar;
  const st = { width: size, height: size, fontSize: size * 0.42 };
  return (
    <span className="avatar" style={{ ...st, background: src ? 'transparent' : colorFor(name) }} aria-label={name}>
      {src ? <img src={src} alt="" width={size} height={size} loading="lazy" referrerPolicy="no-referrer" style={{ borderRadius: 8, objectFit: 'cover' }} /> : name[0]?.toUpperCase()}
      {status && <i className={`dot ${status}`} title={status} />}
    </span>
  );
}

export const StatusDot = ({ status = 'offline' }) => <i className={`side-dot ${status}`} title={status} />;

export function Modal({ title, onClose, children, footer, wide, center }) {
  const ref = useRef(null);
  useEffect(() => {
    const prev = document.activeElement;
    const first = ref.current?.querySelector('input,textarea,select,button.primary,button');
    first?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
      if (e.key === 'Tab') { // simple focus trap
        const f = [...ref.current.querySelectorAll('button,input,textarea,select,a[href]')].filter((x) => !x.disabled);
        if (!f.length) return;
        const a = f[0]; const z = f[f.length - 1];
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
        else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); prev?.focus?.(); };
  }, [onClose]);
  return (
    <div className={`scrim ${center ? 'center' : ''}`} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <header><span className="grow">{title}</span><button className="icon-btn" aria-label="Close" onClick={onClose}>✕</button></header>
        <div className="body">{children}</div>
        {footer && <footer>{footer}</footer>}
      </div>
    </div>
  );
}

export const FullSpinner = ({ label }) => (
  <div style={{ height: '100%', display: 'grid', placeItems: 'center' }} role="status"><div style={{ textAlign: 'center' }}><span className="spinner" /><p className="muted">{label}</p></div></div>
);

export const Skeleton = ({ rows = 6 }) => (
  <div style={{ padding: 16 }} aria-busy="true" aria-label="Loading">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="row" style={{ marginBottom: 18, alignItems: 'flex-start' }}>
        <div className="skel" style={{ width: 36, height: 36 }} />
        <div className="grow"><div className="skel" style={{ height: 12, width: `${20 + (i * 7) % 20}%`, marginBottom: 8 }} /><div className="skel" style={{ height: 12, width: `${50 + (i * 13) % 40}%` }} /></div>
      </div>
    ))}
  </div>
);

export const EmptyState = ({ icon = '🌊', title, children }) => (
  <div className="empty"><div className="big">{icon}</div><h3 style={{ color: 'var(--ink)', margin: '8px 0' }}>{title}</h3><div>{children}</div></div>
);

export const EMOJIS = ['👍', '❤️', '😂', '🎉', '🔥', '👀', '🙏', '✅', '😀', '😊', '😍', '🤔', '😮', '😢', '😡', '👏', '🙌', '💯', '🚀', '⭐', '☕', '🍕', '🎂', '💡', '📌', '👋', '🤝', '💪', '🙈', '😎', '🥳', '😴'];
export function EmojiPicker({ onPick, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (!ref.current?.contains(e.target)) onClose?.(); };
    setTimeout(() => document.addEventListener('mousedown', h), 0);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);
  return (
    <div className="pop emoji-grid" ref={ref} role="listbox" aria-label="Emoji picker">
      {EMOJIS.map((e) => <button key={e} role="option" aria-label={e} onClick={() => { onPick(e); onClose?.(); }}>{e}</button>)}
    </div>
  );
}

const INLINE = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*|\*[^*\n]+\*)|(\b_[^_\n]+_\b)|(~[^~\n]+~)|(https?:\/\/[^\s<]+)|(@[\w.-]+)/g;

function inline(text, names, prefix) {
  const out = []; let last = 0; let m; let i = 0;
  INLINE.lastIndex = 0;
  while ((m = INLINE.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0]; const k = `${prefix}-${i++}`;
    if (m[1]) out.push(<code key={k}>{t.slice(1, -1)}</code>);
    else if (m[2]) out.push(<strong key={k}>{t.replace(/^\*\*?|\*\*?$/g, '')}</strong>);
    else if (m[3]) out.push(<em key={k}>{t.slice(1, -1)}</em>);
    else if (m[4]) out.push(<s key={k}>{t.slice(1, -1)}</s>);
    else if (m[5]) out.push(<a key={k} href={t} target="_blank" rel="noopener noreferrer">{t}</a>);
    else if (names.has(t.slice(1).toLowerCase())) out.push(<span key={k} className="mention">{t}</span>);
    else out.push(t);
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Slack-style formatting: *bold*, _italic_, ~strike~, `code`, ```code blocks```, > quotes, links and @mentions. */
export function renderText(text = '', members = []) {
  const names = new Set(['channel', 'here', ...members.map((m) => (m.displayName || m.name || '').toLowerCase().replace(/\s+/g, '.'))]);
  return text.split(/```([\s\S]*?)```/).map((part, idx) => {
    if (idx % 2 === 1) return <pre key={idx}><code>{part.replace(/^\n/, '')}</code></pre>;
    return part.split('\n').map((line, li, arr) => {
      const quote = line.startsWith('> ');
      const body = inline(quote ? line.slice(2) : line, names, `${idx}-${li}`);
      return <span key={`${idx}-${li}`}>{quote ? <span className="quote">{body}</span> : body}{li < arr.length - 1 ? '\n' : ''}</span>;
    });
  });
}
