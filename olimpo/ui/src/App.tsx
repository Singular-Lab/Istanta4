import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { Login } from '@/pages/Login';
import { Dashboard } from '@/pages/Dashboard';
import { Foto } from '@/pages/Foto';
import { Materiali } from '@/pages/Materiali';
import { Utenti } from '@/pages/Utenti';
import { Forbidden } from '@/pages/Forbidden';

export function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/olimpo/private-login" element={<Login />} />
      <Route path="/olimpo/private-forbidden" element={<Forbidden />} />

      {/* Protected — share the AppLayout shell */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/olimpo/private-dashboard" element={<Dashboard />} />
        <Route path="/olimpo/private-foto" element={<Foto />} />
        <Route path="/olimpo/private-materiali" element={<Materiali />} />
        <Route path="/olimpo/private-utenti" element={<Utenti />} />
      </Route>

      {/* Fallback */}
      <Route path="/olimpo/private" element={<Navigate to="/olimpo/private-dashboard" replace />} />
      <Route path="*" element={<Navigate to="/olimpo/private-login" replace />} />
    </Routes>
  );
}
