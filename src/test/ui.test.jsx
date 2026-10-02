import { vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

let authCb;
vi.mock('../firebase/auth', () => ({
  auth: {}, signInWithGoogle: vi.fn(() => Promise.resolve()), signOutUser: vi.fn(), watchAuth: (cb) => { authCb = cb; return () => {}; },
}));
vi.mock('../firebase/database', () => ({
  db: {}, ref: () => ({}), get: vi.fn(() => Promise.resolve({ exists: () => true })), set: vi.fn(() => Promise.resolve()), update: vi.fn(() => Promise.resolve()), serverTimestamp: () => 'TS',
  onValue: (_r, cb) => { cb({ val: () => ({ uid: 'u1', name: 'Ada Lovelace', email: 'ada@x.com' }) }); return () => {}; }, onDisconnect: () => ({ set: vi.fn() }),
}));
vi.mock('../firebase/config', () => ({ app: {} }));

const { AuthProvider, useAuth } = await import('../contexts/AuthContext');
const { AppProvider } = await import('../contexts/AppContext');
const LoginPage = (await import('../pages/LoginPage')).default;
const { UserAvatar, EmptyState } = await import('../components/Common');

function Probe() { const { user, loading } = useAuth(); return <div>{loading ? 'loading' : user ? `hi ${user.name}` : 'signed out'}</div>; }

describe('auth state & rendering', () => {
  it('tracks signed-out then signed-in state', async () => {
    render(<MemoryRouter><AppProvider><AuthProvider><Probe /></AuthProvider></AppProvider></MemoryRouter>);
    expect(screen.getByText('loading')).toBeInTheDocument();
    authCb(null);
    await waitFor(() => expect(screen.getByText('signed out')).toBeInTheDocument());
    authCb({ uid: 'u1', displayName: 'Ada Lovelace', email: 'ada@x.com', photoURL: '' });
    await waitFor(() => expect(screen.getByText('hi Ada Lovelace')).toBeInTheDocument());
  });
  it('renders the login screen and starts Google sign-in', async () => {
    const { signInWithGoogle } = await import('../firebase/auth');
    render(<MemoryRouter><AppProvider><AuthProvider><LoginPage /></AuthProvider></AppProvider></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /continue with google/i }));
    expect(signInWithGoogle).toHaveBeenCalled();
  });
  it('renders avatar initials and empty states', () => {
    render(<><UserAvatar user={{ name: 'Meem' }} /><EmptyState title="Nothing here" /></>);
    expect(screen.getByLabelText('Meem')).toHaveTextContent('M');
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });
});
