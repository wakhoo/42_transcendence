import { useState, useEffect, useRef } from 'react';

// On définit le "Contrat" : le Chat a besoin du socket et du vraiChannelId
interface GameChatProps {
  socket: any;
  channelId: number;
}

export default function GameChat({ socket, channelId }: GameChatProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!socket) return;

    // 📡 On écoute les messages de jeu envoyés par le serveur
    const handleNewMessage = (msg: any) => {
      setMessages((prev) => [...prev, msg]);
    };

    socket.on('game_message', handleNewMessage);
    
    // Si le serveur utilise le même nom d'événement que ton collègue ('newMessage')
    socket.on('newMessage', handleNewMessage);

    return () => {
      socket.off('game_message', handleNewMessage);
      socket.off('newMessage', handleNewMessage);
    };
  }, [socket]);

  // Scroll automatique tout en bas dès qu'un message arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Envoi de la proposition
  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !socket) return;

    // On envoie la proposition au serveur (qui vérifiera si c'est le mot secret !)
    socket.emit('send_game_message', { 
      channelId: channelId, 
      content: input.trim() 
    });
    
    setInput('');
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 rounded-lg border border-slate-200 overflow-hidden">
      {/* 1. ZONE DES MESSAGES */}
      <div className="flex-1 p-3 overflow-y-auto space-y-2 text-sm">
        {messages.length === 0 ? (
          <p className="text-center text-slate-400 italic text-xs mt-4">
            Tape ta réponse ci-dessous !
          </p>
        ) : (
          messages.map((msg, idx) => (
            <div key={idx} className="bg-white p-2 rounded shadow-sm border border-slate-100 break-words">
              <span className="font-bold text-indigo-600 mr-1.5">{msg.username || 'Joueur'} :</span>
              <span className="text-slate-700">{msg.content}</span>
            </div>
          ))
        )}
        <div ref={bottomRef} /> {/* Point d'ancrage pour le scroll automatique */}
      </div>

      {/* 2. BARRE D'INPUT (Formulaire d'envoi) */}
      <form onSubmit={sendMessage} className="p-2 bg-white border-t border-slate-200 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Devine le mot ici..."
          className="flex-1 bg-slate-100 border border-slate-300 rounded px-3 py-1.5 text-xs focus:outline-none focus:border-indigo-500 font-medium"
        />
        <button 
          type="submit" 
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded text-xs font-bold transition-colors shadow-sm"
        >
          ↵
        </button>
      </form>
    </div>
  );
}