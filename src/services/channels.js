import { db, ref, get, set, update, push, remove, serverTimestamp } from '../firebase/database';

export async function createChannel(user, wid, { name, description = '', isPrivate = false }) {
  const cid = push(ref(db, `channels/${wid}`)).key;
  const clean = name.trim().toLowerCase().replace(/[^a-z0-9-_ ]/g, '').replace(/\s+/g, '-');
  await set(ref(db, `channelMembers/${wid}/${cid}/${user.uid}`), true);
  await set(ref(db, `channels/${wid}/${cid}`), { name: clean, description, isPrivate, createdBy: user.uid, createdAt: serverTimestamp() });
  return cid;
}
export const updateChannel = (wid, cid, patch) => update(ref(db, `channels/${wid}/${cid}`), patch);
export async function deleteChannel(wid, cid) {
  // Children first: the rules use the channel record to authorize the creator.
  for (const p of ['messages', 'threads', 'pinnedMessages', 'channelMeta', 'channelMembers']) await remove(ref(db, `${p}/${wid}/${cid}`)).catch(() => {});
  await remove(ref(db, `channels/${wid}/${cid}`));
}
export const joinChannel = (uid, wid, cid) => set(ref(db, `channelMembers/${wid}/${cid}/${uid}`), true);
export const leaveChannel = (uid, wid, cid) => remove(ref(db, `channelMembers/${wid}/${cid}/${uid}`));
export const addChannelMember = joinChannel;
export const removeChannelMember = leaveChannel;
export const setChannelPref = (uid, wid, cid, key, val) => set(ref(db, `channelPrefs/${uid}/${wid}/${cid}/${key}`), val ? true : null);
export async function markRead(uid, wid, cid) {
  const snap = await get(ref(db, `channelMeta/${wid}/${cid}/count`));
  await set(ref(db, `lastRead/${uid}/${wid}/${cid}`), { count: snap.val() || 0, at: serverTimestamp() });
}

export async function ensureDemoData(user, wid) {
  const names = [['general', 'Company-wide conversation'], ['announcements', 'Important updates'], ['random', 'Everything else']];
  const existing = Object.values((await get(ref(db, `channels/${wid}`))).val() || {}).map((c) => c.name);
  for (const [n, d] of names) if (!existing.includes(n)) await createChannel(user, wid, { name: n, description: d });
}
