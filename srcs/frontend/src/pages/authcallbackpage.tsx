import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { setAccessToken } from '../api/auth';

export function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const access = params.get('accessToken');
    const refresh = params.get('refreshToken');

    if (access && refresh) {
      setAccessToken(access);
      localStorage.setItem('refreshToken', refresh);
      // Nettoie les tokens de la barre d'adresse par sécurité 
      window.history.replaceState({}, '', '/');
      navigate('/', { replace: true });
    } else {
      navigate('/login?error=oauth', { replace: true });
    }
  }, [navigate]);

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ textAlign: 'center' }}>
        <div className="loading-spinner" style={{ margin: '0 auto' }} />
        <p style={{ marginTop: '1rem' }}>Connexion en cours…</p>
      </div>
    </div>
  );
}
