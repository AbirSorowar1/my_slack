import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { watchAuth, signInWithGoogle, signOutUser } from '../firebase/auth';
import { db, ref, onValue } from '../firebase/database';
import { ensureUserProfile, startPresence, setPresenceState } from '../services/users';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [fbUser, setFbUser] = useState(undefined); // undefined = still resolving
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => watchAuth(async (u) => {
    if (u) { try { await ensureUserProfile(u); } catch (e) { setError(e); } }
    setFbUser(u || null);
    if (!u) setProfile(null);
  }), []);

  useEffect(() => {
    if (!fbUser) return undefined;
    return onValue(ref(db, `users/${fbUser.uid}`), (s) => setProfile(s.val()), setError);
  }, [fbUser]);

  // Presence: online/away by tab visibility; server flips to offline on disconnect.
  useEffect(() => {
    if (!fbUser) return undefined;
    const state = () => (document.hidden ? 'away' : 'online');
    const stop = startPresence(fbUser.uid, state);
    let t;
    const onVis = () => { clearTimeout(t); t = setTimeout(() => setPresenceState(fbUser.uid, state()).catch(() => {}), 300); };
    document.addEventListener('visibilitychange', onVis);
    return () => { document.removeEventListener('visibilitychange', onVis); clearTimeout(t); stop(); };
  }, [fbUser]);

  const value = useMemo(() => ({
    loading: fbUser === undefined || (!!fbUser && !profile && !error),
    firebaseUser: fbUser,
    user: fbUser && profile ? { ...profile, uid: fbUser.uid, photoURL: profile.photoURL || fbUser.photoURL } : null,
    error, signIn: signInWithGoogle, signOut: signOutUser,
  }), [fbUser, profile, error]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
