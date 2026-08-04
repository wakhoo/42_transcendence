import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAccessToken } from '../lib/session';
import { GoogleSignInButton } from '../components/GoogleSignInButton';

function HomePage() {
    const navigate = useNavigate();
    const [checkingSession, setCheckingSession] = useState(true);

    useEffect(() => {
        (async () => {
            const token = await getAccessToken();
            if (token) {
                navigate('/dashboard', { replace: true });
                return;
            }
            setCheckingSession(false);
        })();
    }, [navigate]);

    if (checkingSession)
        return null;

    return (
        <div className="min-h-screen bg-black flex items-center justify-center">
            <div className="bg-gray-900 p-10 rounded-xl flex flex-col gap-4">
                <h1 className="text-white text-3xl font-bold text-center">Ft_Skribbl</h1>
                <button
                    onClick={() => navigate('/login')} 
                    className="border border-white text-white px-6 py-2 rounded hover:bg-white hover:text-black">
                    Log in
                </button>
                <button
                onClick={() => navigate('/signUp')} 
                className="border border-white text-white px-6 py-2 rounded hover:bg-white hover:text-black">
                sign up
                </button>
                <GoogleSignInButton />
            </div>
        </div>
    );
}

export default HomePage;