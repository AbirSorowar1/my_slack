import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { WorkspaceProvider } from './contexts/WorkspaceContext';
import LoginPage from './pages/LoginPage';
import WorkspacePicker from './pages/WorkspacePicker';
import { FullSpinner } from './components/Common';
import Toasts from './components/Toasts';

const AppShell = lazy(() => import('./layouts/AppShell'));

function AuthProblem() {
  const { error, signOut } = useAuth();
  const denied = /permission/i.test(`${error?.code} ${error?.message}`);
  return (
    <main className="login">
      <div className="login-card">
        <h1>Couldn't load your profile</h1>
        <p className="muted">
          {denied
            ? 'Firebase refused access (PERMISSION_DENIED). The Realtime Database rules are probably not deployed yet, or belong to a different database. Run: firebase deploy --only database,storage'
            : 'Something went wrong while talking to Firebase. Check the browser console for details.'}
        </p>
        <pre className="small" style={{ whiteSpace: 'pre-wrap' }}>{String(error?.message || '')}</pre>
        <div className="row">
          <button className="btn primary" onClick={() => window.location.reload()}>Try again</button>
          <button className="btn" onClick={signOut}>Sign out</button>
        </div>
      </div>
    </main>
  );
}

function Protected({ children }) {
  const { user, loading, firebaseUser } = useAuth();
  if (loading) return <FullSpinner label="Loading your account…" />;
  if (!firebaseUser) return <Navigate to="/login" replace />;
  if (!user) return <AuthProblem />;
  return children;
}

function WorkspaceRoute() {
  const { wid } = useParams();
  return (
    <WorkspaceProvider wid={wid} key={wid}>
      <Suspense fallback={<FullSpinner label="Loading workspace…" />}><AppShell /></Suspense>
    </WorkspaceProvider>
  );
}

export default function App() {
  const { user, loading } = useAuth();
  return (
    <>
      <Routes>
        <Route path="/login" element={!loading && user ? <Navigate to="/" replace /> : <LoginPage />} />
        <Route path="/" element={<Protected><WorkspacePicker /></Protected>} />
        <Route path="/app/:wid/*" element={<Protected><WorkspaceRoute /></Protected>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toasts />
    </>
  );
}
