import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function AuthCallbackPage() {
    const navigate = useNavigate();

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const accessToken = params.get('accessToken');

        if (!accessToken) {
            navigate('/login');
            return;
        }

        localStorage.setItem('token', accessToken);
        navigate('/dashboard');
    }, [navigate]);

    return null;
}

export default AuthCallbackPage;
