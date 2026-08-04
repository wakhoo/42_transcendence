import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { ProfileContent } from './ProfilePage';
import { useChatCommands } from '../hooks/useChatCommands';

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

export default function DashboardPage() {
    const [users, setUsers]         = useState<UserProfile[]>([]);
    const [messages, setMessages]   = useState<Message[]>([]);
    const [input, setInput]         = useState('');
    const [channelId, setChannelId] = useState<number | null>(null);
    const [typing, setTyping]       = useState('');
    const socketRef                 = useRef<Socket | null>(null);
    const { handleCommand, cmdMsg, error, setError } = useChatCommands(channelId, users, socketRef);
    const bottomRef                 = useRef<HTMLDivElement>(null);
    const typingTimer               = useRef<ReturnType<typeof setTimeout> | null>(null);
    const navigate                  = useNavigate();
    const [openProfileId, setOpenProfileId] = useState<number | null>(null);

    useEffect(() => {
        const token = sessionStorage.getItem('token');
        if (!token) {
            navigate('/login');
            return;
        }

        fetch('/api/user', { headers: { Authorization: `Bearer ${token}` }})
            .then(r => r.json())
            .then((data: UserProfile[]) => setUsers(data));
    }, [])

    useEffect(() => {
        const token = sessionStorage.getItem('token');
        if (!token) {
            navigate('/login');
            return;
        }

        const socket = io(`${window.location.origin}/chat`, { auth: { token } });
        socketRef.current = socket;

        socket.on('ready', ({ generalChannelId }: { generalChannelId: number }) => {
            setChannelId(generalChannelId);

            fetch(`/api/chat/channels/${generalChannelId}/messages`, {headers: { Authorization: `Bearer ${token}` }})
            .then(r => r.json())
            .then((data: Message[]) => setMessages(data.reverse()));
        });

        socket.on('newMessage', (msg: Message) => {
            setMessages((prev: Message[]) => [...prev, msg]);
        });

        socket.on('error', (err: { message: string }) => {
            setError(err.message);
            setTimeout(() => setError(''), 5000);
        });

        socket.on('connect_error', () => navigate('/login'));

        socket.on('userTyping', ({ userId }: { userId: number }) => {
            setUsers(prev => {
                const user = prev.find(u => u.id === userId);
                if (user)
                    setTyping(`${user.username} is writing...`);
                return prev;
            });
            if (typingTimer.current)
                clearTimeout(typingTimer.current);
            typingTimer.current = setTimeout(() => setTyping(''), 3000);
        });

        socket.on('presenceChanged', () => {
            fetch('/api/user', { headers: { Authorization: `Bearer ${token}` } })
                .then(r => r.json())
                .then((data: UserProfile[]) => setUsers(data));
         });

        return (() => { socketRef.current?.disconnect(); });
    }, [navigate]);


    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);



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
        <div className="min-h-screen bg-[linear-gradient(135deg,#29323C,#2B5876,#4E4376)] flex relative">

            <div className="absolute top-6 left-8">
                <h1 className="text-white text-2xl font-bold">Transcendence</h1>
            </div>

            <div className="absolute left-4 top-4 bottom-4 w-64 flex flex-col bg-gray-900 rounded-xl border border-gray-800">
                <div className="px-4 py-3 bg-black rounded-t-xl border-b border-gray-800">
                    <span className="text-gray-400 text-sm">Joueurs</span>
                </div>
                <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2">
                    {users.map(user => (
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
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex-1 flex items-center justify-center">
                <div className="flex flex-col gap-12">
                    <button
                       onClick={async () => {
                        try {
                            const response = await fetch(`${window.location.origin}/api/chat/join-public-game`, {
                                method: 'GET',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${sessionStorage.getItem('token')}`
                                }
                            });

                            if (!response.ok) {
                                const errorData = await response.json().catch(() => ({ message: "Erreur inconnue" }));
                                throw new Error(errorData.message || `Erreur HTTP ${response.status}`);
                            }

                            const data = await response.json();

                            navigate(`/game?channelId=${data.channelId}&action=join`);

                        } catch (error: any) {
                            console.error("Erreur pour rejoindre :", error);
                            alert(error.message || "Impossible de rejoindre un salon public.");
                        }
                    }}
                    className="relative [transform-style:preserve-3d] px-32 py-8 rounded-2xl text-blue-900 text-xl font-semibold
                        border-2 border-blue-400 bg-blue-100
                        transition-transform duration-150 [transition-timing-function:cubic-bezier(0,0,0.58,1)]
                        hover:bg-blue-200 hover:[transform:translate(0,0.25em)]
                        active:bg-blue-200 active:[transform:translate(0,0.75em)]
                        before:content-[''] before:absolute before:inset-0 before:rounded-2xl before:bg-blue-200
                        before:shadow-[0_0_0_2px_#60a5fa,0_0.625em_0_0_#dbeafe]
                        before:[transform:translate3d(0,0.75em,-1em)]
                        before:transition-transform before:duration-150 before:[transition-timing-function:cubic-bezier(0,0,0.58,1)]
                        hover:before:shadow-[0_0_0_2px_#60a5fa,0_0.5em_0_0_#dbeafe]
                        hover:before:[transform:translate3d(0,0.5em,-1em)]
                        active:before:shadow-[0_0_0_2px_#60a5fa,0_0_#dbeafe]
                        active:before:[transform:translate3d(0,0,-1em)]">
                    Join public room
                    </button>
                        <button
                            onClick={ async () => {
                                            try {
                        
                                        const response = await fetch(`${window.location.origin}/api/chat/create-game`, {
                                            method: 'POST',
                                            headers: {
                                                'Content-Type': 'application/json',
                                                'Authorization': `Bearer ${sessionStorage.getItem('token')}`
                                            },
                                            body: JSON.stringify({ name: `Public Game #${Math.floor(Math.random() * 10000)}`})
                                        });

                                        if (!response.ok) {
                                            const errorData = await response.json().catch(() => ({ message: "Erreur inconnue" }));
                                            console.error("Détail de l'erreur NestJS :", errorData);
                                            throw new Error(errorData.message || `Erreur HTTP ${response.status}`);
                                        }

                                        const newSession = await response.json();

                                        //  Le serveur nous renvoie la session avec le VRAI channelId officiel !
                        
                                        navigate(`/game?channelId=${newSession.channelId}`);

                                    } catch (error) {
                                        console.error("Erreur de création :", error);
                                        alert("Impossible de créer le salon de jeu.");
                                    }
                                }}
                            className="relative [transform-style:preserve-3d] px-32 py-8 rounded-2xl text-emerald-900 text-xl font-semibold
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
                            Create new public room
                        </button>

                    <button
                        onClick={() => navigate('/game')}
                        className="relative [transform-style:preserve-3d] px-32 py-8 rounded-2xl text-violet-900 text-xl font-semibold
                            border-2 border-violet-400 bg-violet-100
                            transition-transform duration-150 [transition-timing-function:cubic-bezier(0,0,0.58,1)]
                            hover:bg-violet-200 hover:[transform:translate(0,0.25em)]
                            active:bg-violet-200 active:[transform:translate(0,0.75em)]
                            before:content-[''] before:absolute before:inset-0 before:rounded-2xl before:bg-violet-200
                            before:shadow-[0_0_0_2px_#a78bfa,0_0.625em_0_0_#ede9fe]
                            before:[transform:translate3d(0,0.75em,-1em)]
                            before:transition-transform before:duration-150 before:[transition-timing-function:cubic-bezier(0,0,0.58,1)]
                            hover:before:shadow-[0_0_0_2px_#a78bfa,0_0.5em_0_0_#ede9fe]
                            hover:before:[transform:translate3d(0,0.5em,-1em)]
                            active:before:shadow-[0_0_0_2px_#a78bfa,0_0_#ede9fe]
                            active:before:[transform:translate3d(0,0,-1em)]">
                        Create new private room
                    </button>
                </div>
            </div>

            <div className="absolute right-4 top-4 bottom-4 w-80 flex flex-col bg-gray-900 rounded-xl border border-gray-800">
                <div className="px-4 py-3 bg-black rounded-t-xl border-b border-gray-800">
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
        {openProfileId !== null && (
                <div
                    className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center"
                    onClick={() => setOpenProfileId(null)}
                >
                    <div
                        className="bg-gray-900 rounded-xl border border-gray-800 max-w-lg w-full mx-4 max-h-[85vh] overflow-y-auto relative"
                        onClick={e => e.stopPropagation()}
                    >
                        <button
                            onClick={() => setOpenProfileId(null)}
                            className="absolute top-3 right-3 text-gray-400 hover:text-white text-lg"
                        >
                            ✕
                        </button>
                        <div className="p-6">
                            <ProfileContent userId={openProfileId} key={openProfileId} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

