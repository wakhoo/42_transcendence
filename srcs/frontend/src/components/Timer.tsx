import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import GameChat from './GameChat';
import { useNavigate } from 'react-router-dom';
import GameCanvas from './GameCanvas';
export default function GamePage() {

  const [myId, setMyId] = useState<number | null>(null);
  const [tempsRestant, setTempsRestant] = useState(60);
  const [socket, setSocket] = useState<any>(null);
  const [drawerInfo, setDrawerInfo] = useState<any>(null);
  const [listeJoueurs, setListeJoueurs] = useState<any[]>([]);
  const [wordHint, setWordHint] = useState<any>(null);
  const [secretWord, setSecretWord] = useState<any>(null);
  const [roundEndMsg, setRoundEndMsg] = useState<string | null>(null);
  const [scores, setScores] = useState<Record< number, number>>({});
  const [message, setMessage] = useState<any>(null);

  const queryParam = new URLSearchParams(window.location.search);
  const reelChannelId = Number(queryParam.get('channelId')) || 1;
  const navigate                  = useNavigate();


  useEffect(() => {

    if(!socket)
        return;
    socket.on('connect', () => {

        socket.emit('get_my_id', (response : {userId : number}) => {

            if(response && response.userId)
                setMyId(response.userId);
  
        });
    });

  }, [socket]);


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
        socketInstance.emit('create_room', { name: `Salon de ${sessionStorage.getItem('username') || 'Game'}` });
      } else {
        console.log(` Ordre reçu : Rejoindre la room #${reelChannelId}...`);
        socketInstance.emit('join_room', { channelId: reelChannelId });
      }
      
    });

    socketInstance.on('room_created' , (data) => {

      const reelId = data.channelId;
      window.history.replaceState(null, '', `/game?channelId=${reelId}&action=join`);
      socketInstance.emit('join_room', { channelId: Number(reelId) });

    });


    socketInstance.on('update_players', (listeVenantDuBack) => {

      console.log(" Liste des joueurs reçue du serveur :", listeVenantDuBack);
      setListeJoueurs(listeVenantDuBack);
    });

    socketInstance.on('timer_update', (nouveauTemps) => {
      setTempsRestant(nouveauTemps);
    });

    socketInstance.on('round_start', (data) => {
      setDrawerInfo(data);
      setSecretWord(null);

    });

    socketInstance.on('message_channel', (data) => {
      setMessage(data);
      setTimeout(() => {
      setMessage(null);
      }, 4000);
    });


    socketInstance.on('word_hint', (data) => {
      setWordHint(data);
    });

    socketInstance.on('secret_word', (data) => {
      setSecretWord(data);
      setTimeout(() => {
      setSecretWord(null);
      }, 7000);
    });

    socketInstance.on('round_end', (data) => {
      setRoundEndMsg(data);
      setSecretWord(null);
         setTimeout(() =>{
                setRoundEndMsg(null);
            },5000);
    });

    socketInstance.on('classement', (data) => {

      setScores(data);
    });

    socketInstance.on('error', (err: any) => {
      console.error("LE SERVEUR REJETTE L'ACTION :", err);
      alert("Erreur renvoyée par le serveur : " + (err.message || JSON.stringify(err)));
    });

    return () => {

      if (socketInstance && socketInstance.connected)
        socketInstance.emit('leave_room', { channelId: Number(reelChannelId) });
  
      socketInstance.off('connect');
      socketInstance.off('update_players');
      socketInstance.off('timer_update');
      socketInstance.off('round_start');
      socketInstance.off('word_hint');
      socketInstance.off('error');
      socketInstance.off('exception');
      socketInstance.off('secret_word');
      socketInstance.off('round_end');
      socketInstance.off('room_created');
      socketInstance.off('classement');
      socketInstance.removeAllListeners();
      socketInstance.disconnect();
    };
  }, []);

  const isMeTheDrawer = Number(drawerInfo?.drawerId) === Number(myId);

  const handleStartGame = () => {
    if (socket) {
      console.log(` Demande de démarrage du jeu pour le salon officiel #${reelChannelId}...`);
      socket.emit('start_game', { channelId: reelChannelId });
    }
  };

  const wordDisplay = () => {

    if (roundEndMsg){

      return (
        <div className="bg-amber-100 border border-amber-400 px-4 py-2 rounded-lg animate-bounce">
          <p className="text-xs font-bold uppercase tracking-widest text-amber-700">
            ⏳ Fin du tour !
          </p>
          <p className="text-lg font-bold text-amber-900">
            {roundEndMsg}
          </p>
        </div>
      );
    }
    if(secretWord) {

      return (
        <div className="animate-pulse">
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-500">
            À TOI DE DESSINER !
          </p>
          <p className="text-3xl font-mono tracking-[0.2em] font-black text-emerald-600 uppercase">
            {secretWord}
          </p>
        </div>
      );
    }
    if(wordHint) {

      return (
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Mot à deviner
          </p>
          <p className="text-3xl font-mono tracking-[0.4em] font-black text-indigo-600">
            {wordHint.hint}
          </p>
        </div>
      );
    }
    return (
      <p className="text-sm font-medium text-slate-400 italic">
        En attente du début de manche...
      </p>
    );
  };

  return (
    // 1. CONTENEUR PRINCIPAL : Prend tout l'écran avec un fond gris doux
    <div className="min-h-screen bg-slate-950 p-4 flex flex-col gap-4 font-sans text-slate-800">

      {message && (
      <div className="absolute top-6 left-1/2 transform -translate-x-1/2 z-50 bg-red-500/90 text-white px-6 py-3 rounded-full shadow-2xl border border-red-400 flex items-center gap-3 animate-bounce backdrop-blur-sm">
        <span className="text-xl">⚠️</span>
        <span className="font-bold text-sm tracking-wide">
          {/* 🚀 SÉCURITÉ ANTI-CRASH : Si le backend envoie un objet, on affiche seulement sa propriété message (ou on le convertit en texte lisible !) */}
          {typeof message === 'object' 
            ? (message.message || JSON.stringify(message)) 
            : message}
        </span>
        <button 
          onClick={() => setMessage(null)} 
          className="ml-2 bg-red-600 hover:bg-red-700 rounded-full w-6 h-6 flex items-center justify-center text-xs font-black transition-colors"
        >
          ✕
        </button>
      </div>
      )}
      {/* 2. BARRE SUPÉRIEURE : Logo, Timer, Mot Secret et Bouton */}
      <header className="bg-slate-950 px-6 py-4 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between gap-4">
        
        {/* 👉 SECTION GAUCHE : Le Logo ET le Timer bien alignés côte à côte */}
        <div className="flex items-center gap-6">
          <h1 className="text-2xl font-black tracking-wider text-indigo-600 flex items-center gap-2">
            <span>FT_SKRIBBL</span>
          </h1>

          {/* Le Timer (Fini la position absolute !) */}
          <div className={`flex items-center gap-2 text-xl font-bold px-4 py-1.5 rounded-lg border-2 shadow-sm ${
            tempsRestant <= 10 ? 'bg-red-50 border-red-500 text-red-600 animate-pulse' : 'bg-slate-950 border-slate-300 text-slate-700'
          }`}>
            <span>⏱️</span>
            <span>{tempsRestant}s</span>
          </div>
        </div>

        {/* 👉 SECTION CENTRALE : Le Mot Secret / Indice */}
        <div className="text-center flex-1">
          {wordDisplay()}
        </div>
        <button
          onClick={handleStartGame}
          className="bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-bold px-6 py-2.5 rounded-lg shadow transition-all whitespace-nowrap"
        >
          Start Game
        </button>
      </header>


      <main className="grid grid-cols-1 lg:grid-cols-4 gap-4 flex-1 min-h-[500px]">

        <aside className="bg-slate-950 p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col">
          <h3 className="font-bold text-lg text-slate-800 border-b border-slate-100 pb-3 mb-3 flex items-center justify-between">
            <span>👥 Joueurs</span>
            <span className="bg-slate-950 text-slate-600 text-xs py-1 px-2 rounded-full">{listeJoueurs.length}</span>
          </h3>

          <ul className="space-y-2 overflow-y-auto flex-1">
           {(Array.isArray(listeJoueurs) ? listeJoueurs : []).map((joueur: any, index: number) => (
            <li key={joueur?.id || index} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-100">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full shadow-sm"></span>
                <span className="font-semibold text-sm text-slate-700 truncate max-w-[100px]">
                  {joueur?.username || joueur?.name || `Joueur #${joueur?.id || index + 1}`}
                </span>
              </div>

                {/* DROITE : Score + Crayon */}
                <div className="flex items-center gap-2">
                  {/* Badge de score */}
                  <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-xs font-bold whitespace-nowrap">
                    {scores[joueur.id] || 0} pts
                  </span>
                  
                  {/* Icône crayon si c'est le dessinateur (sécurisé avec Number) */}
                  {drawerInfo && Number(drawerInfo.drawerId) === Number(joueur.id) && (
                    <span title="Dessinateur" className="text-sm drop-shadow-sm animate-pulse">✏️</span>
                  )}
                </div>

              </li>
            ))}
          </ul>
        </aside>


        <section className="col-span-1 lg:col-span-2 bg-slate-950 p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col items-center justify-center relative overflow-hidden">
          
          {/* Annonce au début de la manche (Overlay) */}
          {drawerInfo && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-6 py-2 rounded-full shadow-md text-sm font-medium z-10 animate-bounce">
              🎨 It's <span className="font-bold underline">{drawerInfo.drawerName}</span> turn to draw !
            </div>
            )}

   {/* 🚀 On utilise h-[82vh] pour forcer le navigateur à créer une colonne centrale immense */}
        <main className="flex-1 w-full h-[82vh] bg-slate-900/40 rounded-xl border border-slate-700/50 p-3 flex flex-col items-center justify-center relative overflow-hidden shadow-inner">
          
          {/* Le conteneur du canvas qui absorbe 100% de cette immense hauteur */}
          <div className="relative w-full h-full flex-1 overflow-hidden rounded-lg">
            <GameCanvas isDrawer={isMeTheDrawer} socket={socket} channelId={reelChannelId} /> 
          </div>

        </main>
        </section>


        <aside className="bg-slate-950 p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col">
          <h3 className="font-bold text-lg text-slate-800 border-b border-slate-100 pb-3 mb-3">
            Chat du Jeu
          </h3>

          {/* 👉 Le vrai chat prend maintenant tout l'espace disponible ! */}
          <div className="flex-1 overflow-hidden">
            <GameChat channelId={reelChannelId} />
          </div>
        </aside>
      </main>

    </div>
  );
  

}