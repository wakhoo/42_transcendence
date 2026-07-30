import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AvatarPicker } from '../components/AvatarPicker';
import { TotpEnrollForm } from '../components/TotpEnrollForm';

type Me = {
    id: number;
    username: string;
    email: string;
    profileColor: string;
    avatarUrl: string | null;
    createdAt: string;
    totpEnabled: boolean;
    hasPassword: boolean;
};

type PublicUser = {
    id: number; 
    username: string; 
    profileColor: string; 
    avatarUrl: string | null; 
};

type FriendUser = { 
    id: number; 
    username: string; 
    profileColor: string; 
};

type Friendship = { 
    id: number; 
    status: 'pending' | 'accepted' | 'blocked'; 
    requester: FriendUser; 
    addressee: FriendUser; 
};

function authHeaders() {
    const token = sessionStorage.getItem('token');
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }; //vu qu'on envoie une requette avec un body faut mettre dans le header que c'est un json
}

export function ProfileContent({ userId }: { userId?: number }) {
    const [me, setMe]             = useState<Me | null>(null);
    const [allUsers, setAllUsers] = useState<PublicUser[]>([]);
    const [friends, setFriends]   = useState<Friendship[]>([]);
    const [pending, setPending]   = useState<Friendship[]>([]);
    const [username, setUsername] = useState('');
    const [email, setEmail]       = useState('');
    const [msg, setMsg]           = useState('');
    const navigate                = useNavigate();

    const [totpAction, setTotpAction] = useState<'none' | 'enable' | 'confirmDisable'>('none');
    const [totpCode, setTotpCode]     = useState('');
    const [totpError, setTotpError]   = useState('');

    const [awaitingProfileCode, setAwaitingProfileCode] = useState(false);
    const [profileCode, setProfileCode]                 = useState('');

    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deletePassword, setDeletePassword]       = useState('');
    const [deleteCode, setDeleteCode]               = useState('');
    const [deleteError, setDeleteError]             = useState('');

    const [pendingExportIntent, setPendingExportIntent] = useState<'download' | 'view' | null>(null);
    const [exportCode, setExportCode]                   = useState('');
    const [exportError, setExportError]                 = useState('');
    const [exportLoading, setExportLoading]             = useState(false);
    const [showExportModal, setShowExportModal]         = useState(false);
    const [exportData, setExportData]                   = useState<unknown>(null);

    const [showPasswordForm, setShowPasswordForm] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword]         = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordCode, setPasswordCode]       = useState('');
    const [awaitingPasswordCode, setAwaitingPasswordCode] = useState(false);
    const [passwordMsg, setPasswordMsg]         = useState('');
    const [passwordError, setPasswordError]     = useState('');

    async function loadAll() {
        const token = sessionStorage.getItem('token');
        if (!token) {
            navigate('/login');
            return; 
        }

        const [meRes, usersRes, friendsRes, pendingRes] = await Promise.all([ //ici je lance les requetes en meme temps (multi threading) et j'attends qu'elles aient toutes repondues
            fetch('/api/user/me',               { headers: authHeaders() }),
            fetch('/api/user',                  { headers: authHeaders() }),
            fetch('/api/chat/friends',          { headers: authHeaders() }),
            fetch('/api/chat/friends/pending',  { headers: authHeaders() }),
        ]);

        if (!meRes.ok) { //utile si token expire ou si le back ne repond pas
            navigate('/login'); 
            return; 
        }

        const meData: Me                = await meRes.json();
        const usersData: PublicUser[]   = usersRes.ok   ? await usersRes.json()   : [];
        const friendsData: Friendship[] = friendsRes.ok ? await friendsRes.json() : [];
        const pendingData: Friendship[] = pendingRes.ok ? await pendingRes.json() : [];

        setMe(meData);
        setUsername(meData.username);
        setEmail(meData.email);
        setAllUsers(usersData);
        setFriends(friendsData);
        setPending(pendingData);
    }

    useEffect(() => { loadAll(); }, []); // le [] c'est pour lancer loadAll au demarage

    async function saveProfile(code?: string) {
        const changingIdentity = me != null && (username !== me.username || email !== me.email);
        if (changingIdentity && me?.totpEnabled && !code) {
            setAwaitingProfileCode(true);
            return;
        }

        const res = await fetch('/api/user/me', {
            method: 'PATCH',
            headers: authHeaders(),
            body: JSON.stringify(code ? { username, email, code } : { username, email }),
        }); //stringify c'est pour transformer en json
        const data = await res.json();
        if (res.ok) {  //res.ok veut dire que le code http est compris entre 200 et 299 donc que tout s'est bien passe
            setMe(data);
            setMsg('Profile updated');
            setAwaitingProfileCode(false);
            setProfileCode('');
            window.location.reload();
        }
        else setMsg(data.message ?? 'Error'); //dans le json de la requete retour message contient le code http et le message d'erreur lance par mes exceptions
    }

    function cancelProfileCode() {
        setAwaitingProfileCode(false);
        setProfileCode('');
    }

    async function handleDeleteAccount(e: FormEvent) {
        e.preventDefault();
        setDeleteError('');
        const res = await fetch('/api/user/me', {
            method: 'DELETE',
            headers: authHeaders(),
            body: JSON.stringify({
                ...(deletePassword ? { password: deletePassword } : {}),
                ...(deleteCode ? { code: deleteCode } : {}),
            }),
        });
        if (res.ok) {
            sessionStorage.removeItem('token');
            navigate('/login');
            return;
        }
        const data = await res.json().catch(() => ({}));
        setDeleteError(data.message ?? 'Failed to delete account');
    }

    function cancelDelete() {
        setShowDeleteConfirm(false);
        setDeletePassword('');
        setDeleteCode('');
        setDeleteError('');
    }

    async function changePassword(code?: string) {
        setPasswordError('');
        setPasswordMsg('');

        if (newPassword !== confirmPassword) {
            setPasswordError('New passwords do not match');
            return;
        }

        if (me?.totpEnabled && !code) {
            setAwaitingPasswordCode(true);
            return;
        }

        const res = await fetch('/api/user/me/password', {
            method: 'PATCH',
            headers: authHeaders(),
            body: JSON.stringify({
                ...(currentPassword ? { currentPassword } : {}),
                newPassword,
                ...(code ? { code } : {}),
            }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
            setPasswordMsg('Password updated');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setPasswordCode('');
            setAwaitingPasswordCode(false);
        } else {
            setPasswordError(data.message ?? 'Failed to update password');
        }
    }

    function cancelPasswordCode() {
        setAwaitingPasswordCode(false);
        setPasswordCode('');
    }

    function handleLogout() {
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('refreshToken');
        navigate('/login');
    }

    function downloadExportFile(data: unknown) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'my-data-export.json';
        a.click();
        URL.revokeObjectURL(url);
    }

    async function runExport(intent: 'download' | 'view', code?: string) {
        setExportLoading(true);
        setExportError('');
        try {
            const url = code ? `/api/user/me/export?code=${encodeURIComponent(code)}` : '/api/user/me/export';
            const res = await fetch(url, { headers: authHeaders() });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setExportError(data.message ?? 'Failed to export data');
                return;
            }
            if (intent === 'download') {
                downloadExportFile(data);
            } else {
                setExportData(data);
                setShowExportModal(true);
            }
            setPendingExportIntent(null);
            setExportCode('');
        } catch {
            setExportError('Unable to contact the server');
        } finally {
            setExportLoading(false);
        }
    }

    function startExport(intent: 'download' | 'view') {
        setExportError('');
        if (me?.totpEnabled) {
            setPendingExportIntent(intent);
            return;
        }
        runExport(intent);
    }

    async function confirmExportCode(e: FormEvent) {
        e.preventDefault();
        if (!pendingExportIntent) return;
        await runExport(pendingExportIntent, exportCode);
    }

    function cancelExportCode() {
        setPendingExportIntent(null);
        setExportCode('');
        setExportError('');
    }

    async function addFriend(userId: number) {
        const res = await fetch(`/api/chat/friends/${userId}`, { method: 'POST', headers: authHeaders() });
        const data = await res.json();
        setMsg(res.ok ? 'Invitation sent' : (data.message ?? 'Error'));
        if (res.ok) 
            loadAll();
    }

    async function acceptFriend(friendshipId: number) {
        const res = await fetch(`/api/chat/friends/${friendshipId}/accept`, { method: 'PATCH', headers: authHeaders() });
        setMsg(res.ok ? 'Friend accepted' : 'Error');
        if (res.ok) 
            loadAll();
    }

    async function removeFriend(friendshipId: number) {
        await fetch(`/api/chat/friends/${friendshipId}`, { method: 'DELETE', headers: authHeaders() });
        loadAll();
    }

    async function handleAvatarSelect(avatarUrl: string) {
        const res = await fetch('/api/user/me', { method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ avatarUrl }) });
        const data = await res.json();
        if (res.ok) {
            setMe(data);
            setMsg('Avatar updated');
        }
    }

    async function confirmDisable2fa(e: FormEvent) {
        e.preventDefault();
        setTotpError('');
        const res = await fetch('/api/auth/2fa/disable', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ code: totpCode }) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            setTotpError(data.message ?? 'Invalid code');
            return;
        }
        setMe(prev => prev ? { ...prev, totpEnabled: false } : prev);
        setTotpAction('none');
        setTotpCode('');
    }

    function cancelTotpFlow() {
        setTotpAction('none');
        setTotpCode('');
        setTotpError('');
    }

    function friendOf(f: Friendship) { //fonction qui permet de savoir si la personne a envoye la demande ou l'a recu
        if (f.requester.id === me?.id)
            return f.addressee;
        return f.requester;
    }

    if (!me)
        return <p>Loading...</p>;

    const isMe = userId == null || userId === me.id;
    const targetUser = isMe ? me : allUsers.find(u => u.id === userId);

    if (!isMe && !targetUser) 
        return <p>User not found</p>;

    const myFriendship = !isMe ? friends.find(f => friendOf(f).id === targetUser!.id) : undefined;
    const incomingRequest = !isMe ? pending.find(f => f.requester.id === targetUser!.id) : undefined;

    const acceptedIds = friends.map(f => friendOf(f).id); //on choppe ici un tableau d'ID de frienduser deja amis
    const pendingIds  = pending.map(f => f.requester.id); //idem avec les demandes en cours
    const friendIds   = new Set([...acceptedIds, ...pendingIds]); //on fusionne les deux tableaux d'ID dans un set
    
    const strangers = allUsers.filter(u => u.id !== me?.id && !friendIds.has(u.id)); //dans strangers on exclus de AllUsers nous meme nos amis et les demandes en cours

    const passwordChecks = [
        { label: 'At least 8 characters', met: newPassword.length >= 8 },
        { label: 'Passwords match', met: newPassword.length > 0 && newPassword === confirmPassword },
    ];
    const passwordChecksPassed = passwordChecks.every(c => c.met);

    return (
        <div className="text-white">
            {msg && (
                <div className="mb-4 bg-emerald-950 border border-emerald-800 text-emerald-300 text-sm px-4 py-2 rounded-lg">
                    {msg}
                </div>
            )}

            {isMe ? (
                <>
                    <div className="flex items-center gap-3 mb-6">
                        <AvatarPicker
                            currentAvatar={me.avatarUrl}
                            profileColor={me.profileColor}
                            onSelect={handleAvatarSelect}
                        />
                        <div>
                            <h2 className="text-lg font-bold">{me.username}</h2>
                            <p className="text-gray-500 text-xs">ID #{me.id}</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => startExport('download')}
                                title="Export my data"
                                aria-label="Export my data"
                                className="px-2 py-1 rounded-lg bg-gray-900 border border-gray-700 hover:bg-gray-800 transition-colors text-xs text-gray-300"
                            >
                                Export ⬆️
                            </button>
                            <button
                                onClick={() => startExport('view')}
                                title="View my data"
                                aria-label="View my data"
                                className="px-2 py-1 rounded-lg bg-gray-900 border border-gray-700 hover:bg-gray-800 transition-colors text-xs text-gray-300"
                            >
                                View info 🔍
                            </button>
                        </div>
                        <button
                            onClick={handleLogout}
                            title="Log out"
                            aria-label="Log out"
                            className="px-2 py-1 rounded-lg bg-gray-900 border border-gray-700 hover:bg-gray-800 transition-colors text-xs text-gray-300"
                        >
                            Logout 🚪
                        </button>
                    </div>

                    {pendingExportIntent && (
                        <form onSubmit={confirmExportCode} className="flex flex-col gap-2 mb-4 bg-black rounded-xl border border-gray-800 p-3">
                            <p className="text-yellow-400 text-xs">
                                Enter your 2FA code to {pendingExportIntent === 'download' ? 'export' : 'view'} your data.
                            </p>
                            {exportError && <p className="text-red-500 text-xs">{exportError}</p>}
                            <input
                                value={exportCode}
                                onChange={e => setExportCode(e.target.value)}
                                placeholder="6-digit code"
                                maxLength={6}
                                className="w-full bg-gray-900 border border-gray-700 text-white px-3 py-2 rounded-lg outline-none focus:border-white transition-colors text-sm text-center tracking-widest"
                            />
                            <div className="flex gap-2">
                                <button
                                    type="submit"
                                    disabled={exportCode.length !== 6 || exportLoading}
                                    className="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-950 hover:bg-blue-900 border border-blue-800 transition-colors disabled:opacity-50"
                                >
                                    Confirm
                                </button>
                                <button
                                    type="button"
                                    onClick={cancelExportCode}
                                    className="px-4 py-2 rounded-lg text-sm font-semibold bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    )}
                    {exportError && !pendingExportIntent && (
                        <p className="text-red-500 text-xs mb-4">{exportError}</p>
                    )}

                    <div className="bg-black rounded-xl border border-gray-800 p-4 mb-4 flex flex-col gap-3">
                        <label className="text-gray-400 text-xs">
                            Username
                            <input
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                className="mt-1 w-full bg-gray-900 border border-gray-700 text-white px-3 py-2 rounded-lg outline-none focus:border-white transition-colors text-sm"
                            />
                        </label>
                        <label className="text-gray-400 text-xs">
                            Email
                            <input
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                className="mt-1 w-full bg-gray-900 border border-gray-700 text-white px-3 py-2 rounded-lg outline-none focus:border-white transition-colors text-sm"
                            />
                        </label>
                        {!awaitingProfileCode && (
                            <button
                                onClick={() => saveProfile()}
                                className="self-start px-4 py-2 rounded-lg text-sm font-semibold bg-blue-950 hover:bg-blue-900 border border-blue-800 transition-colors"
                            >
                                Save
                            </button>
                        )}
                        {awaitingProfileCode && (
                            <form
                                onSubmit={e => { e.preventDefault(); saveProfile(profileCode); }}
                                className="flex flex-col gap-3"
                            >
                                <p className="text-yellow-400 text-xs">Enter your 2FA code to confirm this change.</p>
                                <input
                                    value={profileCode}
                                    onChange={e => setProfileCode(e.target.value)}
                                    placeholder="6-digit code"
                                    maxLength={6}
                                    className="w-full bg-gray-900 border border-gray-700 text-white px-3 py-2 rounded-lg outline-none focus:border-white transition-colors text-sm text-center tracking-widest"
                                />
                                <div className="flex gap-2">
                                    <button
                                        type="submit"
                                        disabled={profileCode.length !== 6}
                                        className="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-950 hover:bg-blue-900 border border-blue-800 transition-colors disabled:opacity-50"
                                    >
                                        Confirm
                                    </button>
                                    <button
                                        type="button"
                                        onClick={cancelProfileCode}
                                        className="px-4 py-2 rounded-lg text-sm font-semibold bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>

                    <div className="bg-black rounded-xl border border-gray-800 p-4 mb-4 flex flex-col gap-3">
                        <button
                            onClick={() => setShowPasswordForm(prev => !prev)}
                            className="flex items-center justify-between text-left"
                        >
                            <p className="text-sm font-semibold">Change Password</p>
                            <span className="text-gray-500 text-xs">{showPasswordForm ? '▲' : '▼'}</span>
                        </button>

                        {showPasswordForm && (
                            <>
                                {passwordMsg && <p className="text-emerald-400 text-xs">{passwordMsg}</p>}
                                {passwordError && <p className="text-red-500 text-xs">{passwordError}</p>}

                                {!awaitingPasswordCode ? (
                                    <>
                                        {me.hasPassword && (
                                            <label className="text-gray-400 text-xs">
                                                Current password
                                                <input
                                                    type="password"
                                                    value={currentPassword}
                                                    onChange={e => setCurrentPassword(e.target.value)}
                                                    className="mt-1 w-full bg-gray-900 border border-gray-700 text-white px-3 py-2 rounded-lg outline-none focus:border-white transition-colors text-sm"
                                                />
                                            </label>
                                        )}
                                        <label className="text-gray-400 text-xs">
                                            New password
                                            <input
                                                type="password"
                                                value={newPassword}
                                                onChange={e => setNewPassword(e.target.value)}
                                                className="mt-1 w-full bg-gray-900 border border-gray-700 text-white px-3 py-2 rounded-lg outline-none focus:border-white transition-colors text-sm"
                                            />
                                        </label>
                                        <label className="text-gray-400 text-xs">
                                            Confirm new password
                                            <input
                                                type="password"
                                                value={confirmPassword}
                                                onChange={e => setConfirmPassword(e.target.value)}
                                                className="mt-1 w-full bg-gray-900 border border-gray-700 text-white px-3 py-2 rounded-lg outline-none focus:border-white transition-colors text-sm"
                                            />
                                        </label>
                                        <ul className="flex flex-col gap-1">
                                            {passwordChecks.map(c => (
                                                <li
                                                    key={c.label}
                                                    className={`text-xs transition-colors ${c.met ? 'text-emerald-400' : 'text-gray-500'}`}
                                                >
                                                    {c.met ? '✓' : '○'} {c.label}
                                                </li>
                                            ))}
                                        </ul>
                                        <button
                                            onClick={() => changePassword()}
                                            disabled={(me.hasPassword && !currentPassword) || !passwordChecksPassed}
                                            className="self-start px-4 py-2 rounded-lg text-sm font-semibold bg-blue-950 hover:bg-blue-900 border border-blue-800 transition-colors disabled:opacity-50"
                                        >
                                            Change password
                                        </button>
                                    </>
                                ) : (
                                    <form
                                        onSubmit={e => { e.preventDefault(); changePassword(passwordCode); }}
                                        className="flex flex-col gap-3"
                                    >
                                        <p className="text-yellow-400 text-xs">Enter your 2FA code to confirm this change.</p>
                                        <input
                                            value={passwordCode}
                                            onChange={e => setPasswordCode(e.target.value)}
                                            placeholder="6-digit code"
                                            maxLength={6}
                                            className="w-full bg-gray-900 border border-gray-700 text-white px-3 py-2 rounded-lg outline-none focus:border-white transition-colors text-sm text-center tracking-widest"
                                        />
                                        <div className="flex gap-2">
                                            <button
                                                type="submit"
                                                disabled={passwordCode.length !== 6}
                                                className="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-950 hover:bg-blue-900 border border-blue-800 transition-colors disabled:opacity-50"
                                            >
                                                Confirm
                                            </button>
                                            <button
                                                type="button"
                                                onClick={cancelPasswordCode}
                                                className="px-4 py-2 rounded-lg text-sm font-semibold bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-colors"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </form>
                                )}
                            </>
                        )}
                    </div>

                    <div className="bg-black rounded-xl border border-gray-800 p-4 mb-4 flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-semibold">Two-Factor Authentication</p>
                                <p className="text-gray-500 text-xs">{me.totpEnabled ? 'Enabled' : 'Disabled'}</p>
                            </div>
                            {totpAction === 'none' && (
                                me.totpEnabled ? (
                                    <button
                                        onClick={() => setTotpAction('confirmDisable')}
                                        className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-950 hover:bg-red-900 border border-red-800 text-red-300 transition-colors"
                                    >
                                        Turn off
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => setTotpAction('enable')}
                                        className="px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-950 hover:bg-emerald-900 border border-emerald-800 transition-colors"
                                    >
                                        Turn on
                                    </button>
                                )
                            )}
                        </div>

                        {totpError && <p className="text-red-500 text-xs">{totpError}</p>}

                        {totpAction === 'enable' && (
                            <TotpEnrollForm
                                onEnabled={() => {
                                    setMe(prev => prev ? { ...prev, totpEnabled: true } : prev);
                                    setTotpAction('none');
                                }}
                                onCancel={cancelTotpFlow}
                            />
                        )}

                        {totpAction === 'confirmDisable' && (
                            <div className="flex flex-col gap-3">
                                <p className="text-yellow-400 text-xs">Are you sure you want to turn off 2FA? Enter your current code to confirm.</p>
                                <form onSubmit={confirmDisable2fa} className="flex flex-col gap-3 items-center text-center">
                                    <input
                                        value={totpCode}
                                        onChange={e => setTotpCode(e.target.value)}
                                        placeholder="6-digit code"
                                        maxLength={6}
                                        className="w-full bg-gray-900 border border-gray-700 text-white px-3 py-2 rounded-lg outline-none focus:border-white transition-colors text-sm text-center tracking-widest"
                                    />
                                    <div className="flex gap-2 w-full">
                                        <button
                                            type="submit"
                                            disabled={totpCode.length !== 6}
                                            className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold bg-red-950 hover:bg-red-900 border border-red-800 text-red-300 transition-colors disabled:opacity-50"
                                        >
                                            Confirm turn off
                                        </button>
                                        <button
                                            type="button"
                                            onClick={cancelTotpFlow}
                                            className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </form>
                            </div>
                        )}
                    </div>

                    <h3 className="text-gray-400 text-xs uppercase tracking-wide mb-2">Friend request ({pending.length})</h3>
                    <div className="flex flex-col gap-2 mb-4">
                        {pending.length === 0 && <p className="text-gray-600 text-sm">None</p>}
                        {pending.map(f => (
                            <div key={f.id} className="flex items-center gap-3 bg-black rounded-lg border border-gray-800 px-3 py-2">
                                <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: f.requester.profileColor }} />
                                <span className="text-sm flex-1 truncate">{f.requester.username}</span>
                                <button onClick={() => acceptFriend(f.id)} className="px-2 py-1 rounded-md text-xs font-semibold bg-emerald-950 hover:bg-emerald-900 border border-emerald-800 transition-colors">Accept</button>
                                <button onClick={() => removeFriend(f.id)} className="px-2 py-1 rounded-md text-xs font-semibold bg-red-950 hover:bg-red-900 border border-red-800 text-red-300 transition-colors">Decline</button>
                            </div>
                        ))}
                    </div>

                    <h3 className="text-gray-400 text-xs uppercase tracking-wide mb-2">Friends ({friends.length})</h3>
                    <div className="flex flex-col gap-2 mb-4">
                        {friends.length === 0 && <p className="text-gray-600 text-sm">None</p>}
                        {friends.map(f => {
                            const friend = friendOf(f);
                            return (
                                <div key={f.id} className="flex items-center gap-3 bg-black rounded-lg border border-gray-800 px-3 py-2">
                                    <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: friend.profileColor }} />
                                    <span className="text-sm flex-1 truncate">{friend.username}</span>
                                    <button onClick={() => removeFriend(f.id)} className="px-2 py-1 rounded-md text-xs font-semibold bg-red-950 hover:bg-red-900 border border-red-800 text-red-300 transition-colors">Remove</button>
                                </div>
                            );
                        })}
                    </div>

                    <h3 className="text-gray-400 text-xs uppercase tracking-wide mb-2">Add a friend ({strangers.length})</h3>
                    <div className="flex flex-col gap-2">
                        {strangers.length === 0 && <p className="text-gray-600 text-sm">No players availabled</p>}
                        {strangers.map(u => (
                            <div key={u.id} className="flex items-center gap-3 bg-black rounded-lg border border-gray-800 px-3 py-2">
                                <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: u.profileColor }} />
                                <span className="text-sm flex-1 truncate">{u.username}</span>
                                <button onClick={() => addFriend(u.id)} className="px-2 py-1 rounded-md text-xs font-semibold bg-blue-950 hover:bg-blue-900 border border-blue-800 transition-colors">+ Add</button>
                            </div>
                        ))}
                    </div>

                    <div className="mt-6 bg-black rounded-xl border border-red-900 p-4 flex flex-col gap-3">
                        <div>
                            <p className="text-sm font-semibold text-red-400">Delete Account</p>
                            <p className="text-gray-500 text-xs">This permanently deletes your account and all associated data.</p>
                        </div>

                        {!showDeleteConfirm ? (
                            <button
                                onClick={() => setShowDeleteConfirm(true)}
                                className="self-start px-4 py-2 rounded-lg text-sm font-semibold bg-red-950 hover:bg-red-900 border border-red-800 text-red-300 transition-colors"
                            >
                                Delete my account
                            </button>
                        ) : (
                            <form onSubmit={handleDeleteAccount} className="flex flex-col gap-3">
                                <p className="text-yellow-400 text-xs">
                                    This cannot be undone.
                                    {me.hasPassword && me.totpEnabled && ' Confirm your password and 2FA code to proceed.'}
                                    {me.hasPassword && !me.totpEnabled && ' Confirm your password to proceed.'}
                                    {!me.hasPassword && me.totpEnabled && ' Confirm your 2FA code to proceed.'}
                                    {!me.hasPassword && !me.totpEnabled && ' Confirm to proceed.'}
                                </p>
                                {deleteError && <p className="text-red-500 text-xs">{deleteError}</p>}
                                {me.hasPassword && (
                                    <input
                                        type="password"
                                        value={deletePassword}
                                        onChange={e => setDeletePassword(e.target.value)}
                                        placeholder="Password"
                                        className="w-full bg-gray-900 border border-gray-700 text-white px-3 py-2 rounded-lg outline-none focus:border-white transition-colors text-sm"
                                    />
                                )}
                                {me.totpEnabled && (
                                    <input
                                        value={deleteCode}
                                        onChange={e => setDeleteCode(e.target.value)}
                                        placeholder="6-digit 2FA code"
                                        maxLength={6}
                                        className="w-full bg-gray-900 border border-gray-700 text-white px-3 py-2 rounded-lg outline-none focus:border-white transition-colors text-sm text-center tracking-widest"
                                    />
                                )}
                                <div className="flex gap-2">
                                    <button
                                        type="submit"
                                        disabled={(me.hasPassword && !deletePassword) || (me.totpEnabled && deleteCode.length !== 6)}
                                        className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-950 hover:bg-red-900 border border-red-800 text-red-300 transition-colors disabled:opacity-50"
                                    >
                                        Confirm delete
                                    </button>
                                    <button
                                        type="button"
                                        onClick={cancelDelete}
                                        className="px-4 py-2 rounded-lg text-sm font-semibold bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </>
            ) : (
                <div className="flex flex-col items-center text-center gap-4 py-4">
                    <div
                        className="w-20 h-20 rounded-2xl border-4"
                        style={{ backgroundColor: targetUser!.profileColor, borderColor: targetUser!.profileColor + '55' }}
                    />
                    <h2 className="text-xl font-bold">{targetUser!.username}</h2>

                    {myFriendship && (
                        <button
                            onClick={() => removeFriend(myFriendship.id)}
                            className="px-6 py-2 rounded-lg text-sm font-semibold bg-red-950 hover:bg-red-900 border border-red-800 text-red-300 transition-colors"
                        >
                            Unfriend
                        </button>
                    )}
                    {!myFriendship && incomingRequest && (
                        <div className="flex gap-2">
                            <button onClick={() => acceptFriend(incomingRequest.id)} className="px-6 py-2 rounded-lg text-sm font-semibold bg-emerald-950 hover:bg-emerald-900 border border-emerald-800 transition-colors">Accept</button>
                            <button onClick={() => removeFriend(incomingRequest.id)} className="px-6 py-2 rounded-lg text-sm font-semibold bg-red-950 hover:bg-red-900 border border-red-800 text-red-300 transition-colors">Decline</button>
                        </div>
                    )}
                    {!myFriendship && !incomingRequest && (
                        <button
                            onClick={() => addFriend(targetUser!.id)}
                            className="px-6 py-2 rounded-lg text-sm font-semibold bg-emerald-950 hover:bg-emerald-900 border border-emerald-800 transition-colors"
                        >
                            + Add friend
                        </button>
                    )}
                </div>
            )}

            {showExportModal && (
                <div
                    className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
                    onClick={() => setShowExportModal(false)}
                >
                    <div
                        className="bg-gray-900 rounded-xl border border-gray-700 max-w-lg w-full max-h-[80vh] flex flex-col"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between shrink-0">
                            <h3 className="text-white font-semibold text-sm">Your Data</h3>
                            <button
                                onClick={() => setShowExportModal(false)}
                                className="text-gray-400 hover:text-white text-sm"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="overflow-y-auto p-4">
                            <pre className="text-gray-300 text-xs whitespace-pre-wrap break-all">
                                {JSON.stringify(exportData, null, 2)}
                            </pre>
                            <button
                                onClick={() => downloadExportFile(exportData)}
                                className="mt-4 w-full px-4 py-2 rounded-lg text-sm font-semibold bg-blue-950 hover:bg-blue-900 border border-blue-800 transition-colors"
                            >
                                ⬇️ Export data
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function ProfilePage() {
    const navigate = useNavigate();
    return (
        <div className="min-h-screen bg-[linear-gradient(135deg,#29323C,#2B5876,#4E4376)] px-4 py-6 md:py-10">
            <div className="max-w-lg mx-auto">
                <button
                    onClick={() => navigate('/dashboard')}
                    className="text-gray-300 hover:text-white text-sm mb-4"
                >
                    ← Dashboard
                </button>
                <h1 className="text-white text-xl md:text-2xl font-bold mb-4">Profile</h1>
                <ProfileContent />
            </div>
        </div>
    );
}