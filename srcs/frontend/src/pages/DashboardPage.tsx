import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';

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
};


function DashboardPage() {
    const [users, setUsers]         = useState<UserProfile[]>([]);
    const [messages, setMessages]   = useState<Message[]>([]);
    const [input, setInput]         = useState('');
    const [error, setError]         = useState('');
    const [channelId, setChannelId] = useState<number | null>(null);
    const socketRef                 = useRef<Socket | null>(null);
    const bottomRef                 = useRef<HTMLDivElement>(null);
    const navigate                  = useNavigate();

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token)
            return ;

        fetch('/api/user', { headers: { Authorization: `Bearer ${token}` }})
            .then(r => r.json())
            .then((data: UserProfile[]) => setUsers(data));
    }, [])

    useEffect(() => {
        const token = localStorage.getItem('token');
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

        return (() => { socketRef.current?.disconnect(); });
    }, [navigate]);


    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);


    function sendMessage() {
        if (!input.trim() || channelId === null || !socketRef.current) 
            return;
        socketRef.current.emit('sendMessage', { channelId, content: input.trim() });
        setInput('');
    }


    return (
        <div className="min-h-screen bg-black flex relative">

            <div className="absolute top-6 left-8">
                <h1 className="text-white text-2xl font-bold">Transcendence</h1>
            </div>

            <div className="absolute left-4 top-4 bottom-4 w-64 flex flex-col bg-gray-900 rounded-xl border border-gray-800">
                <div className="px-4 py-3 bg-black rounded-t-xl border-b border-gray-800">
                    <span className="text-gray-400 text-sm">Joueurs</span>
                </div>
                <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2">
                    {users.map(user => (
                        <div key={user.id} className="flex items-center gap-3 px-2 py-1 rounded-lg hover:bg-gray-800 transition-colors cursor-pointer">
                            <div className="w-4 h-4 rounded-sm shrink-0" style={{ backgroundColor: user.profileColor }} />
                            <span className="text-gray-300 text-sm truncate">{user.username}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex-1 flex items-center justify-center">
                <div className="flex flex-col gap-6">
                    <button className="px-32 py-8 rounded-2xl text-white text-xl font-semibold bg-blue-950 hover:bg-blue-900 transition-colors duration-200">
                        Join public room
                    </button>
                    <button className="px-32 py-8 rounded-2xl text-white text-xl font-semibold bg-emerald-950 hover:bg-emerald-900 transition-colors duration-200">
                        Create new public room
                    </button>
                    <button className="px-32 py-8 rounded-2xl text-white text-xl font-semibold bg-violet-950 hover:bg-violet-900 transition-colors duration-200">
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
                {error && (
                    <div className="mx-4 mb-2 bg-red-950 border border-red-800 text-red-300 text-sm px-4 py-2 rounded">
                        {error}
                    </div>
                )}
                <div className="px-4 py-3 border-t border-gray-800 flex gap-2">
                    <input
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && sendMessage()}
                        placeholder="Message..."
                        className="flex-1 bg-black border border-gray-700 text-white px-3 py-2 rounded outline-none placeholder-gray-500 focus:border-white transition-colors text-sm"
                    />
                    <button
                        onClick={sendMessage}
                        disabled={!input.trim()}
                        className="border border-white text-white px-3 py-2 rounded hover:bg-white hover:text-black disabled:border-gray-700 disabled:text-gray-700 disabled:cursor-not-allowed transition-colors text-sm">
                        →
                    </button>
                </div>
            </div>
        </div>
    );
}

export default DashboardPage;
