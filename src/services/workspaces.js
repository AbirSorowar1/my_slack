import { db, ref, get, set, update, push, remove, serverTimestamp } from '../firebase/database';
import { emailKey } from '../utils/helpers';
import { deleteChannel } from './channels';

export async function createWorkspace(user, { name, description = '', icon = '🌊' }) {
  const wid = push(ref(db, 'workspaces')).key;
  const cid = push(ref(db, `channels/${wid}`)).key;
  await update(ref(db), {
    [`workspaces/${wid}`]: { name, description, icon, ownerId: user.uid, createdAt: serverTimestamp() },
    [`workspaceMembers/${wid}/${user.uid}`]: { role: 'owner', joinedAt: serverTimestamp() },
    [`userWorkspaces/${user.uid}/${wid}`]: true,
  });
  await update(ref(db), {
    [`channels/${wid}/${cid}`]: { name: 'general', description: 'Company-wide conversation', isPrivate: false, createdBy: user.uid, createdAt: serverTimestamp() },
    [`channelMembers/${wid}/${cid}/${user.uid}`]: true,
  });
  return { wid, cid };
}
export const updateWorkspace = (wid, patch) => update(ref(db, `workspaces/${wid}`), patch);

export async function deleteWorkspace(uid, wid) {
  const chans = Object.keys((await get(ref(db, `channels/${wid}`))).val() || {});
  for (const c of chans) await deleteChannel(wid, c);
  const members = Object.keys((await get(ref(db, `workspaceMembers/${wid}`))).val() || {}).filter((u) => u !== uid);
  await remove(ref(db, `files/${wid}`)).catch(() => {});
  await remove(ref(db, `invitations/byWorkspace/${wid}`)).catch(() => {});
  for (const u of members) {
    await remove(ref(db, `userWorkspaces/${u}/${wid}`)).catch(() => {});
    await remove(ref(db, `workspaceMembers/${wid}/${u}`)).catch(() => {});
  }
  await remove(ref(db, `workspaces/${wid}`));
  await remove(ref(db, `workspaceMembers/${wid}/${uid}`));
  await remove(ref(db, `userWorkspaces/${uid}/${wid}`));
}
export async function leaveWorkspace(uid, wid) {
  await remove(ref(db, `workspaceMembers/${wid}/${uid}`));
  await remove(ref(db, `userWorkspaces/${uid}/${wid}`));
}
export const removeMember = (uid, wid) => leaveWorkspace(uid, wid);
export const setMemberRole = (wid, uid, role) => update(ref(db, `workspaceMembers/${wid}/${uid}`), { role });

export async function inviteByEmail(wid, workspace, inviter, email, role = 'member') {
  const ek = emailKey(email);
  const data = { email: email.trim().toLowerCase(), role, workspaceName: workspace.name, workspaceIcon: workspace.icon || '🌊', invitedBy: inviter.uid, invitedByName: inviter.name, createdAt: serverTimestamp() };
  await update(ref(db), { [`invitations/byEmail/${ek}/${wid}`]: data, [`invitations/byWorkspace/${wid}/${ek}`]: data });
}
export async function revokeInvite(wid, ek) {
  await update(ref(db), { [`invitations/byEmail/${ek}/${wid}`]: null, [`invitations/byWorkspace/${wid}/${ek}`]: null });
}
export async function acceptInvite(user, wid, invite) {
  await set(ref(db, `workspaceMembers/${wid}/${user.uid}`), { role: invite.role, joinedAt: serverTimestamp() });
  await set(ref(db, `userWorkspaces/${user.uid}/${wid}`), true);
  await revokeInvite(wid, emailKey(user.email));
}
export const declineInvite = (user, wid) => revokeInvite(wid, emailKey(user.email));

/** Adds someone who has already signed in to the app straight into the workspace (no acceptance step). */
export async function addExistingUserByEmail(wid, workspace, adder, email, role = 'member') {
  const ek = emailKey(email);
  const uid = (await get(ref(db, `usersByEmail/${ek}`))).val();
  if (!uid) return { found: false };
  if ((await get(ref(db, `workspaceMembers/${wid}/${uid}`))).exists()) return { found: true, already: true };
  await update(ref(db), {
    [`workspaceMembers/${wid}/${uid}`]: { role, joinedAt: serverTimestamp() },
    [`userWorkspaces/${uid}/${wid}`]: true,
  });
  await set(push(ref(db, `notifications/${uid}`)), {
    type: 'workspace', wid, fromId: adder.uid, fromName: adder.name, preview: `Added you to ${workspace.name}`, read: false, createdAt: serverTimestamp(),
  }).catch(() => {});
  return { found: true, uid };
}
