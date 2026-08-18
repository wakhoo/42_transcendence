import { useState, type FormEvent } from 'react';

type Tokens = { accessToken: string; refreshToken: string };

type Props = {
    partialToken: string;
    onVerified: (tokens: Tokens) => void;
    onCancel: () => void;
};

export function OtpVerifyForm({ partialToken, onVerified, onCancel }: Props) {
    const [code, setCode] = useState('');
    const [error, setError] = useState('');

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setError('');
        try {
            const res = await fetch('/api/auth/2fa/verify', {
                method: 'POST',
                headers: { Authorization: `Bearer ${partialToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ code }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError(data.message ?? 'Invalid code');
                return;
            }
            onVerified(data);
        } catch {
            setError('Unable to contact the server');
        }
    }

    return (
        <>
            <p className="text-gray-400 text-sm text-center">Enter the 6-digit code from your authenticator app.</p>
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="6-digit code"
                    maxLength={6}
                    className="border border-white bg-transparent text-white px-6 py-2 rounded outline-none placeholder-gray-500 text-center tracking-widest"
                />
                <button
                    type="submit"
                    disabled={code.length !== 6}
                    className={`border px-6 py-2 rounded transition-colors
                        ${code.length === 6
                            ? 'border-white text-white hover:bg-white hover:text-black'
                            : 'border-gray-700 text-gray-700 cursor-not-allowed'}`}>
                    Verify
                </button>
            </form>
            <button
                onClick={onCancel}
                className="text-gray-500 text-sm text-center hover:text-white transition-colors">
                ← Back
            </button>
        </>
    );
}
