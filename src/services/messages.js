import { db, ref, set, update, push, remove, serverTimestamp, runTransaction, get, onDisconnect } from '../firebase/database';
import { expandShortcodes } from '../utils/emoji';
import { extractMentions, isDmId, isGroupId, dmOther } from '../utils/helpers';

export const msgPath = (wid, cid, mid, pid) => (pid ? `threads/${wid}/${cid}/${pid}/${mid}` : `messages/${wid}/${cid}/${mid}`);

async function notify(toUid, n) {
  const r = push(ref(db, `notifications/${toUid}`));
  await set(r, { read: false, createdAt: serverTimestamp(), ...n });
}

async function recipientsFor(wid, cid, me) {
  if (isDmId(cid)) return [dmOther(cid, me)];
  if (isGroupId(cid)) return Object.keys((await get(ref(db, `groups/${wid}/${cid}/members`))).val() || {}).filter((u) => u !== me);
  return [];
}

/** Creates a channel message or (when threadParent is set) a thread reply. */
export async function sendMessage({ user, wid, cid, text, attachments = [], threadParent = null, members = [], poll = null }) {
  const body = expandShortcodes(text.trim());
  if (!body && !attachments.length && !poll) return null;
  const mentions = extractMentions(body, members);
  const key = push(ref(db, threadParent ? `threads/${wid}/${cid}/${threadParent.id}` : `messages/${wid}/${cid}`)).key;
  const data = {
    senderId: user.uid, senderName: user.displayName || user.name, senderAvatar: user.photoURL || '',
    text: body, createdAt: serverTimestamp(), edited: false,
    ...(attachments.length ? { attachments } : {}), ...(poll ? { poll } : {}), ...(mentions.length ? { mentions } : {}),
  };
  await set(ref(db, msgPath(wid, cid, key, threadParent?.id)), data);

  if (threadParent) {
    await set(ref(db, `${msgPath(wid, cid, threadParent.id)}/lastReplyAt`), serverTimestamp());
    await runTransaction(ref(db, `${msgPath(wid, cid, threadParent.id)}/replyCount`), (c) => (c || 0) + 1);
  } else {
    await runTransaction(ref(db, `channelMeta/${wid}/${cid}`), (m) => ({ count: ((m && m.count) || 0) + 1, lastMessageAt: Date.now() }));
  }

  // Notifications (best effort; never fail the send)
  try {
    const base = { wid, cid, mid: threadParent ? threadParent.id : key, fromId: user.uid, fromName: data.senderName, preview: (poll ? `📊 ${poll.question}` : body).slice(0, 120) };
    const sent = new Set([user.uid]);
    const send = (uid, type) => { if (sent.has(uid)) return Promise.resolve(); sent.add(uid); return notify(uid, { ...base, type }); };
    if (threadParent && threadParent.senderId !== user.uid) await send(threadParent.senderId, 'thread');
    for (const m of mentions) {
      if (m === '*') {
        const all = Object.keys((await get(ref(db, `channelMembers/${wid}/${cid}`))).val() || {});
        for (const u of all) await send(u, 'mention');
      } else await send(m, 'mention');
    }
    for (const u of await recipientsFor(wid, cid, user.uid)) await send(u, isDmId(cid) ? 'dm' : 'group');
  } catch (e) { console.warn('notify failed', e); }
  return key;
}

export const editMessage = (wid, cid, mid, text, pid) =>
  update(ref(db, msgPath(wid, cid, mid, pid)), { text: expandShortcodes(text.trim()), edited: true, updatedAt: serverTimestamp() });

export async function deleteMessage(wid, cid, mid, pid) {
  if (!pid) {
    await remove(ref(db, `threads/${wid}/${cid}/${mid}`)).catch(() => {});
    await remove(ref(db, `pinnedMessages/${wid}/${cid}/${mid}`)).catch(() => {});
  }
  await remove(ref(db, msgPath(wid, cid, mid, pid)));
  if (pid) await runTransaction(ref(db, `${msgPath(wid, cid, pid)}/replyCount`), (c) => Math.max(0, (c || 1) - 1)).catch(() => {});
}

export const toggleReaction = (wid, cid, mid, emoji, uid, has, pid) =>
  set(ref(db, `${msgPath(wid, cid, mid, pid)}/reactions/${emoji}/${uid}`), has ? null : true);

export async function togglePin(wid, cid, msg, pinned) {
  await update(ref(db), {
    [`messages/${wid}/${cid}/${msg.id}/pinned`]: pinned ? null : true,
    [`pinnedMessages/${wid}/${cid}/${msg.id}`]: pinned ? null : { text: msg.text || '(attachment)', senderName: msg.senderName, senderId: msg.senderId, createdAt: msg.createdAt, pinnedAt: Date.now() },
  });
}

export async function toggleSave(uid, wid, cid, msg, saved) {
  await set(ref(db, `savedMessages/${uid}/${wid}/${cid}_${msg.id}`), saved ? null : {
    cid, mid: msg.id, text: msg.text || '(attachment)', senderName: msg.senderName, createdAt: msg.createdAt, savedAt: Date.now(),
  });
}

export function setTyping(wid, cid, user, on) {
  const r = ref(db, `typing/${wid}/${cid}/${user.uid}`);
  if (on) { onDisconnect(r).remove(); return set(r, { name: user.displayName || user.name, at: Date.now() }); }
  return remove(r);
}

export const registerFile = (wid, file) => set(push(ref(db, `files/${wid}`)), { ...file, createdAt: serverTimestamp() });
export const markNotificationRead = (uid, nid) => update(ref(db, `notifications/${uid}/${nid}`), { read: true });
export const clearNotification = (uid, nid) => remove(ref(db, `notifications/${uid}/${nid}`));

/** Single-choice poll vote: selecting your current choice again removes the vote. */
export function votePoll(wid, cid, mid, optionCount, idx, uid, alreadyChosen) {
  const patch = {};
  for (let i = 0; i < optionCount; i += 1) patch[`messages/${wid}/${cid}/${mid}/votes/${i}/${uid}`] = i === idx && !alreadyChosen ? true : null;
  return update(ref(db), patch);
}
