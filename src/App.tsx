import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './auth/useAuth';
import Dashboard from './routes/Dashboard';
import TaskPage from './routes/TaskPage';
import Callback from './routes/Callback';
import LoginPage from './routes/LoginPage';
import './styles.css';

function Protected({ children }: { children: JSX.Element }) {
  const { isAuthenticated, loading } = useAuth();
  const loc = useLocation();

  if (loading) {
    return (
      <div className="login-container">
        <div className="login-card">
          <div className="spinner"></div>
          <p className="loading-text">Checking authentication...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" state={{ from: loc }} replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/me" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/oauth/callback" element={<Callback />} />
      <Route path="/me" element={<Protected><Dashboard /></Protected>} />
      <Route path="/task/:id" element={<Protected><TaskPage /></Protected>} />
    </Routes>
  );
}
