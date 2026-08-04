import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { saveSession } from '../lib/session';

function AuthCallbackPage() {
    const navigate = useNavigate();

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const accessToken = params.get('accessToken');
        const refreshToken = params.get('refreshToken');

        // Strip the token out of the URL bar/history immediately, before doing anything else
        // with it — it shouldn't linger anywhere it could be logged or replayed from history.
        window.history.replaceState(null, '', window.location.pathname);

        if (!accessToken || !refreshToken) {
            navigate('/login', { replace: true });
            return;
        }

        saveSession(accessToken, refreshToken);
        navigate('/dashboard', { replace: true });
    }, [navigate]);

    return null;
}

export default AuthCallbackPage;
