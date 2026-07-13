import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

function AuthCallback() {

    const [SearchParams] = useSearchParams(); //recupere params de l'url
    const navigate = useNavigate();

    useEffect(() => { 
        const accessToken = SearchParams.get('accessToken');
        const refreshToken = SearchParams.get('refreshToken');

        if (!accessToken || !refreshToken) {
            navigate('/login');
            return;
        }

        localStorage.setItem('token', accessToken);
        localStorage.setItem('refreshToken', refreshToken);
        navigate('/dashboard');
    }, [SearchParams, navigate]);

    return <div className="min-h-screen bg-black" />;
}
export default AuthCallback;