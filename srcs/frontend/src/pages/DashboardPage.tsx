import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';

type Message = {
    id: number;
    content: string;
    createdAt: string;
    sender: { id: number; username: string } | null;
    role?: 'admin' | 'member';
};


function DashboardPage() {
    const [messages, setMessages]   = useState<Message[]>([]);
    const [input, setInput]         = useState('');
    const [error, setError]         = useState('');
    const [channelId, setChannelId] = useState<number | null>(null);
    const socketRef                 = useRef<Socket | null>(null);
    const bottomRef                 = useRef<HTMLDivElement>(null);
    const navigate                  = useNavigate();

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            navigate('/login');
            return;
        }

        const socket = io(window.location.origin, { auth: { token } });
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
        <div className="min-h-screen bg-black flex flex-col">
            <header className="bg-gray-900 px-6 py-4 border-b border-gray-800 flex items-center gap-3">
                <span className="text-white text-xl font-bold">Transcendence</span>
                <span className="text-gray-600">/</span>
                <span className="text-gray-400 text-sm"># general</span>
            </header>

            <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-2">
                {messages.map(msg => (
                    <div key={msg.id} className="flex gap-2 items-baseline">
                        <span className={`text-sm font-semibold shrink-0 ${msg.role === 'admin' ? 'text-yellow-400' : 'text-blue-400'}`}>
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
                <div className="mx-6 mb-2 bg-red-950 border border-red-800 text-red-300 text-sm px-4 py-2 rounded">
                    {error}
                </div>
            )}

            <div className="px-6 py-4 border-t border-gray-800 flex gap-3">
                <input
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && sendMessage()}
                    placeholder="Message #general..."
                    className="flex-1 bg-gray-900 border border-gray-700 text-white px-4 py-2 rounded outline-none placeholder-gray-500 focus:border-white transition-colors"
                />
                <button
                    onClick={sendMessage}
                    disabled={!input.trim()}
                    className="border border-white text-white px-4 py-2 rounded hover:bg-white hover:text-black disabled:border-gray-700 disabled:text-gray-700 disabled:cursor-not-allowed transition-colors">
                    Envoyer
                </button>
            </div>
        </div>
    );
}

export default DashboardPage;
