import { useState, type SubmitEvent } from 'react';
import { useNavigate } from 'react-router-dom';

function SignUp() {
    const [email, setEmail] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const [showPassword, setShowPassword] = useState(false);

    async function handleSubmit(e: SubmitEvent) {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body:JSON.stringify({ email, username, password })
            });
    
            const data = await res.json();
            if (!res.ok) {
                const message = Array.isArray(data.message) ? data.message.join(', ') : data.message ?? 'Sign up failed';
                setError(message);
                return;
            }

            sessionStorage.setItem('token', data.accessToken);
            sessionStorage.setItem('refreshToken', data.refreshToken);
            navigate('/2fa/prompt');
        } catch {
            setError('Unable to contact the server');
        } finally {
            setLoading(false);
        }
    }
    const emailValide = email.includes('@') && email.includes('.');
    const usernameValide = username.length > 0 && username.length <= 20;
    const passwordValide = password.length >= 8 && password.length <= 128;
    const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;
    const formValide = emailValide && usernameValide && passwordValide && passwordsMatch;

    console.log({ emailValide, usernameValide, passwordValide, passwordsMatch });
    return (
        <div className="min-h-screen bg-black flex items-center justify-center">
            <div className="bg-gray-900 p-10 rounded-xl flex flex-col gap-4">
                <h1 className="text-white text-3xl font-bold text-center">Transcendence</h1>
                {error && <p className="text-red-500 text-sm text-center">{error}</p>}
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Email"
                        className="border border-white bg-transparent text-white px-6 py-2 rounded outline-none placeholder-gray-500"
                    />
                    <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Username"
                        className="border border-white bg-transparent text-white px-6 py-2 rounded outline-none placeholder-gray-500"
                    />
                    <div className="relative">
                        <input
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Password"
                            className="border border-white bg-transparent text-white px-6 py-2 rounded outline-none placeholder-gray-500 w-full pr-16"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword((prev) => !prev)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm hover:text-white">
                            {showPassword ? 'Hide' : 'Show'}
                        </button>
                    </div>
                    <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm password"
                        className="border border-white bg-transparent text-white px-6 py-2 rounded outline-none placeholder-gray-500"
                    />
                    <button
                        type="submit"
                        disabled={!formValide || loading}
                        className={`border px-6 py-2 rounded transition-colors
                            ${formValide && !loading
                                ? 'border-white text-white hover:bg-white hover:text-black'
                                : 'border-gray-700 text-gray-700 cursor-not-allowed'}`}>
                        {loading ? 'Creating account...' : 'Sign up'}
                    </button>
                </form>
                <button
                    onClick={() => navigate(-1)}
                    className="text-gray-500 text-sm text-center hover:text-white transition-colors">
                    ← Back
                </button>
            </div>
        </div>
    );
}

export default SignUp;