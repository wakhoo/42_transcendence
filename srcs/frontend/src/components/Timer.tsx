import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import GameChat from './GameChat';
import { useNavigate } from 'react-router-dom';

export default function GamePage() {
  const [tempsRestant, setTempsRestant] = useState(60);
  const [socket, setSocket] = useState<any>(null);
  const [drawerInfo, setDrawerInfo] = useState<any>(null);
  
  const [listeJoueurs, setListeJoueurs] = useState<any[]>([]);
  const [wordHint, setWordHint] = useState<any>(null);

  const queryParam = new URLSearchParams(window.location.search);
  const reelChannelId = Number(queryParam.get('channelId')) || 1;
  const navigate                  = useNavigate();

  useEffect(() => {
    const token = sessionStorage.getItem('token');
    if(!token){
      navigate('/login');
      return;
    }

    const socketInstance = io(`${window.location.origin}/game`, {
      auth: { token: token }, transports: ['websocket']
    });

    setSocket(socketInstance);

    socketInstance.on('connect', () => {
      console.log("Connecté au GameGateway !");

      const action = queryParam.get('action');
      if (action === 'create') {
        console.log(`Ordre reçu : Création de la room #${reelChannelId}...`);
        socketInstance.emit('create_room', { channelId: reelChannelId });
      } else {
        console.log(`👥 Ordre reçu : Rejoindre la room #${reelChannelId}...`);
        socketInstance.emit('join_room', { channelId: reelChannelId });
      }
      
    });

    socketInstance.on('update_players', (listeVenantDuBack) => {

      console.log("📦 Liste des joueurs reçue du serveur :", listeVenantDuBack);
      setListeJoueurs(listeVenantDuBack);
    });

    socketInstance.on('timer_update', (nouveauTemps) => {
      setTempsRestant(nouveauTemps);
    });

    socketInstance.on('round_start', (data) => {
      setDrawerInfo(data);
    });

    socketInstance.on('word_hint', (data) => {
      setWordHint(data);
    });

    socketInstance.on('error', (err: any) => {
      console.error("LE SERVEUR REJETTE L'ACTION :", err);
      alert("Erreur renvoyée par le serveur : " + (err.message || JSON.stringify(err)));
    });

    return () => {
      socketInstance.off('connect');
      socketInstance.off('update_players');
      socketInstance.off('timer_update');
      socketInstance.off('round_start');
      socketInstance.off('word_hint');
      socketInstance.off('error');
      socketInstance.off('exception');
      socketInstance.removeAllListeners();
      socketInstance.disconnect();
      
    };
  }, []);

  const handleStartGame = () => {
    if (socket) {
      console.log(` Demande de démarrage du jeu pour le salon officiel #${reelChannelId}...`);
      socket.emit('start_game', { channelId: reelChannelId });
    }
  };

  return (
    // 1. CONTENEUR PRINCIPAL : Prend tout l'écran avec un fond gris doux
    <div className="min-h-screen bg-slate-100 p-4 flex flex-col gap-4 font-sans text-slate-800">

      {/* 2. BARRE SUPÉRIEURE : Logo, Timer, Mot Secret et Bouton */}
      <header className="bg-white px-6 py-4 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between gap-4">
        
        {/* 👉 SECTION GAUCHE : Le Logo ET le Timer bien alignés côte à côte */}
        <div className="flex items-center gap-6">
          <h1 className="text-2xl font-black tracking-wider text-indigo-600 flex items-center gap-2">
            <span>🎨</span>
            <span>FT_SKRIBBL</span>
          </h1>

          {/* Le Timer (Fini la position absolute !) */}
          <div className={`flex items-center gap-2 text-xl font-bold px-4 py-1.5 rounded-lg border-2 shadow-sm ${
            tempsRestant <= 10 ? 'bg-red-50 border-red-500 text-red-600 animate-pulse' : 'bg-slate-50 border-slate-300 text-slate-700'
          }`}>
            <span>⏱️</span>
            <span>{tempsRestant}s</span>
          </div>
        </div>

        {/* 👉 SECTION CENTRALE : Le Mot Secret / Indice */}
        <div className="text-center flex-1">
          {wordHint ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Mot à deviner</p>
              <p className="text-3xl font-mono tracking-[0.4em] font-black text-indigo-600">{wordHint.hint}</p>
            </div>
          ) : (
            <p className="text-sm font-medium text-slate-400 italic">En attente du début de manche...</p>
          )}
        </div>

        {/* 👉 SECTION DROITE : Le Bouton Start */}
        <button
          onClick={handleStartGame}
          className="bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-bold px-6 py-2.5 rounded-lg shadow transition-all whitespace-nowrap"
        >
          🚀 Start Game
        </button>
      </header>


      {/* 3. GRILLE CENTRALE EN 3 COLONNES (4 fractions : 1 + 2 + 1) */}
      <main className="grid grid-cols-1 lg:grid-cols-4 gap-4 flex-1 min-h-[500px]">

        {/* --- COLONNE GAUCHE : JOUEURS (1 fraction sur 4) --- */}
        <aside className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col">
          <h3 className="font-bold text-lg text-slate-800 border-b border-slate-100 pb-3 mb-3 flex items-center justify-between">
            <span>👥 Joueurs</span>
            <span className="bg-slate-100 text-slate-600 text-xs py-1 px-2 rounded-full">{listeJoueurs.length}</span>
          </h3>

          <ul className="space-y-2 overflow-y-auto flex-1">
            {listeJoueurs.map((joueur: any, index: number) => (
              <li key={index} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></span>
                  <span className="font-semibold text-sm text-slate-700">
                    {joueur.username || `Joueur #${joueur.dbId || index + 1}`}
                  </span>
                </div>
                {/* Icône crayon si c'est le dessinateur (à adapter avec ton code) */}
                {drawerInfo && drawerInfo.drawerId === joueur.dbId && (
                  <span title="Dessinateur" className="text-lg">🎨</span>
                )}
              </li>
            ))}
          </ul>
        </aside>


        {/* --- COLONNE CENTRALE : ZONE DE DESSIN (2 fractions sur 4) --- */}
        <section className="col-span-1 lg:col-span-2 bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col items-center justify-center relative overflow-hidden">
          
          {/* Annonce au début de la manche (Overlay) */}
          {drawerInfo && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-6 py-2 rounded-full shadow-md text-sm font-medium z-10 animate-bounce">
              🎨 {drawerInfo.message}
            </div>
          )}

          {/* C'est ICI qu'on placera ton composant <Canvas /> plus tard ! */}
          <div className="w-full h-full border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center bg-slate-50 text-slate-400">
            <span className="text-4xl mb-2">🖌️</span>
            <p className="font-medium">Zone de dessin </p>
          </div>

        </section>


        {/* --- COLONNE DROITE : LE CHAT DE TON COLLÈGUE (1 fraction sur 4) --- */}
        <aside className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col">
          <h3 className="font-bold text-lg text-slate-800 border-b border-slate-100 pb-3 mb-3">
            💬 Chat du Jeu
          </h3>

          {/* 👉 Le vrai chat prend maintenant tout l'espace disponible ! */}
          <div className="flex-1 overflow-hidden">
            <GameChat socket={socket} channelId={reelChannelId} />
          </div>
        </aside>
      </main>

    </div>
  );
  

}