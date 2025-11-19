import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './auth/useAuth';
import Dashboard from './routes/Dashboard';
import TaskPage from './routes/TaskPage';
import Callback from './routes/Callback';
import LoginPage from './routes/LoginPage';

function Protected({ children }: { children: JSX.Element }) {
  const { isAuthenticated, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div>Loading...</div>;
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: loc }} replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/oauth/callback" element={<Callback />} />
      <Route path="/" element={<Protected><Dashboard /></Protected>} />
      <Route path="/task/:id" element={<Protected><TaskPage /></Protected>} />
      <!--Route path="*" element={<Navigate to="/" replace />} /-->
    </Routes>
  );
}
