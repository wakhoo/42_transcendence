import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { OtpVerifyForm } from '../components/OtpVerifyForm';
import { saveSession } from '../lib/session';

function GoogleTwoFactorPage() {
    const navigate = useNavigate();
    // Captured once on mount, before the URL gets scrubbed below — the OTP form still needs
    // this value for the lifetime of this page even after it's gone from the address bar.
    const [partialToken] = useState(() => new URLSearchParams(window.location.search).get('partialToken'));

    useEffect(() => {
        // Strip the token out of the URL bar/history immediately — it shouldn't sit there
        // in plain sight (or in browser history) for as long as the user takes to type their code.
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
