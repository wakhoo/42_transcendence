import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { ProfileContent } from './ProfilePage';
import { useChatCommands } from '../hooks/useChatCommands';
import { getAccessToken, authHeaders, clearSession } from '../lib/session';
import Footer from '../components/Footer';
import DrawDrawLogo from '../components/DrawDraw';

type Message = {
    id: number;
    content: string;
    createdAt: string;
    sender: { id: number; username: string; profileColor: string } | null;
    role?: 'admin' | 'member';
    channelId?: number;
    isDm?: boolean;
};

type UserProfile = {
    id: number;
    username: string;
    profileColor: string;
    avatarUrl: string | null;
};

type GameRoom = {
    id: number;
    name: string;
    type: string;
    isPrivate: boolean;
    passwordHash: string | null;
    maxMembers: number | null;
    members: any[];
    isUserMember: boolean;
    isUserKicked: boolean;
    maxRound?: number;
};

export default function DashboardPage() {
    const [users, setUsers]                             = useState<UserProfile[]>([]);
    const [messages, setMessages]                       = useState<Message[]>([]);
    const [input, setInput]                             = useState('');
    const [channelId, setChannelId]                     = useState<number | null>(null);
    const [typing, setTyping]                           = useState('');
    const socketRef                                     = useRef<Socket | null>(null);
    const { handleCommand, cmdMsg, error, setError }    = useChatCommands(channelId, users, socketRef);
    const bottomRef                                     = useRef<HTMLDivElement>(null);
    const typingTimer                                   = useRef<ReturnType<typeof setTimeout> | null>(null);
    const navigate                                      = useNavigate();
    const [openProfileId, setOpenProfileId]             = useState<number | null>(null);
    const [onlineUserIds, setOnlineUserId]              = useState<Set<number>>(new Set());
    const [showMyProfile, setShowMyProfile]             = useState<boolean>(false);
    const [showUsers, setShowUsers]                     = useState<boolean>(false);
    const [showCreateModal, setShowCreateModal]         = useState(false);
    const [createMaxPlayers, setCreateMaxPlayers]       = useState('');
    const [createPassword, setCreatePassword]           = useState('');
    const [createPrivate, setCreatePrivate]             = useState(false);
    const [createRounds, setCreateRounds]               = useState('');
    const [gameRooms, setGameRooms]                     = useState<GameRoom[]>([]);
    const [joinPwdRoomId, setJoinPwdRoomId]             = useState<number | null>(null);
    const [joinPwdInput, setJoinPwdInput]               = useState('');

    const loadGameRooms = useCallback(async () => {
        const res = await fetch('/api/chat/game-rooms', { headers: await authHeaders() });
        if (!res.ok) {
            console.warn('loadGameRooms failed', res.status);
            return;
        }
        const data = await res.json();
        if (Array.isArray(data))
            setGameRooms(data);
    }, []);

    const loadUsers = useCallback(async () => {
        const r = await fetch('/api/user', { headers: await authHeaders() });
        if (r.status === 401) {
            clearSession();
            navigate('/login');
            return;
        }
        if (!r.ok) {
            console.warn('loadUsers failed', r.status);
            return;
        }
        const data: UserProfile[] = await r.json();
        if (Array.isArray(data)) setUsers(data);
    }, [navigate]);

    useEffect(() => {
        (async () => {
            const token = await getAccessToken();
            if (!token) {
                navigate('/login');
                return;
            }
            loadUsers();
        })();
    }, [loadUsers, navigate])

    useEffect(() => {
        let socket: Socket | null = null;
        let cancelled = false;

        (async () => {
            const token = await getAccessToken();
            if (!token) {
                navigate('/login');
                return;
            }
            if (cancelled)
                return;

            socket = io(`${window.location.origin}/chat`, { auth: { token } });
            socketRef.current = socket;

            socket.on('ready', ({ generalChannelId, onlineUserIds }: { generalChannelId: number, onlineUserIds: number[] }) => {
                setChannelId(generalChannelId);
                setOnlineUserId(new Set(onlineUserIds));

                authHeaders().then(headers =>
                    fetch(`/api/chat/channels/${generalChannelId}/messages`, { headers })
                        .then(r => (r.ok ? r.json() : null))
                        .then((data: Message[] | null) => {
                            if (Array.isArray(data)) setMessages(data.reverse());
                            else if (data !== null) console.warn('Unexpected messages payload', data);
                        })
                        .catch(err => console.warn('Failed to load messages', err))
                );
            });

            socket.on('newMessage', (msg: Message) => {
                setMessages((prev: Message[]) => [...prev, msg]);
            });

            socket.on('error', (err: { message: string }) => {
                setError(err.message);
                setTimeout(() => setError(''), 5000);
            });

            socket.on('connect_error', () => {
                console.warn('Chat socket connection error, will retry automatically');
            });

            socket.on('disconnect', (reason: string) => {
                if (reason === 'io server disconnect') {
                    navigate('/login');
                }
            });

            socket.on('userTyping', ({ userId }: { userId: number }) => {
                setUsers(prev => {
                    if(!Array.isArray(prev))
                            return prev;
                    const user = prev.find(u => u.id === userId);
                    if (user)
                        setTyping(`${user.username} is writing...`);
                    return prev;
                });
                if (typingTimer.current)
                    clearTimeout(typingTimer.current);
                typingTimer.current = setTimeout(() => setTyping(''), 3000);
            });

            socket.on('presenceChanged', (data: { userId: number; status: 'online' | 'offline' }) => {
                setOnlineUserId(prev => {
                    const next = new Set(prev);
                    if (data.status === 'online') next.add(data.userId);
                    else next.delete(data.userId);
                    return next;
                });
            });

            socket.on('gameRoomsChanged', () => {
                loadGameRooms();
            });

            socket.on('userCreated', (profile: UserProfile) => {
                setUsers(prev => (prev.some(u => u.id === profile.id) ? prev : [...prev, profile]));
            });

            socket.on('userUpdated', (profile: UserProfile) => {
                setUsers(prev => prev.map(u => (u.id === profile.id ? profile : u)));
            });
        })();

        return (() => {
            cancelled = true;
            socket?.disconnect();
        });
    }, [navigate, loadGameRooms]);


    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        loadGameRooms();
        const interval = setInterval(loadGameRooms, 20000);
        return () => clearInterval(interval);
    }, [loadGameRooms]);

    async function handleJoinRoom(roomId: number, password?: string) {
        try {
            const response = await fetch(`${window.location.origin}/api/chat/channels/${roomId}/join`, {
                method: 'POST',
                headers: await authHeaders(),
                body: JSON.stringify({ password: password ?? '' })
            });
            if (!response.ok) {
                const err = await response.json().catch(() => ({ message: 'Error' }));
                alert(err.message || 'Unable to join room');
                return;
            }
            setJoinPwdRoomId(null);
            navigate(`/game?channelId=${roomId}&action=join`);
        } catch (e: any) {
            alert(e.message || 'Network error');
        }
    }

    function sendMessage() {
        if (!input.trim() || channelId === null || !socketRef.current)
            return;
        if (input.startsWith('/')) {
            handleCommand(input.trim());
            setInput('');
            return;
        }
        socketRef.current.emit('sendMessage', { channelId, content: input.trim() });
        setInput('');
    }

    return (
        <div className="min-h-screen bg-[linear-gradient(135deg,#29323C,#2B5876,#4E4376)] flex flex-col">
        <div className="h-screen overflow-hidden flex flex-col relative lg:h-auto lg:min-h-screen lg:overflow-visible">
            <div className="lg:hidden shrink-0 flex items-center justify-between px-4 py-3">
                <h1 className="text-white text-lg font-bold">DrawDraw</h1>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowUsers(true)}
                        className="w-9 h-9 rounded-full flex items-center justify-center bg-gray-900 border border-gray-800 text-gray-300"
                    >
                        👀
                    </button>
                    <button
                        onClick={() => setShowMyProfile(true)}
                        className="w-9 h-9 rounded-full flex items-center justify-center bg-gray-900 border border-gray-800 text-gray-300"
                    >
                        👤
                    </button>
                </div>
            </div>

            <div className={`${showUsers ? 'flex fixed inset-0 z-40' : 'hidden'} lg:flex lg:absolute lg:z-10 lg:inset-auto lg:left-4 lg:top-4 lg:bottom-4 lg:w-64 flex-col bg-gray-900 lg:rounded-xl border border-gray-800`}>
                <div className="px-4 py-3 bg-black lg:rounded-t-xl border-b border-gray-800 flex items-center justify-between">
                    <span className="text-gray-400 text-sm">Joueurs</span>
                    <button onClick={() => setShowUsers(false)} className="text-gray-400 hover:text-white lg:hidden">✕</button>
                </div>
                <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2">
                    {Array.isArray(users) ? users.map(user => (
                    <div
                        key={user.id} 
                        onClick={() => setOpenProfileId(user.id)}
                        className="flex items-center gap-3 px-2 py-1 rounded-lg hover:bg-gray-800 transition-colors cursor-pointer"
                    >
                    {user.avatarUrl
                        ? <img src={user.avatarUrl} className="w-8 h-8 rounded-md shrink-0 object-cover" />
                        : <div className="w-8 h-8 rounded-md shrink-0" style={{ backgroundColor: user.profileColor }} />
                    }
                        <span className="text-gray-300 text-sm truncate">{user.username}</span>
                        <span className={`ml-auto flex items-center gap-1 text-[10px] shrink-0 ${onlineUserIds.has(user.id) ? 'text-emerald-400' : 'text-gray-500'}`}>
                            <span className={`w-2 h-2 rounded-full ${onlineUserIds.has(user.id) ? 'bg-emerald-400' : 'bg-gray-600'}`} />
                            {onlineUserIds.has(user.id) ? 'online' : 'offline'}
                        </span>
                    </div>
                )) : null}
                </div>
            </div>


            <div className="shrink-0 flex items-center justify-center px-4 py-6 lg:flex-1 lg:py-4 relative">
                

                <div className="absolute top-8 lg:top-12 lg:-ml-16">

                    <DrawDrawLogo className="text-5xl lg:text-7xl" />
                </div>

                <div className="flex flex-col gap-4 sm:gap-6 lg:gap-12 w-full max-w-xs sm:max-w-sm mt-32 lg:mt-0">

                    {/* liste des parties en cours */}
                    <div className="flex flex-col gap-3 w-full">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="text-white text-sm font-bold tracking-wide">Game Rooms</span>
                                <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-400/10 border border-emerald-400/25 px-1.5 py-0.5 rounded-full">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    LIVE
                                </span>
                            </div>
                            <span className="text-gray-600 text-xs">{gameRooms.length} room{gameRooms.length !== 1 ? 's' : ''}</span>
                        </div>
                        {gameRooms.length === 0 ? (
                            <div className="flex flex-col items-center gap-2 py-8 rounded-xl border border-dashed border-gray-700 bg-gray-900/40">
                                <span className="text-3xl opacity-30">🎮</span>
                                <p className="text-gray-500 text-xs italic">No rooms yet. Create one below!</p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-1.5 max-h-52 overflow-y-auto pr-0.5">
                                {gameRooms.map(room => {
                                    const memberCount = room.members?.length ?? 0;
                                    const max = room.maxMembers;
                                    const isFull = max !== null && memberCount >= max;
                                    const blocked = isFull && !room.isUserMember;
                                    const hasPassword = !!room.passwordHash;
                                    return (
                                        <button
                                            key={room.id}
                                            onClick={() => {
                                                if (blocked)
                                                    return;
                                                if (room.isPrivate && !room.isUserMember) {
                                                    alert('This room is private (invitation only)');
                                                    return;
                                                }
                                                if (hasPassword && !room.isUserMember) {
                                                    setJoinPwdRoomId(room.id);
                                                    setJoinPwdInput('');
                                                    return;
                                                }
                                                handleJoinRoom(room.id);
                                            }}
                                            className={`flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm text-left w-full transition-all duration-150
                                                ${blocked
                                                    ? 'opacity-40 cursor-not-allowed border-gray-700 bg-gray-900/60 text-gray-500'
                                                    : 'border-gray-700/60 bg-gray-800/60 hover:bg-gray-700/80 hover:border-gray-600 text-white'}`}>
                                            <span className="flex items-center gap-2 min-w-0">
                                                <span className="font-semibold text-sm truncate">{room.name}</span>
                                            </span>
                                            <span className="flex items-center gap-2 shrink-0 ml-2">
                                                {room.isPrivate && (
                                                    <span
                                                        title={room.isUserMember ? 'Invited' : 'Private'}
                                                        className={`shrink-0 w-2 h-2 rounded-full ${room.isUserMember ? 'bg-green-400' : 'bg-red-500'}`}
                                                    />
                                                )}
                                                {hasPassword && !room.isUserMember && <span title="Password required" className="text-amber-400">🔒</span>}
                                                {room.maxRound != null && (
                                                    <span className="text-[10px] font-semibold text-indigo-300 bg-indigo-500/15 border border-indigo-500/20 px-1.5 py-0.5 rounded-full">
                                                        {room.maxRound}rds
                                                    </span>
                                                )}
                                                <span className={`text-[11px] font-semibold ${isFull ? 'text-red-400' : 'text-gray-400'}`}>
                                                    {memberCount}/{max ?? '8'}
                                                </span>
                                                <span
                                                    role="button"
                                                    title="Watch as spectator"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (room.isUserKicked) { alert('You have been kicked from this room'); return; }
                                                        navigate(`/game?channelId=${room.id}&action=spec`);
                                                    }}
                                                    className="opacity-40 hover:opacity-100 transition-opacity cursor-pointer"
                                                >
                                                    👁
                                                </span>
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="relative [transform-style:preserve-3d] px-8 py-4 sm:px-16 sm:py-6 lg:px-32 lg:py-8 rounded-2xl text-emerald-900 text-base sm:text-lg lg:text-xl font-semibold
                                border-2 border-emerald-400 bg-emerald-100
                                transition-transform duration-150 [transition-timing-function:cubic-bezier(0,0,0.58,1)]
                                hover:bg-emerald-200 hover:[transform:translate(0,0.25em)]
                                active:bg-emerald-200 active:[transform:translate(0,0.75em)]
                                before:content-[''] before:absolute before:inset-0 before:rounded-2xl before:bg-emerald-200
                                before:shadow-[0_0_0_2px_#34d399,0_0.625em_0_0_#d1fae5]
                                before:[transform:translate3d(0,0.75em,-1em)]
                                before:transition-transform before:duration-150 before:[transition-timing-function:cubic-bezier(0,0,0.58,1)]
                                hover:before:shadow-[0_0_0_2px_#34d399,0_0.5em_0_0_#d1fae5]
                                hover:before:[transform:translate3d(0,0.5em,-1em)]
                                active:before:shadow-[0_0_0_2px_#34d399,0_0_#d1fae5]
                                active:before:[transform:translate3d(0,0,-1em)]">
                            Create a new room
                        </button>
                </div>


                {joinPwdRoomId !== null && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
                        <div className="bg-white rounded-2xl p-6 w-80 flex flex-col gap-4 text-gray-800">
                            <h2 className="text-lg font-semibold">Room password</h2>
                            <input
                                type="password"
                                className="border rounded px-2 py-1"
                                value={joinPwdInput}
                                onChange={(e) => setJoinPwdInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom(joinPwdRoomId, joinPwdInput)}
                                placeholder="Password"
                                autoFocus
                            />
                            <div className="flex gap-2 justify-end">
                                <button onClick={() => setJoinPwdRoomId(null)} className="px-3 py-1 rounded text-gray-600">
                                    Cancel
                                </button>
                                <button onClick={() => handleJoinRoom(joinPwdRoomId, joinPwdInput)} className="px-3 py-1 rounded bg-emerald-500 text-white">
                                    Join
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {showCreateModal && (
                    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
                        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-80 flex flex-col gap-4 shadow-2xl">
                            <div className="flex items-center gap-2 border-b border-gray-800 pb-3">
                                <span className="text-lg">🎮</span>
                                <h2 className="text-base font-bold text-white">Create a room</h2>
                            </div>

                            <label className="flex flex-col gap-1.5 text-sm">
                                <span className="text-gray-400 font-medium text-xs uppercase tracking-wider">Max players</span>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    className={`bg-gray-800 border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:ring-2 transition-all
                                        ${createMaxPlayers !== '' && !(Number(createMaxPlayers) >= 2)
                                            ? 'border-red-500 focus:ring-red-500/30'
                                            : 'border-gray-700 focus:ring-indigo-500/40 focus:border-indigo-500/60'}`}
                                    value={createMaxPlayers}
                                    onChange={(e) => {
                                        const v = e.target.value;
                                        if (v === '' || /^\d+$/.test(v)) setCreateMaxPlayers(v);
                                    }}
                                    placeholder="Max 8"
                                />
                                {createMaxPlayers !== '' && !(Number(createMaxPlayers) >= 2) && (
                                    <span className="text-red-400 text-xs">Must be 2 or more</span>
                                )}
                                 {createMaxPlayers !== '' && (Number(createMaxPlayers) > 8) && (
                                    <span className="text-red-400 text-xs">Must be 8 maximum</span>
                                )}
                            </label>

                            <label className="flex flex-col gap-1.5 text-sm">
                                <span className="text-gray-400 font-medium text-xs uppercase tracking-wider">Rounds</span>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    className={`bg-gray-800 border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:ring-2 transition-all
                                        ${createRounds !== '' && !(Number(createRounds) >= 1)
                                            ? 'border-red-500 focus:ring-red-500/30'
                                            : 'border-gray-700 focus:ring-indigo-500/40 focus:border-indigo-500/60'}`}
                                    value={createRounds}
                                    onChange={(e) => {
                                        const v = e.target.value;
                                        if (v === '' || /^\d+$/.test(v)) setCreateRounds(v);
                                    }}
                                    placeholder="Default: 3"
                                />
                                {createRounds !== '' && !(Number(createRounds) >= 1) && (
                                    <span className="text-red-400 text-xs">Must be 1 or more</span>
                                )}
                            </label>

                            <label className="flex flex-col gap-1.5 text-sm">
                                <span className="text-gray-400 font-medium text-xs uppercase tracking-wider">Password (optional)</span>
                                <input
                                    type="text"
                                    className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/60 transition-all"
                                    value={createPassword}
                                    onChange={(e) => setCreatePassword(e.target.value)}
                                    placeholder="Leave empty for none"
                                />
                            </label>

                            <label className="flex items-center justify-between cursor-pointer bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5">
                                <span className="text-sm text-gray-300">Private <span className="text-gray-600 text-xs">(invitation only)</span></span>
                                <input type="checkbox" checked={createPrivate} onChange={(e) => setCreatePrivate(e.target.checked)} className="sr-only" />
                                <div className={`relative w-9 h-5 rounded-full transition-colors duration-200 pointer-events-none ${createPrivate ? 'bg-indigo-500' : 'bg-gray-600'}`}>
                                    <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${createPrivate ? 'translate-x-4' : 'translate-x-0'}`} />
                                </div>
                            </label>

                            <div className="text-xs text-gray-600 bg-gray-800/60 border border-gray-700/50 rounded-lg px-3 py-2">
                                <span className="font-semibold text-gray-500">Admin commands (in chat):</span><br />
                                <span className="font-mono text-gray-600">/limit · /pass · /kick · /mute · /private · /close</span>
                            </div>

                            <div className="flex gap-2 justify-end pt-1">
                                <button
                                    onClick={() => { setShowCreateModal(false); setCreateMaxPlayers(''); setCreatePassword(''); setCreatePrivate(false); setCreateRounds(''); }}
                                    className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-all">
                                    Cancel
                                </button>
                                <button
                                    disabled={(createMaxPlayers !== '' && !(Number(createMaxPlayers) >= 2) || Number(createMaxPlayers) > 8) || (createRounds !== '' && !(Number(createRounds) >= 1))}
                                    onClick={async () => {
                                        try {
                                            const response = await fetch(`${window.location.origin}/api/chat/create-game`, {
                                                method: 'POST',
                                                headers: await authHeaders(),
                                                body: JSON.stringify({
                                                    name: `Game #${Math.floor(Math.random() * 10000)}`,
                                                    isPrivate: createPrivate,
                                                    ...(createMaxPlayers ? { maxMembers: parseInt(createMaxPlayers) } : {}),
                                                    ...(createPassword    ? { password: createPassword }              : {}),
                                                    ...(createRounds      ? { rounds: parseInt(createRounds) }        : {}),
                                                })
                                            });
                                            if (!response.ok) {
                                                const errorData = await response.json().catch(() => ({ message: "Erreur inconnue" }));
                                                throw new Error(errorData.message || `Erreur HTTP ${response.status}`);
                                            }
                                            const newSession = await response.json();
                                            setShowCreateModal(false);
                                            navigate(`/game?channelId=${newSession.channelId}`);
                                        } catch (error: any) {
                                            console.error("Erreur de création :", error);
                                            alert(error.message || "Impossible de créer le salon.");
                                        }
                                    }}
                                    className="px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow">
                                    Create
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex-1 min-h-0 flex flex-col bg-gray-900 border-t border-gray-800 lg:flex-none lg:absolute lg:right-4 lg:top-4 lg:bottom-4 lg:w-80 lg:border lg:rounded-xl">
                <div className="px-4 py-3 bg-black lg:rounded-t-xl border-b border-gray-800">
                    <span className="text-gray-400 text-sm"># general</span>
                </div>
                <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-2">
                {messages.map(msg => (
                    <div key={msg.id} className="flex gap-2 items-baseline">
                        {msg.isDm && (
                            <span className="text-[10px] font-bold uppercase text-pink-400 bg-pink-950 px-1.5 py-0.5 rounded shrink-0">
                                DM
                            </span>
                        )}
                        <span
                            className="text-sm font-semibold shrink-0"
                            style={{ color: msg.sender?.profileColor ?? '#9ca3af' }}
                        >
                            {msg.sender?.username ?? 'Anonyme'}
                        </span>
                        <span className="text-gray-300 text-sm break-all">{msg.content}</span>
                        <span className="text-gray-600 text-xs ml-auto shrink-0">
                            {new Date(msg.createdAt).toLocaleTimeString()}
                        </span>
                    </div>
                ))}
                    <div ref={bottomRef} />
                </div>
                {typing && (
                    <div className="px-4 py-1 text-gray-500 text-xs italic">{typing}</div>
                )}
                {cmdMsg && (
                    <div className="mx-4 mb-1 text-gray-400 text-xs px-2 py-1 whitespace-pre-line">{cmdMsg}</div>
                )}
                {error && (
                    <div className="mx-4 mb-2 bg-red-950 border border-red-800 text-red-300 text-sm px-4 py-2 rounded">
                        {error}
                    </div>
                )}
                <div className="px-4 py-3 border-t border-gray-800">
                    <div className="flex items-center gap-1 bg-[#40414F] border border-[#2E2F3A] rounded-lg h-10 pl-3 pr-1">
                        <input
                            value={input}
                            onChange={e => {
                                setInput(e.target.value);
                                if (channelId && socketRef.current)
                                    socketRef.current.emit('typing', { channelId });
                            }}
                            onKeyDown={e => e.key === 'Enter' && sendMessage()}
                            placeholder="Send a message."
                            className="flex-1 h-full bg-transparent outline-none border-none text-white placeholder-[#828E9E] text-sm text-ellipsis whitespace-nowrap overflow-hidden"
                        />
                        <button
                            onClick={sendMessage}
                            disabled={!input.trim()}
                            className="w-8 h-8 shrink-0 flex items-center justify-center rounded-md hover:bg-black/20 disabled:cursor-not-allowed transition-colors"
                        >
                            <svg
                                className="w-[17px] h-[17px]"
                                viewBox="0 0 512 512"
                                fill={input.trim() ? '#ffffff' : '#6B6C7B'}
                            >
                                <path d="M481.508,210.336L68.414,38.926c-17.403-7.222-37.064-4.045-51.309,8.287C2.86,59.547-3.098,78.551,1.558,96.808 L38.327,241h180.026c8.284,0,15.001,6.716,15.001,15.001c0,8.284-6.716,15.001-15.001,15.001H38.327L1.558,415.193 c-4.656,18.258,1.301,37.262,15.547,49.595c14.274,12.357,33.937,15.495,51.31,8.287l413.094-171.409 C500.317,293.862,512,276.364,512,256.001C512,235.638,500.317,218.139,481.508,210.336z" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
            {(openProfileId !== null || showMyProfile) && (
                    <div
                        className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center"
                        onClick={() => { setOpenProfileId(null); setShowMyProfile(false); }}
                    >
                        <div
                            className="bg-gray-900 rounded-xl border border-gray-800 max-w-lg w-full mx-4 max-h-[85vh] overflow-y-auto relative"
                            onClick={e => e.stopPropagation()}
                        >
                            <button
                                onClick={() => { setOpenProfileId(null); setShowMyProfile(false); }}
                                className="absolute top-3 right-3 text-gray-400 hover:text-white text-lg"
                            >
                                ✕
                            </button>
                            <div className="p-6">
                                <ProfileContent userId={showMyProfile ? undefined : openProfileId ?? undefined} key={showMyProfile ? 'me' : openProfileId} />
                            </div>
                        </div>
                    </div>
                )}
        </div>
        <Footer className="bg-gray-800" />
        </div>
    );
}

