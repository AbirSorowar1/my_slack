import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

const load = (k, d) => { try { return localStorage.getItem(k) || d; } catch { return d; } };

export function AppProvider({ children }) {
  const [theme, setThemeState] = useState(() => load('tp.theme', 'system'));
  const [density, setDensityState] = useState(() => load('tp.density', 'comfortable'));
  const [toasts, setToasts] = useState([]);
  const [drawer, setDrawer] = useState(false);
  const [modal, setModal] = useState(null); // { type, props }

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    const apply = () => { document.documentElement.dataset.theme = theme === 'system' ? (mq?.matches ? 'dark' : 'light') : theme; };
    apply(); mq?.addEventListener?.('change', apply);
    return () => mq?.removeEventListener?.('change', apply);
  }, [theme]);
  useEffect(() => { document.documentElement.dataset.density = density; }, [density]);

  const setTheme = (t) => { setThemeState(t); try { localStorage.setItem('tp.theme', t); } catch { /* ignore */ } };
  const setDensity = (d) => { setDensityState(d); try { localStorage.setItem('tp.density', d); } catch { /* ignore */ } };

  const toast = useCallback((message, kind = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);
  const openModal = useCallback((type, props = {}) => setModal({ type, props }), []);
  const closeModal = useCallback(() => setModal(null), []);

  const value = useMemo(() => ({ theme, setTheme, density, setDensity, toasts, toast, drawer, setDrawer, modal, openModal, closeModal }),
    [theme, density, toasts, toast, drawer, modal, openModal, closeModal]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
