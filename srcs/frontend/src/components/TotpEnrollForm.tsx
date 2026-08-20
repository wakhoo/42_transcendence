import { useEffect, useState, type FormEvent } from 'react';
import { authHeaders } from '../lib/session';

type Props = {
    hasPassword: boolean;
    onEnabled: () => void;
    onCancel: () => void;
};

export function TotpEnrollForm({ hasPassword, onEnabled, onCancel }: Props) {
    const [qrCode, setQrCode] = useState('');
    const [secret, setSecret] = useState('');
    const [code, setCode] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');
    const [emailCode, setEmailCode] = useState('');
    const [emailCodeMsg, setEmailCodeMsg] = useState('');
    const [sendingEmailCode, setSendingEmailCode] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);

    async function requestEmailCode() {
        setSendingEmailCode(true);
        setEmailCodeMsg('');
        try {
            const res = await fetch('/api/user/me/verification-code', { method: 'POST', headers: await authHeaders() });
            const data = await res.json().catch(() => ({}));
            setEmailCodeMsg(res.ok ? 'Code sent — check your email.' : (data.message ?? 'Failed to send code'));
        } finally {
            setSendingEmailCode(false);
        }
    }

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch('/api/auth/2fa/setup', { method: 'POST', headers: await authHeaders() });
                const data = await res.json();
                if (!res.ok) {
                    setError(data.message ?? 'Failed to start 2FA setup');
                    return;
                }
                setQrCode(data.qrCode);
                setSecret(data.secret);
            } catch {
                setError('Unable to contact the server');
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    async function confirmEnable(e: FormEvent) {
        e.preventDefault();
        setError('');
        try {
            const res = await fetch('/api/auth/2fa/enable', {
                method: 'POST',
                headers: await authHeaders(),
                body: JSON.stringify({
                    code,
                    ...(hasPassword ? { currentPassword } : {}),
                    ...(!hasPassword ? { emailCode } : {}),
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError(data.message ?? 'Invalid code');
                return;
            }
            onEnabled();
        } catch {
            setError('Unable to contact the server');
        }
    }

    if (loading) {
        return <p className="text-gray-400 text-sm">Loading...</p>;
    }

    return (
        <div className="flex flex-col gap-3 items-center text-center">
            <p className="text-gray-400 text-xs">Scan with your authenticator app</p>
            {qrCode && <img src={qrCode} alt="2FA QR code" className="rounded bg-white p-2" />}
            {secret && <p className="text-gray-500 text-xs break-all">Manual entry key: {secret}</p>}
            {error && <p className="text-red-500 text-xs">{error}</p>}
            <form onSubmit={confirmEnable} className="flex flex-col gap-3 w-full">
                <input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="6-digit code from your authenticator app"
                    maxLength={6}
                    className="w-full bg-transparent border border-white text-white px-3 py-2 rounded-lg outline-none focus:border-white transition-colors text-sm text-center tracking-widest"
                />
                {hasPassword && (
                    <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Current password"
                        className="w-full bg-transparent border border-white text-white px-3 py-2 rounded-lg outline-none focus:border-white transition-colors text-sm"
                    />
                )}
                {!hasPassword && (
                    <>
                        <button
                            type="button"
                            onClick={requestEmailCode}
                            disabled={sendingEmailCode}
                            className="self-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-colors disabled:opacity-50"
                        >
                            {sendingEmailCode ? 'Sending…' : 'Send code to my email'}
                        </button>
                        {emailCodeMsg && <p className="text-gray-400 text-xs">{emailCodeMsg}</p>}
                        <input
                            value={emailCode}
                            onChange={(e) => setEmailCode(e.target.value)}
                            placeholder="6-digit code from email"
                            maxLength={6}
                            className="w-full bg-transparent border border-white text-white px-3 py-2 rounded-lg outline-none focus:border-white transition-colors text-sm text-center tracking-widest"
                        />
                    </>
                )}
                <div className="flex gap-2 w-full">
                    <button
                        type="submit"
                        disabled={code.length !== 6 || (hasPassword && !currentPassword) || (!hasPassword && emailCode.length !== 6)}
                        className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-950 hover:bg-emerald-900 border border-emerald-800 transition-colors disabled:opacity-50"
                    >
                        Confirm
                    </button>
                    <button
                        type="button"
                        onClick={onCancel}
                        className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-colors"
                    >
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    );
}
