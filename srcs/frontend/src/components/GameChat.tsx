import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useChatCommands } from '../hooks/useChatCommands'; //je t'ai importe les commandes du chat ici
import { getAccessToken, authHeaders } from '../lib/session';

type Message = {
  id: number;
  content: string;
  createdAt: string;
  sender: { id: number; username: string; profileColor: string } | null;
  isDm?: boolean;
};

type UserProfile = { id: number; username: string; profileColor: string };

interface GameChatProps {
  channelId: number;
  isSpectator?: boolean;
}

export default function GameChat({ channelId, isSpectator }: GameChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState('');
  const [users, setUsers]       = useState<UserProfile[]>([]);
  const socketRef               = useRef<Socket | null>(null);
  const chatContainerRef        = useRef<HTMLDivElement>(null);
  const [roomName, setRoomName] = useState(`Game ${channelId}`);
  const { handleCommand, cmdMsg, error, setError } = useChatCommands(channelId, users, socketRef); //ca c'est pour utiliser les commandes chat

  // 1. Connexion indépendante au namespace /chat exactement comme le Dashboard
  useEffect(() => {
    let socket: Socket | null = null;
    let cancelled = false;

    (async () => {
      const token = await getAccessToken();
      if (!token || !channelId || cancelled) return;

      socket = io(`${window.location.origin}/chat`, { auth: { token }, transports: ['websocket'],
    //  ON RAJOUTE CE BOUT DE CODE : On prévient le back qu'on est en mode jeu sur ce salon !
    query: {
      mode: 'game',
      channelId: channelId.toString()
    } });
      socketRef.current = socket;
      socket.on('connect', () => {
       // socket.emit('joinChannel', { channelId: Number(channelId) });

      })

      // Charger l'historique des messages du salon de jeu
      fetch(`/api/chat/channels/${channelId}/messages`, {
        headers: await authHeaders()
      })
        .then(r => r.json())
        .then((data: Message[]) => {
          if (Array.isArray(data)) setMessages(data.reverse());
        })
        .catch(() => console.log("Aucun historique pour ce salon"));

      fetch(`/api/chat/game-rooms`, {headers: await authHeaders()})
      .then(r => r.json())
      .then((rooms) => {

        if(Array.isArray(rooms)){

          const myRoom = rooms.find((room: any) => room.id === Number(channelId))

          if(myRoom && myRoom.name)
            setRoomName(myRoom.name);
        }
      })
      .catch(() => console.log("can't recover name of the room"));
      // Écouter les nouveaux messages en direct
      socket.on('newMessage', (msg: Message) => {
        setMessages((prev) => [...prev, msg]);
      });

    socket.on('presenceChanged', () => {
    authHeaders().then(headers =>
      fetch('/api/user', { headers })
        .then(r => r.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setUsers(data);
          } else {
            console.error("Error API /user, not an array :", data);
          }
        })
        .catch(() => console.log("Erreur maj joueurs"))
      );
    });
      
      socket.on('error', (err: { message: string }) => {
        setError(err.message);
        setTimeout(() => setError(''), 5000);
      });
    })();

    return () => {
      cancelled = true;
      socket?.disconnect();
    };
  }, [channelId]);

  // charge les joueurs du channel pour résoudre les usernames dans les commandes
  useEffect(() => {
    (async () => {
      const token = await getAccessToken();
      if (!token || !channelId) return;
      fetch('/api/user', { headers: await authHeaders() })
        .then(r => r.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setUsers(data);
          }
        })
        .catch(() => {});
    })();
  }, [channelId]);
  // 2. Scroll automatique tout en bas
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages]);
  // 3. Envoi du message (qui sera analysé par checkGuess côté serveur !)
  const sendMessage = () => {
    if (!input.trim() || !socketRef.current || !channelId) return;

    // si le message commence par / on le traite comme une commande
    if (input[0] === '/') {
      handleCommand(input.trim());
      setInput('');
      return;
    }

    socketRef.current.emit('sendMessage', {
      channelId: Number(channelId),
      content: input.trim()
    });
    setInput('');
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 rounded-xl border border-gray-800 text-white overflow-hidden">
      
      <div className="px-4 py-3 bg-black rounded-t-xl border-b border-gray-800 shrink-0">
        <span className="text-gray-400 text-sm font-semibold">{roomName}</span>
      </div>

      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-2">
        {messages.length === 0 ? (
          <p className="text-gray-500 text-xs italic text-center mt-4">
            {isSpectator ? 'No message for now' : 'No message, write your answer bellow'}
          </p>
        ) : (
          messages.map((msg, idx) => (
            <div key={msg.id || idx} className="flex gap-2 items-baseline break-all">
              {msg.isDm && (
                <span className="text-[10px] font-bold uppercase text-pink-400 bg-pink-950 px-1.5 py-0.5 rounded shrink-0">
                  DM
                </span>
              )}
              <span
                className="text-sm font-semibold shrink-0"
                style={{ color: msg.sender?.profileColor ?? '#60a5fa' }}
              >
                {msg.sender?.username ?? 'Anonyme'} :
              </span>
              <span className="text-gray-300 text-sm">{msg.content}</span>
              <span className="text-gray-600 text-[10px] ml-auto shrink-0">
                {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString() : ''}
              </span>
            </div>
          ))
        )}
      </div>

      {/*la c'est juste pour t'afficher le resultat de la commande chat*/}
      {cmdMsg && (
        <div className="mx-4 mb-1 text-gray-400 text-xs px-2 py-1 whitespace-pre-line shrink-0">{cmdMsg}</div>
      )}

      {/* Affichage des erreurs éventuelles */}
      {error && (
        <div className="mx-4 mb-2 bg-red-950 border border-red-800 text-red-300 text-xs px-3 py-1.5 rounded shrink-0">
          {error}
        </div>
      )}

      {/* on desactive la possibilite de parler au spec ici */}
      <div className="px-4 py-3 border-t border-gray-800 shrink-0 bg-gray-900 mt-auto">
        {isSpectator ? (
          <p className="text-gray-500 text-xs italic text-center py-1">Spectator mod, sending disabled</p>
        ) : (
        <div className="flex flex-row items-center justify-between gap-2 bg-[#40414F] border border-[#2E2F3A] rounded-lg h-10 px-2">

          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Propose un mot..."
            className="flex-1 w-full h-full bg-transparent outline-none border-none text-white placeholder-[#828E9E] text-sm text-ellipsis whitespace-nowrap overflow-hidden px-1"
          />

          <button
            onClick={sendMessage}
            disabled={!input.trim()}
            className="w-8 h-8 shrink-0 flex items-center justify-center rounded-md hover:bg-black/20 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-[17px] h-[17px] block" viewBox="0 0 512 512" fill={input.trim() ? '#ffffff' : '#6B6C7B'}>
              <path d="M481.508,210.336L68.414,38.926c-17.403-7.222-37.064-4.045-51.309,8.287C2.86,59.547-3.098,78.551,1.558,96.808 L38.327,241h180.026c8.284,0,15.001,6.716,15.001,15.001c0,8.284-6.716,15.001-15.001,15.001H38.327L1.558,415.193 c-4.656,18.258,1.301,37.262,15.547,49.595c14.274,12.357,33.937,15.495,51.31,8.287l413.094-171.409 C500.317,293.862,512,276.364,512,256.001C512,235.638,500.317,218.139,481.508,210.336z" />
            </svg>
          </button>

        </div>
        )}
      </div>

    </div>
  );
}
