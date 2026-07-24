import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { ProfileContent } from './ProfilePage';

type Message = {
    id: number;
    content: string;
    createdAt: string;
    sender: { id: number; username: string; profileColor: string } | null;
    role?: 'admin' | 'member';
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
    const [error, setError]         = useState('');
    const [channelId, setChannelId] = useState<number | null>(null);
    const [typing, setTyping]       = useState('');
    const [cmdMsg, setCmdMsg]       = useState('');
    const socketRef                 = useRef<Socket | null>(null);
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


    function findUser(username: string): UserProfile | undefined {
        return users.find(u => u.username.toLowerCase() === username.toLowerCase());
    }

    async function handleCommand(raw: string) {
        const parts   = raw.slice(1).trim().split(' '); //slice c'est pour retourner la variable apres n elements
        const cmd     = parts[0].toLowerCase();
        const args    = parts.slice(1);
        const token   = sessionStorage.getItem('token');
        if (!token || channelId === null) 
            return;
        const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

        function ok(msg: string) { //function declare les fonctions sans les executer
            setCmdMsg(msg);   
            setTimeout(() => setCmdMsg(''), 5000); 
        }

        function err(msg: string) { 
            setError(msg);    
            setTimeout(() => setError(''), 5000);  
        }

        async function api(url: string, method: string, body?: object) {
            const res  = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
            const data = await res.json().catch(() => ({})); //sert a intercepter les exceptions des reponses valides avec un json vide 
            return { ok: res.ok, msg: data.message ?? '' }; //on peut retourner un objet et ensuite acceder avec res.ok ou res.msg
        }

        if (cmd === 'help') {
            ok('Admin: /kick <user>  /mute <user> [min]  /pass <password>  /close  /(un)private\nUser:  /msg <user> <message>  /invite <user>  /add <user>  /block <user>');
            return;
        }

        if (cmd === 'kick') {
            const target = findUser(args[0]);
            if (!target) { 
                err(`User "${args[0]}" not found`); 
                return; 
            }
            const r = await api(`/api/chat/channels/${channelId}/kick/${target.id}`, 'DELETE');
            r.ok ? ok(`${target.username} has been kicked`) : err(r.msg || 'Error');
            return;
        }

        if (cmd === 'mute') {
            const target  = findUser(args[0]);
            if (!target) { 
                err(`User "${args[0]}" not found`); 
                return; 
            }
            const minutes = parseInt(args[1]) || 5; //l'equivalent de stoi en TS, si non defini on part sur 5min
            const r = await api(`/api/chat/channels/${channelId}/mute/${target.id}`, 'PATCH', { minutes });
            r.ok ? ok(`${target.username} muted for ${minutes} min`) : err(r.msg || 'Error');
            return;
        }

        if (cmd === 'pass') { //juste faire /pass enleve le mdp
            const password = args[0] ?? null;
            const r = await api(`/api/chat/channels/${channelId}/password`, 'PATCH', { password });
            r.ok ? ok(password ? 'Password set' : 'Password removed') : err(r.msg || 'Error');
            return;
        }

        if (cmd === 'close') {
            const r = await api(`/api/chat/channels/${channelId}`, 'DELETE');
            r.ok ? ok('Channel closed') : err(r.msg || 'Error');
            return;
        }

        if (cmd === 'private') {
            const r = await api(`/api/chat/channels/${channelId}/privacy`, 'PATCH', { isPrivate: true });
            r.ok ? ok('Channel set to private') : err(r.msg || 'Error');
            return;
        }

        if (cmd === 'unprivate') {
            const r = await api(`/api/chat/channels/${channelId}/privacy`, 'PATCH', { isPrivate: false });
            r.ok ? ok('Channel set to public') : err(r.msg || 'Error');
            return;
        }

        if (cmd === 'msg') {
            const target  = findUser(args[0]);
            if (!target) { 
                err(`User "${args[0]}" not found`); 
                return; 
            }
            const content = args.slice(1).join(' '); //vu que j'ai split(' ') avant je dois recoller les morceaux pour faire la string content
            if (!content) { 
                err('Usage: /msg <user> <message>'); 
                return; 
            }
            if (!socketRef.current) 
                return;
            socketRef.current.emit('sendDm', { targetUserId: target.id, content });
            ok(`DM sent to ${target.username}`);
            return;
        }

        if (cmd === 'invite') {
            const target = findUser(args[0]);
            if (!target) { 
                err(`User "${args[0]}" not found`); 
                return; 
            }
            const r = await api(`/api/chat/channels/${channelId}/invite/${target.id}`, 'POST');
            r.ok ? ok(`${target.username} invited`) : err(r.msg || 'Error');
            return;
        }

        if (cmd === 'add') {
            const target = findUser(args[0]);
            if (!target) { 
                err(`User "${args[0]}" not found`); 
                return; 
            }
            const r = await api(`/api/chat/friends/${target.id}`, 'POST');
            r.ok ? ok(`Friend request sent to ${target.username}`) : err(r.msg || 'Error');
            return;
        }

        if (cmd === 'block') {
            const target = findUser(args[0]);
            if (!target) { 
                err(`User "${args[0]}" not found`); 
                return; 
            }
            const r = await api(`/api/chat/block/${target.id}`, 'POST');
            r.ok ? ok(`${target.username} blocked`) : err(r.msg || 'Error');
            return;
        }

        err(`Unknown command: /${cmd}. Type /help for the list.`);
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
                        onClick={() => navigate('/game')}
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
                                        // 🚀 1. On appelle ton GameController pour exécuter ton createGameSession en back !
                                        const response = await fetch(`${window.location.origin}/api/chat/create-game`, {
                                            method: 'POST',
                                            headers: {
                                                'Content-Type': 'application/json',
                                                'Authorization': `Bearer ${sessionStorage.getItem('token')}` // Ou ton token JWT
                                            },
                                            body: JSON.stringify({ name: "Public Game" })
                                        });

                                        if (!response.ok) {
                                            throw new Error("Erreur serveur lors de la création");
                                        }

                                        const newSession = await response.json();

                                        // 🚀 2. Le serveur nous renvoie la session avec le VRAI channelId officiel !
                                        // Plus besoin de &action=create, le salon est déjà en RAM et en BDD !
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

