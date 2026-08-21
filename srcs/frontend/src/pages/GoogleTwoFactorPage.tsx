import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { OtpVerifyForm } from '../components/OtpVerifyForm';
import { saveSession } from '../lib/session';

function GoogleTwoFactorPage() {
    const navigate = useNavigate();
    const [partialToken] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('partialToken'));

    useEffect(() => {
        window.history.replaceState(null, '', window.location.pathname);
    }, []);

    if (!partialToken) {
        navigate('/login', { replace: true });
        return null;
    }

    return (
        <div className="min-h-screen bg-black flex items-center justify-center">
            <div className="bg-gray-900 p-10 rounded-xl flex flex-col gap-4">
                <h1 className="text-white text-3xl font-bold text-center">DrawDraw</h1>
                <OtpVerifyForm
                    partialToken={partialToken}
                    onVerified={(tokens) => {
                        saveSession(tokens.accessToken, tokens.refreshToken);
                        navigate('/dashboard', { replace: true });
                    }}
                    onCancel={() => navigate('/login', { replace: true })}
                />
            </div>
        </div>
    );
}

export default GoogleTwoFactorPage;
