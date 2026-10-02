import { useEffect, useRef, useState, useCallback } from 'react';
import { db, ref, onValue, onChildAdded, onChildChanged, onChildRemoved, query, orderByChild, limitToLast } from '../firebase/database';

/** Subscribes to a single path. Returns { data, loading, error }. Unsubscribes on unmount / path change. */
export function useValue(path) {
  const [state, setState] = useState({ data: null, loading: !!path, error: null });
  useEffect(() => {
    if (!path) { setState({ data: null, loading: false, error: null }); return undefined; }
    setState((s) => ({ ...s, loading: true }));
    return onValue(ref(db, path), (snap) => setState({ data: snap.val(), loading: false, error: null }),
      (error) => setState({ data: null, loading: false, error }));
  }, [path]);
  return state;
}

/** Live message list using child events (no full re-download per change). Ordered by createdAt, limited. */
export function useMessageList(path, limit = 50) {
  const [map, setMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const ready = useRef(false);

  useEffect(() => {
    if (!path) { setMap({}); setLoading(false); return undefined; }
    setMap({}); setLoading(true); setError(null); ready.current = false;
    const q = query(ref(db, path), orderByChild('createdAt'), limitToLast(limit));
    const put = (s) => setMap((m) => ({ ...m, [s.key]: { id: s.key, ...s.val() } }));
    const fail = (e) => { setError(e); setLoading(false); };
    const unsubs = [
      onChildAdded(q, put, fail), onChildChanged(q, put, fail),
      onChildRemoved(q, (s) => setMap((m) => { const n = { ...m }; delete n[s.key]; return n; }), fail),
      onValue(q, () => { ready.current = true; setLoading(false); }, fail),
    ];
    return () => unsubs.forEach((u) => u());
  }, [path, limit]);

  const list = Object.values(map).sort((a, b) => (a.createdAt || Date.now() + 1e6) - (b.createdAt || Date.now() + 1e6));
  return { list, loading, error, hasMore: list.length >= limit };
}

export function useOnline() {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [connected, setConnected] = useState(true);
  useEffect(() => {
    const on = () => setOnline(true); const off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    const unsub = onValue(ref(db, '.info/connected'), (s) => setConnected(!!s.val()));
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); unsub(); };
  }, []);
  return { online, connected };
}

export function useDebounced(value, ms = 200) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

export function useKey(handler) {
  const h = useRef(handler); h.current = handler;
  useEffect(() => { const fn = (e) => h.current(e); window.addEventListener('keydown', fn); return () => window.removeEventListener('keydown', fn); }, []);
}
export const useStable = (fn) => useCallback(fn, []); // eslint-disable-line
