import { db, ref, get, set, update, serverTimestamp, onValue, onDisconnect } from '../firebase/database';
import { emailKey } from '../utils/helpers';

export async function ensureUserProfile(user) {
  const r = ref(db, `users/${user.uid}`);
  const snap = await get(r);
  // Lookup index so workspace admins can add you by email (refreshed on every sign-in).
  if (user.email) await set(ref(db, `usersByEmail/${emailKey(user.email)}`), user.uid);
  if (!snap.exists()) {
    await set(r, {
      uid: user.uid, name: user.displayName || user.email.split('@')[0], displayName: user.displayName || user.email.split('@')[0],
      email: user.email, photoURL: user.photoURL || '', bio: '', statusEmoji: '', statusText: '', manualStatus: 'auto',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '', joinedAt: serverTimestamp(),
    });
  }
}
export const updateProfile = (uid, patch) => update(ref(db, `users/${uid}`), patch);

/** Connection-aware presence: onDisconnect flips to offline server-side. */
export function startPresence(uid, getState) {
  const pr = ref(db, `presence/${uid}`);
  const unsub = onValue(ref(db, '.info/connected'), async (s) => {
    if (!s.val()) return;
    await onDisconnect(pr).set({ state: 'offline', lastChanged: serverTimestamp() });
    await set(pr, { state: getState(), lastChanged: serverTimestamp() });
  });
  return () => { unsub(); set(pr, { state: 'offline', lastChanged: serverTimestamp() }).catch(() => {}); };
}
export const setPresenceState = (uid, state) => set(ref(db, `presence/${uid}`), { state, lastChanged: serverTimestamp() });

export const saveSettings = (uid, patch) => update(ref(db, `userSettings/${uid}`), patch);

export function effectiveStatus(user, presence) {
  if (!presence || presence.state === 'offline') return 'offline';
  if (user?.manualStatus === 'dnd') return 'dnd';
  if (user?.manualStatus === 'away') return 'away';
  return presence.state;
}
