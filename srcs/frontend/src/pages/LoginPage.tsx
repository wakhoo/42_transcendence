import { useEffect, useState, type SubmitEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { OtpVerifyForm } from '../components/OtpVerifyForm';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { saveSession, getAccessToken } from '../lib/session';

function LoginPage() {
    const [email, setEmail] = useState('');
    const navigate = useNavigate();
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const [step, setStep] = useState<'credentials' | 'otp'>('credentials');
    const [partialToken, setPartialToken] = useState('');
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

    const emailValide = email.includes('@') && email.includes('.');
    const formValide = emailValide && password.length > 0;

    async function handleSubmit(e: SubmitEvent) {
        e.preventDefault();
        try {
                const res = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body:JSON.stringify({ email, password })
                });

                const data = await res.json();
                if (!res.ok) {
                    setError('Login failed');
                    return;
                }

                if (data.twoFactorRequired) {
                    setPartialToken(data.partialToken);
                    setStep('otp');
                    return;
                }

                saveSession(data.accessToken, data.refreshToken);
                navigate('/dashboard');
            }

         catch {
            setError('Unable to contact the server');
        }
    }

    function cancelOtp() {
        setStep('credentials');
        setPartialToken('');
        setError('');
    }

    if (checkingSession)
        return null;

    return (
        <div className="min-h-screen bg-black flex items-center justify-center">
            <div className="bg-gray-900 p-10 rounded-xl flex flex-col gap-4">
                <h1 className="text-white text-3xl font-bold text-center">DrawDraw</h1>
                {error && <p className="text-red-500 text-sm text-center">{error}</p>}
                {step === 'credentials' ? (
                    <>
                        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Email"
                                className="border border-white bg-transparent text-white px-6 py-2 rounded outline-none placeholder-gray-500"
                            />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Password"
                                className="border border-white bg-transparent text-white px-6 py-2 rounded outline-none placeholder-gray-500"
                            />
                            <button
                                type="submit"
                                disabled={!formValide}
                                className={`border px-6 py-2 rounded transition-colors
                                    ${formValide
                                        ? 'border-white text-white hover:bg-white hover:text-black'
                                        : 'border-gray-700 text-gray-700 cursor-not-allowed'}`}>
                                Log in
                            </button>
                        </form>
                        <GoogleSignInButton />
                        <button
                            onClick={() => navigate('/signUp')}
                            className="text-gray-500 text-sm text-center hover:text-white transition-colors">
                            Don't have an account? Sign up
                        </button>
                    </>
                ) : (
                    <OtpVerifyForm
                        partialToken={partialToken}
                        onVerified={(tokens) => {
                            saveSession(tokens.accessToken, tokens.refreshToken);
                            navigate('/dashboard');
                        }}
                        onCancel={cancelOtp}
                    />
                )}
            </div>
        </div>

    );
}

export default LoginPage;