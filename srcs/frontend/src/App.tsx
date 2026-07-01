import { useState, useEffect } from 'react';

function App() {
  const [status, setStatus] = useState<string>('chargement...');

  useEffect(() => {
    fetch('/api/health')
      .then((response) => response.json())
      .then((data) => setStatus(data.status))
      .catch(() => setStatus('erreur : back injoignable'));
  }, []);

  return (
    <div>
      <h1>ft_transcendence</h1>
      <p>Statut du back : {status}</p>
    </div>
  );
}

export default App;

import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './i18n'; // initialise i18next au démarrage

import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { AuthCallbackPage } from './pages/AuthCallbackPage';
import { HomePage } from './pages/HomePage';

// Pages en construction à remplacer 
function WIP({ name }: { name: string }) {
  const { t } = useTranslation();
  return (
    <div style={{ padding: '3rem', textAlign: 'center' }}>
      <h2>🚧 {name}</h2>
      <p style={{ color: 'var(--text)' }}>Page en cours de développement.</p>
      <a href="/login" style={{ color: 'var(--accent)' }}>{t('nav.login')}</a>
    </div>
  );
}
function RTLHandler() {
  const { i18n } = useTranslation();
  useEffect(() => {
    const lang = i18n.language.slice(0, 2);
    document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
    document.documentElement.setAttribute('lang', lang);
  }, [i18n.language]);
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <RTLHandler />
        <Routes>
          {/* Routes publiques — accessibles sans connexion */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />

          {/* Routes protégées — redirigent vers /login si pas connecté */}
          <Route path="/" element={<HomePage />} />
          <Route path="/profile" element={<ProtectedRoute><WIP name="Profil" /></ProtectedRoute>} />
          <Route path="/chat" element={<ProtectedRoute><WIP name="Chat" /></ProtectedRoute>} />
          <Route path="/game" element={<ProtectedRoute><WIP name="Jeu" /></ProtectedRoute>} />
          <Route path="/leaderboard" element={<ProtectedRoute><WIP name="Classement" /></ProtectedRoute>} />

          {/* Toute autre URL va accueil */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
