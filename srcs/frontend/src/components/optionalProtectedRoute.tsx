/*import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  // Pendant la vérif du token : spinner
  if (isLoading) {
    return (
      <div className="loading-screen" aria-label="Chargement">
        <div className="loading-spinner" />
      </div>
    );
  }

  // Pas connecté redirige vers login en mémorisant la page demandée
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
//pas sûre que ça sert mais ça garde les pages privées et redirige vers login si pas co
// ça dépend de comment c'est géré dans App.tsx s'il y a une autre façon de faire
*/
