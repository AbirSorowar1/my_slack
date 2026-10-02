import { db, ref, update, push, remove, serverTimestamp } from '../firebase/database';

export async function createGroup(user, wid, name, memberIds) {
  const gid = `grp_${push(ref(db, `groups/${wid}`)).key}`;
  const members = Object.fromEntries([user.uid, ...memberIds].map((u) => [u, true]));
  const patch = { [`groups/${wid}/${gid}`]: { name, ownerId: user.uid, members, createdAt: serverTimestamp() } };
  Object.keys(members).forEach((u) => { patch[`userGroups/${u}/${wid}/${gid}`] = true; });
  await update(ref(db), patch);
  return gid;
}
export const renameGroup = (wid, gid, name) => update(ref(db, `groups/${wid}/${gid}`), { name });
export const addGroupMember = (wid, gid, uid) => update(ref(db), { [`groups/${wid}/${gid}/members/${uid}`]: true, [`userGroups/${uid}/${wid}/${gid}`]: true });
export const removeGroupMember = (wid, gid, uid) => update(ref(db), { [`groups/${wid}/${gid}/members/${uid}`]: null, [`userGroups/${uid}/${wid}/${gid}`]: null });
