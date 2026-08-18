
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage.tsx';
import SignUpPage from './pages/SignUpPage.tsx';
import LoginPage from './pages/LoginPage.tsx';
import PublicLayout from './components/PublicLayout.tsx';
import GamePage from './pages/GamePage.tsx';
import DashboardPage from './pages/DashboardPage.tsx';
import ProfilePage from './pages/ProfilePage.tsx';
import AuthCallbackPage from './pages/AuthCallbackPage.tsx';
import TwoFactorSetupPage from './pages/TwoFactorSetupPage.tsx';
import GoogleTwoFactorPage from './pages/GoogleTwoFactorPage.tsx';

export default App

function App() {
  return (
      <BrowserRouter>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signUp" element={<SignUpPage />} />
        </Route>
        <Route path="/game" element={<GamePage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/2fa/prompt" element={<TwoFactorSetupPage />} />
        <Route path="/auth/2fa" element={<GoogleTwoFactorPage />} />
      </Routes>
    </BrowserRouter>
  );
}
