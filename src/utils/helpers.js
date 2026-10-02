export const dmId = (a, b) => `dm_${[a, b].sort().join('_')}`;
export const isDmId = (id = '') => id.startsWith('dm_');
export const isGroupId = (id = '') => id.startsWith('grp_');
export const dmOther = (id, me) => id.slice(3).split('_').find((u) => u !== me) || me;
export const emailKey = (email = '') => email.trim().toLowerCase().replace(/\./g, ',');

export const ROLES = { owner: 3, admin: 2, member: 1 };
export const canManage = (role) => (ROLES[role] || 0) >= ROLES.admin;
export const canModerateMessage = (role, msg, uid) => msg?.senderId === uid || canManage(role);
export const canEditMessage = (msg, uid) => msg?.senderId === uid;

export const MENTION_RE = /@([\w.-]+)/g;
export function extractMentions(text, members = []) {
  const found = new Set();
  const lower = text.toLowerCase();
  if (/(^|\s)@(channel|here)\b/.test(lower)) found.add('*');
  for (const m of members) {
    const handle = handleOf(m);
    if (new RegExp(`(^|\\s)@${handle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text)) found.add(m.uid);
  }
  return [...found];
}
export const handleOf = (u) => (u?.displayName || u?.name || 'user').trim().toLowerCase().replace(/\s+/g, '.');

export function formatTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
export function formatDay(ts) {
  const d = new Date(ts); const t = new Date();
  const y = new Date(); y.setDate(t.getDate() - 1);
  if (d.toDateString() === t.toDateString()) return 'Today';
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
}
export function relativeTime(ts) {
  if (!ts) return 'never';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(ts).toLocaleDateString();
}
export function formatBytes(n = 0) {
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}
export function fileKind(type = '', name = '') {
  const ext = name.split('.').pop().toLowerCase();
  if (type.startsWith('image/')) return 'image';
  if (ext === 'pdf') return 'pdf';
  if (['doc', 'docx', 'txt', 'rtf'].includes(ext)) return 'doc';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'sheet';
  if (['zip', 'rar', '7z', 'gz'].includes(ext)) return 'archive';
  return 'other';
}
export const FILE_ICON = { image: '🖼️', pdf: '📄', doc: '📝', sheet: '📊', archive: '📁', other: '📎' };
export const toList = (snap) => {
  const out = [];
  snap.forEach((c) => { out.push({ id: c.key, ...c.val() }); });
  return out;
};
export function friendlyError(e, fallback = 'Something went wrong') {
  const code = e?.code || '';
  if (code.includes('PERMISSION_DENIED') || /permission/i.test(e?.message || '')) return 'Permission denied';
  if (code === 'auth/popup-closed-by-user') return 'Sign-in cancelled';
  if (code === 'auth/unauthorized-domain') return 'This domain is not authorized in Firebase Authentication';
  if (code.startsWith('auth/')) return 'Authentication failed';
  if (code.startsWith('storage/')) return 'Upload failed';
  if (/network|offline/i.test(e?.message || '')) return 'Network disconnected';
  return fallback;
}
