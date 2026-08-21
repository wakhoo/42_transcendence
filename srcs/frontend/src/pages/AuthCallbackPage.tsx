import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { saveSession } from '../lib/session';

function AuthCallbackPage() {
    const navigate = useNavigate();

    useEffect(() => {
        const params = new URLSearchParams(window.location.hash.slice(1));
        const accessToken = params.get('accessToken');
        const refreshToken = params.get('refreshToken');

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
