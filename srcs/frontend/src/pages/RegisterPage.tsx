/*import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';

export function RegisterPage() {
  const { t } = useTranslation();
  const { register } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function validate(): string | null {
    if (!username.trim()) return 'Nom d\'utilisateur requis';
    if (username.length < 3) return 'Minimum 3 caractères';
    if (username.length > 20) return 'Maximum 20 caractères';
    if (!/^[a-zA-Z0-9_]+$/.test(username)) return 'Lettres, chiffres et _ uniquement';
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Email invalide';
    if (password.length < 8) return t('register.error.password_weak');
    if (password !== confirm) return t('register.error.passwords_mismatch');
    return null;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }
    setError(null);
    setLoading(true);
    try {
      await register(username, email, password);
      navigate('/');
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '';
      if (msg.toLowerCase().includes('username')) setError(t('register.error.username_taken'));
      else if (msg.toLowerCase().includes('email')) setError(t('register.error.email_taken'));
      else setError(t('register.error.server'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">{t('register.title')}</h1>
        <p className="auth-subtitle">{t('register.subtitle')}</p>
        {error && <div className="error-banner" role="alert">{error}</div>}
        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="username">{t('register.username')}</label>
            <input id="username" type="text" value={username} onChange={(e) => setUsername(e.target.value)}
              placeholder={t('register.username_placeholder')} disabled={loading} autoComplete="username" maxLength={20} />
          </div>
          <div className="form-group">
            <label htmlFor="reg-email">{t('register.email')}</label>
            <input id="reg-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder={t('register.email_placeholder')} disabled={loading} autoComplete="email" />
          </div>
          <div className="form-group">
            <label htmlFor="reg-password">{t('register.password')}</label>
            <input id="reg-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder={t('register.password_placeholder')} disabled={loading} autoComplete="new-password" />
          </div>
          <div className="form-group">
            <label htmlFor="confirm-password">{t('register.confirm_password')}</label>
            <input id="confirm-password" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
              placeholder={t('register.confirm_placeholder')} disabled={loading} autoComplete="new-password" />
          </div>
          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? t('register.loading') : t('register.submit')}
          </button>
        </form>
        <p className="auth-link">
          {t('register.already_account')} <Link to="/login">{t('register.login_link')}</Link>
        </p>
      </div>
    </div>
  );
}
*/
