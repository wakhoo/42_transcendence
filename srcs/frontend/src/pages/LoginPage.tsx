import { useState, type SubmitEvent } from 'react'; //variables qui changes
import { useNavigate } from 'react-router-dom';

function LoginPage() {
    const [email, setEmail] = useState('');
    const navigate = useNavigate();
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const emailValide = email.includes('@') && email.includes('.');
    const formValide = emailValide && password.length > 0;

    async function handleSubmit(e: SubmitEvent) {
        e.preventDefault();
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
        localStorage.setItem('token', data.accessToken);
        navigate('/dashboard');
    }

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
                <button
                    onClick={() => navigate(-1)}
                    className="text-gray-500 text-sm text-center hover:text-white transition-colors">
                    ← Back
                </button>
            </div>
        </div>

    );
}

export default LoginPage;