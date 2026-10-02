import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { db, ref, onValue, query, orderByChild, limitToLast } from '../firebase/database';
import { useAuth } from './AuthContext';
import { useApp } from './AppContext';
import { dmId, emailKey, toList } from '../utils/helpers';
import { effectiveStatus } from '../services/users';

const Ctx = createContext(null);
export const useWorkspace = () => useContext(Ctx);

/** Subscribes to many `base/<id>` paths and returns a map id -> value. */
function useMany(ids, pathFor) {
  const [map, setMap] = useState({});
  const key = ids.join('|');
  useEffect(() => {
    const unsubs = ids.map((id) => onValue(ref(db, pathFor(id)), (s) => setMap((m) => ({ ...m, [id]: s.val() })), () => setMap((m) => ({ ...m, [id]: null }))));
    return () => unsubs.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return map;
}

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.frequency.value = 660; g.gain.setValueAtTime(0.06, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25); o.start(); o.stop(ctx.currentTime + 0.25);
  } catch { /* audio unavailable */ }
}

export function WorkspaceProvider({ wid, children }) {
  const { user } = useAuth();
  const { toast } = useApp();
  const uid = user.uid;
  const [wsIds, setWsIds] = useState(null);
  const [channelsRaw, setChannelsRaw] = useState(null);
  const [memberRoles, setMemberRoles] = useState(null);
  const [groupIds, setGroupIds] = useState([]);
  const [presence, setPresence] = useState({});
  const [lastRead, setLastRead] = useState({});
  const [prefs, setPrefs] = useState({});
  const [settings, setSettings] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [invites, setInvites] = useState([]);
  const [workspace, setWorkspace] = useState(undefined);

  useEffect(() => onValue(ref(db, `userWorkspaces/${uid}`), (s) => setWsIds(Object.keys(s.val() || {}))), [uid]);
  useEffect(() => onValue(ref(db, `userSettings/${uid}`), (s) => setSettings(s.val() || {})), [uid]);
  useEffect(() => onValue(ref(db, 'presence'), (s) => setPresence(s.val() || {})), []);
  useEffect(() => {
    if (!user.email) return undefined;
    return onValue(ref(db, `invitations/byEmail/${emailKey(user.email)}`), (s) => setInvites(Object.entries(s.val() || {}).map(([w, v]) => ({ wid: w, ...v }))), () => {});
  }, [user.email]);
  useEffect(() => {
    const q = query(ref(db, `notifications/${uid}`), orderByChild('createdAt'), limitToLast(50));
    let first = true; const seen = new Set();
    return onValue(q, (snap) => {
      const list = toList(snap).reverse();
      const fresh = first ? [] : list.filter((n) => !seen.has(n.id) && !n.read);
      list.forEach((n) => seen.add(n.id));
      first = false;
      setNotifications(list);
      if (fresh.length) notifyFresh(fresh[0]);
    }, () => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  const settingsRef = useRef(settings); settingsRef.current = settings;
  function notifyFresh(n) {
    const st = settingsRef.current;
    const allowed = (n.type === 'mention' ? st.notifyMentions : n.type === 'thread' ? st.notifyThreads : st.notifyDms) !== false;
    if (!allowed || user.manualStatus === 'dnd') return;
    toast(`${n.fromName}: ${n.preview || 'sent you something'}`, 'info');
    if (st.sound !== false) beep();
    if (st.desktop && 'Notification' in window && Notification.permission === 'granted' && document.hidden) new Notification(n.fromName, { body: n.preview });
  }

  useEffect(() => {
    if (!wid) { setWorkspace(undefined); return undefined; }
    setWorkspace(undefined); setChannelsRaw(null); setMemberRoles(null);
    const subs = [
      onValue(ref(db, `workspaces/${wid}`), (s) => setWorkspace(s.val()), () => setWorkspace(null)),
      onValue(ref(db, `channels/${wid}`), (s) => setChannelsRaw(toList(s)), () => setChannelsRaw([])),
      onValue(ref(db, `workspaceMembers/${wid}`), (s) => setMemberRoles(s.val() || {}), () => setMemberRoles({})),
      onValue(ref(db, `userGroups/${uid}/${wid}`), (s) => setGroupIds(Object.keys(s.val() || {}))),
      onValue(ref(db, `lastRead/${uid}/${wid}`), (s) => setLastRead(s.val() || {})),
      onValue(ref(db, `channelPrefs/${uid}/${wid}`), (s) => setPrefs(s.val() || {})),
    ];
    return () => subs.forEach((u) => u());
  }, [wid, uid]);

  const workspaces = useMany(wsIds || [], (id) => `workspaces/${id}`);
  const memberIds = useMemo(() => Object.keys(memberRoles || {}), [memberRoles]);
  const profiles = useMany(memberIds, (id) => `users/${id}`);
  const chanIds = useMemo(() => (channelsRaw || []).map((c) => c.id), [channelsRaw]);
  const chanMembers = useMany(chanIds, (id) => `channelMembers/${wid}/${id}`);
  const groups = useMany(groupIds, (id) => `groups/${wid}/${id}`);
  const dmIds = useMemo(() => memberIds.filter((m) => m !== uid).map((m) => dmId(uid, m)).concat(dmId(uid, uid)), [memberIds, uid]);

  const members = useMemo(() => memberIds.map((id) => {
    const p = profiles[id] || { uid: id, name: 'Loading…', email: '' };
    return { ...p, uid: id, role: memberRoles[id].role, status: effectiveStatus(p, presence[id]), lastActive: presence[id]?.lastChanged };
  }), [memberIds, profiles, memberRoles, presence]);
  const membersById = useMemo(() => Object.fromEntries(members.map((m) => [m.uid, m])), [members]);

  const metaIds = useMemo(() => {
    const joined = (channelsRaw || []).filter((c) => chanMembers[c.id]?.[uid]).map((c) => c.id);
    return [...joined, ...dmIds, ...groupIds];
  }, [channelsRaw, chanMembers, dmIds, groupIds, uid]);
  const meta = useMany(metaIds, (id) => `channelMeta/${wid}/${id}`);

  const unreadOf = (id) => Math.max(0, (meta[id]?.count || 0) - (lastRead[id]?.count || 0));

  const channels = useMemo(() => (channelsRaw || [])
    .filter((c) => !c.isPrivate || chanMembers[c.id]?.[uid])
    .map((c) => ({ ...c, members: Object.keys(chanMembers[c.id] || {}), joined: !!chanMembers[c.id]?.[uid], starred: !!prefs[c.id]?.starred, muted: !!prefs[c.id]?.muted,
      unread: chanMembers[c.id]?.[uid] && !prefs[c.id]?.muted ? unreadOf(c.id) : 0 }))
    .sort((a, b) => a.name.localeCompare(b.name)),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [channelsRaw, chanMembers, prefs, meta, lastRead, uid]);

  const groupList = useMemo(() => groupIds.map((id) => groups[id] && ({ id, ...groups[id], members: Object.keys(groups[id].members || {}), unread: unreadOf(id) })).filter(Boolean),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [groupIds, groups, meta, lastRead]);

  const dms = useMemo(() => members.filter((m) => m.uid !== uid).map((m) => ({ ...m, convoId: dmId(uid, m.uid), unread: unreadOf(dmId(uid, m.uid)) })),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [members, meta, lastRead, uid]);

  const role = memberRoles?.[uid]?.role || null;
  const unreadNotifications = notifications.filter((n) => !n.read).length;

  const value = {
    wid, workspace, role, loading: workspace === undefined || channelsRaw === null || memberRoles === null,
    workspaceList: Object.entries(workspaces).filter(([, v]) => v).map(([id, v]) => ({ id, ...v })),
    wsIdsLoaded: wsIds !== null, members, membersById, presence, channels, groups: groupList, dms, prefs, settings,
    notifications, unreadNotifications, invites, unreadOf,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Hook used on the workspace picker (no wid yet). */
export function useWorkspaceIndex() {
  const { user } = useAuth();
  const [ids, setIds] = useState(null);
  const [invites, setInvites] = useState([]);
  useEffect(() => onValue(ref(db, `userWorkspaces/${user.uid}`), (s) => setIds(Object.keys(s.val() || {}))), [user.uid]);
  useEffect(() => onValue(ref(db, `invitations/byEmail/${emailKey(user.email)}`), (s) => setInvites(Object.entries(s.val() || {}).map(([w, v]) => ({ wid: w, ...v }))), () => {}), [user.email]);
  return { ids, invites };
}
