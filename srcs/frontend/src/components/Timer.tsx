import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import GameChat from './GameChat';
import { useNavigate } from 'react-router-dom';
import GameCanvas from './GameCanvas';
import { getAccessToken } from '../lib/session';
import { ProfileContent } from '../pages/ProfilePage';
import DrawDrawLogo from './DrawDraw';


export default function GamePage() {

  const [myId, setMyId] = useState<number | null>(null);
  const myIdRef = useRef<number | null>(null);
  const [tempsRestant, setTempsRestant] = useState(60);
  const [socket, setSocket] = useState<any>(null);
  const [drawerInfo, setDrawerInfo] = useState<any>(null);
  const [listeJoueurs, setListeJoueurs] = useState<any[]>([]);
  const [wordHint, setWordHint] = useState<any>(null);
  const [secretWord, setSecretWord] = useState<any>(null);
  const [roundEndMsg, setRoundEndMsg] = useState<string | null>(null);
  const [showMsg, setShowMsg] = useState(false);
  const [scores, setScores] = useState<Record< number, number>>({});
  const [message, setMessage] = useState<any>(null);
  const [endGame ,setEndGame] = useState<any>(null);
  const [isGameStarted, setIsGameStarted] = useState(false);
  const [roomType, setRoomType] = useState<'public' | 'private' | undefined>(undefined);
  const [maxMembers, setMaxmembers] = useState<number | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isRoundBreak, setIsRoundBreak] = useState(false);
  const [foundWord, setWordFound] = useState<string | null>(null);
  const [openProfileId, setOpenProfileId] = useState<number | null>(null);
  

 // const queryParam = new URLSearchParams(window.location.search);
 // const reelChannelId = Number(queryParam.get('channelId')) || 1;

 const [reelChannelId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return Number(params.get('channelId'));
  });

  const [actionType] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('action');
  });
  const navigate                  = useNavigate();


  const handleLeave = () => {

      if (socket)
        socket.emit('leave_room', {channelId: reelChannelId});
      window.location.href = '/dashboard';
    };

  useEffect(() => {

    if(!socket)
        return;
    socket.on('connect', () => {

        socket.emit('get_my_id', (response : {userId : number}) => {

            if(response && response.userId){
                setMyId(response.userId);
              myIdRef.current = response.userId;
            }
  
        });
    });

  }, [socket]);


  useEffect(() => {
    let socketInstance: Socket | null = null;
    let cancelled = false;

    (async () => {
    const token = await getAccessToken();
    if(!token || !reelChannelId){
      navigate('/dashboard', {replace: true});
      return;
    }

    if (cancelled) return;

    const socket = io(`${window.location.origin}/game`, {
      auth: { token: token }, transports: ['websocket']
    });
    socketInstance = socket;

    setSocket(socket);

    socket.on('connect', () => {
      console.log("Connecté au GameGateway !");

      if (actionType === 'create') {
        console.log(`Ordre reçu : Création de la room #${reelChannelId}...`);
        socket.emit('create_room', { name: `Salon de ${sessionStorage.getItem('username') || 'Game'}` });
      } else if (actionType === 'spec') {
        console.log(`Ordre reçu : Rejoindre la room #${reelChannelId} en spectateur...`);
        socket.emit('join_room_as_spec', { channelId: reelChannelId });
      } else {
        console.log(` Ordre reçu : Rejoindre la room #${reelChannelId}...`);
        socket.emit('join_room', { channelId: reelChannelId });
      }

    });

     const handleGameCancelled = () => {

        alert("A player has left the room , game is cancelled , waiting for more players");
        handlePlayAgain();
        setDrawerInfo(null);
        setTempsRestant(0);
        setIsGameStarted(false)
        setIsGameStarted(false);
       // window.location.href = "/dashboard";

      };

       
    
    socket.on('room_created' , (data) => {

      const reelId = data.channelId;
      window.history.replaceState(null, '', `/game?channelId=${reelId}&action=join`);
      socket.emit('join_room', { channelId: Number(reelId) });

    });

    socket.on('update_players', (listeVenantDuBack) => {

      console.log(" Liste des joueurs reçue du serveur :", listeVenantDuBack);
      setListeJoueurs(listeVenantDuBack);
    });

    socket.on('room_info', (data: { type: 'public' | 'private', maxMembers: number | null, code?: string }) => {
      setRoomType(data.type);
      setMaxmembers(data.maxMembers);
    });

    // Reçu quand on (re)rejoint un salon dans lequel une partie est déjà en cours
    // (typiquement après un refresh de page) : on restaure l'état local
    socket.on('game_state_sync', (data) => {

      setIsGameStarted(true);
      setDrawerInfo({ drawerId: data.drawerId, drawerName: data.drawerName });
      setTempsRestant(data.timeLeft);
      setWordHint({ hint: data.hint, length: data.hintLength });
      setScores(data.scores);
      setRoundEndMsg(null);
      setEndGame(null);
      if (data.secretWord)
        setSecretWord(data.secretWord);
    });

    socket.on('timer_update', (nouveauTemps) => {
      setTempsRestant(nouveauTemps);
    });

    socket.on('round_start', (data) => {
      setIsGameStarted(true);
      setWordFound(null);
      setIsRoundBreak(false);
      setDrawerInfo(data);
      setSecretWord(null);
      setTempsRestant(60);
      setEndGame(null);
      setRoundEndMsg(null);
      setShowMsg(true);
      setTimeout(() => {
        setShowMsg(false);
      }, 5000);

    });

    socket.on('message_channel', (data) => {
      setMessage(data);
      setTimeout(() => {
      setMessage(null);
      }, 4000);
    });


    socket.on('word_hint', (data) => {
      setWordHint(data);
    });

    socket.on('secret_word', (data) => {
      setSecretWord(data);
    });

    socket.on('word_found', (data) => {
      if(Number(data.userId) === Number(myIdRef.current))
        setWordFound(data.word);
      if(data.scores)
          setScores(data.scores);
    });

    socket.on('round_end', (data) => {
      setRoundEndMsg(data);
      setSecretWord(null);
      setTempsRestant(0);
         setTimeout(() =>{
                setRoundEndMsg(null);
            },5000);
    });

    socket.on('classement', (data) => {

      setScores(data);
    });

    socket.on('round_break', (data) => {

      setScores(data);
      setIsRoundBreak(true);
    });

    socket.on('game_over', (data) => {

      setIsGameStarted(false);
      setEndGame(data);
      setWordHint(null);
      setSecretWord(null);
      setRoundEndMsg(null);
      setTempsRestant(0);
    });

    socket.on('error', (err: any) => {
      alert("Erreur renvoyée par le serveur : " + (err.message || JSON.stringify(err)));
    });


    socket.on('kicked_from_game', (data: { userId: number }) => {

      // Pour le spec, myIdRef peut ne pas encore être initialisé au moment du join
      // (kick reçu avant la réponse de get_my_id), donc on redirige directement
      if(actionType === 'spec' || Number(data.userId) === Number(myIdRef.current)){
       // alert("You have been kicked from the channel by admin");
        window.location.href = '/dashboard';
      }

    });

    socket.on('game_invite', (data: { targetUserId: number, channelId: number, inviterName: string }) => {

      if(data.targetUserId == myId){
        const accept = window.confirm(`${data.inviterName} is inviting you to join a game , do you want to join ?`);

        if(accept)
          window.location.href = `/dashboard?joinRoom=${data.channelId}`;
      }
    });

    socket.on('game_closed' , () => {

      window.location.href = '/dashboard';

    });

    
    socket.on('new_admin', ( data : {adminId: number }) => {

   
        if(Number(data.adminId) === Number(myIdRef.current))
          setIsAdmin(true);
        else 
          setIsAdmin(false);
    });


    socket.on('game_cancelled', handleGameCancelled);
    })();

    


    return () => {
      cancelled = true;

     if (socketInstance && socketInstance.connected) {

        socketInstance.emit('leave_room', { channelId: Number(reelChannelId) });
        setTimeout(() => {
          if (socketInstance) {
            socketInstance.disconnect();
          }
        }, 100);
      }

      if (socketInstance) {
        socketInstance.off('connect');
        socketInstance.off('update_players');
        socketInstance.off('game_state_sync');
        socketInstance.off('timer_update');
        socketInstance.off('round_start');
        socketInstance.off('word_hint');
        socketInstance.off('error');
        socketInstance.off('exception');
        socketInstance.off('secret_word');
        socketInstance.off('round_end');
        socketInstance.off('room_created');
        socketInstance.off('classement');
        socketInstance.off('message_channel');
        socketInstance.off('game_over');
        socketInstance.off('game_cancelled');
        socketInstance.off('game_closed');
        socketInstance.off('kicked_from_game');
        socketInstance.off('game_invite');
        socketInstance.off('new_admin');
        socketInstance.off('round_break');
        socketInstance.removeAllListeners();
      }
     // socketInstance.disconnect();
    };

  }, []);

  const isMeTheDrawer = Number(drawerInfo?.drawerId) === Number(myId);
  const isSpectator   = actionType === 'spec';

  const handleStartGame = () => {
    if (socket) {
      socket.emit('start_game', { channelId: reelChannelId });
    }
  };

  const handlePlayAgain = () => {

    setEndGame(null);
    setRoundEndMsg(null);
    setWordHint(null);
    setScores({});
    setDrawerInfo(null);
    setSecretWord(null);
    setTempsRestant(60);
  };

  const finalClassement = listeJoueurs.map((joueur: any) => {

    const score = endGame ? endGame[joueur.id] : scores[joueur.id];

    return{
    id: joueur.id,
    username: joueur.username || joueur.name || `Player #${joueur.id}`,
    score: score || 0,
  };
  }).sort((a: any, b: any) => b.score - a.score);



  const wordDisplay = () => {


    if (endGame) {
      return (
        <p className="text-xl font-black uppercase tracking-widest text-amber-500">
          Game over
        </p>
      );
    }

    if (roundEndMsg){

      return (
        <div className="bg-amber-100 border border-amber-400 px-4 py-2 rounded-lg animate-bounce">
          <p className="text-xs font-bold uppercase tracking-widest text-amber-700">
             End Of The Round !
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
            Your Turn To Draw !
          </p>
          <p className="text-3xl font-mono tracking-[0.2em] font-black text-emerald-600 uppercase">
            {secretWord}
          </p>
        </div>
      );
    }
    if(foundWord)
    {
      return (
        <div className="animate-bounce-short">
          <p className="text-3xl font-mono tracking-[0.4em] font-black text-emerald-600 uppercase">
            {foundWord}
          </p>
        </div>
      );
    }
    if(wordHint) {

      return (
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Word To Guess
          </p>
          <p className="text-3xl font-mono tracking-[0.4em] font-black text-indigo-600">
            {wordHint.hint}
          </p>
        </div>
      );
    }
    return (
      <p className="text-sm font-medium text-slate-400 italic">
       Waiting For The Begining...
      </p>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 p-4 flex flex-col gap-4 font-sans text-slate-800 overflow-y-auto">

      {message && (
      <div className="absolute top-6 left-1/2 transform -translate-x-1/2 z-50 bg-red-500/90 text-white px-6 py-3 rounded-full shadow-2xl border border-red-400 flex items-center gap-3 animate-bounce backdrop-blur-sm">
        <span className="text-xl">⚠️</span>
        <span className="font-bold text-sm tracking-wide">
          {/* SÉCURITÉ ANTI-CRASH : Si le backend envoie un objet, on affiche seulement sa propriété message (ou on le convertit en texte lisible !) */}
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
            <DrawDrawLogo className="text-2xl" />
          </h1>

          {/* Le Timer (Fini la position absolute !) */}
          <div className={`flex items-center gap-2 text-xl font-bold px-4 py-1.5 rounded-lg border-2 shadow-sm ${
            tempsRestant <= 10 ? 'bg-red-50 border-red-500 text-red-600 animate-pulse' : 'bg-slate-950 border-slate-300 text-slate-700'
          }`}>
            <span>⏱️</span>
            <span>{tempsRestant}s</span>
          </div>
        </div>

          {roomType === 'private' && maxMembers != null && (
            <div className="flex items-center gap-2 text-sm font-semibold px-3 py-1.5 rounded-lg bg-violet-950 border border-violet-500 text-violet-300">
              <span>Max {maxMembers} joueurs</span>
            </div>
          )}

          {isSpectator && (
            <div className="flex items-center gap-2 text-sm font-semibold px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-500 text-slate-300">
              <span>👁 Spectator</span>
            </div>
          )}

        {/* 👉 SECTION CENTRALE : Le Mot Secret / Indice */}
        <div className="text-center flex-1">
          {wordDisplay()}
        </div>
        <button
          onClick={handleLeave}
          className="bg-red-500 hover:bg-red-600 active:scale-95 text-white font-bold px-6 py-2.5 rounded-lg shadow transition-all whitespace-nowrap"
        >
          Leave Room
        </button>
        {!isGameStarted && isAdmin && (
          <button
            onClick={handleStartGame}
            className="bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-bold px-6 py-2.5 rounded-lg shadow transition-all whitespace-nowrap"
          >
            Start Game
          </button>
        )}
      </header>


      <main className="grid grid-cols-1 lg:grid-cols-4 gap-4 flex-1 min-h-[500px]">

        <aside className="bg-slate-950 p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col">
          <h3 className="font-bold text-lg text-slate-800 border-b border-slate-100 pb-3 mb-3 flex items-center justify-between">
            <span>👥 Players</span>
            <span className="bg-slate-950 text-slate-600 text-xs py-1 px-2 rounded-full">{listeJoueurs.length}</span>
          </h3>

          <ul className="space-y-2 overflow-y-auto flex-1">
           {(Array.isArray(listeJoueurs) ? listeJoueurs : []).map((joueur: any, index: number) => (
            <li key={joueur?.id || index} onClick={() => setOpenProfileId(joueur.id)} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-100 cursor-pointer hover:bg-slate-800 transition-colors">
              <div className="flex items-center gap-2.5">
                
                {joueur.avatarUrl ? (
                  <img 
                      src={joueur.avatarUrl} 
                      alt="avatar" 
                      className="w-7 h-7 rounded-md object-cover shadow-sm border border-slate-700" 
                  />
                ) : (
                  <div 
                      className="w-7 h-7 rounded-md shadow-sm border border-slate-700" 
                      style={{ backgroundColor: joueur.profileColor || '#10B981' }} 
                  />
              )}
                <span className="font-semibold text-sm text-slate-700 truncate max-w-[100px]">
                  {joueur?.username || joueur?.name || `Joueur #${joueur?.id || index + 1}`}
                </span>
              </div>

                <div className="flex items-center gap-2">
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
          
          {showMsg && drawerInfo &&  !endGame && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-6 py-2 rounded-full shadow-md text-sm font-medium z-10 animate-bounce">
               It's <span className="font-bold underline">{drawerInfo.drawerName}</span> turn to draw !
            </div>
            )}
            {isRoundBreak && !endGame && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
                <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 border-4 border-indigo-500 transform animate-bounce-short">
                  
                  <h2 className="text-3xl font-black text-center text-indigo-600 mb-2 uppercase tracking-wider">
                    End of Round !
                  </h2>
                  <p className="text-center text-slate-500 font-medium mb-6">
                    Next round starts in a few seconds...
                  </p>

                  <div className="flex flex-col gap-3">
                    {finalClassement.map((joueur, index) => (
                      <div 
                        key={joueur.id} 
                        className={`flex items-center justify-between p-4 rounded-xl font-bold text-lg
                          ${index === 0 ? 'bg-amber-100 text-amber-600 border-2 border-amber-300' : 'bg-slate-100 text-slate-700'}
                        `}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{index === 0 ? '👑' : `#${index + 1}`}</span>
                          <span>{joueur.username}</span>
                        </div>
                        <span className="text-2xl">{joueur.score} pts</span>
                      </div>
                    ))}
                  </div>

                </div>
              </div>
            )}
            {endGame ? (
            <div className="w-full h-[82vh] bg-slate-900/95 border border-slate-800 rounded-xl flex flex-col items-center justify-center p-6 shadow-2xl relative z-30 animate-fade-in">
              
              <h2 className="text-4xl lg:text-5xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 uppercase mb-2 drop-shadow">
                🏆 Game Over !
              </h2>
              <p className="text-slate-400 text-sm font-medium mb-8">
                Here are the session rankings
              </p>

              <div className="w-full max-w-md bg-slate-950 border border-slate-800/80 rounded-2xl p-4 shadow-inner flex flex-col gap-2.5 max-h-[50vh] overflow-y-auto">
                {finalClassement.map((joueur: any, index: number) => {
                  const isWinner = index === 0;
                  // Assignation des médailles pour le Top 3, sinon #4, #5...
                  const medaille = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`;

                  return (
                    <div
                      key={joueur.id}
                      className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                        isWinner
                          ? "bg-gradient-to-r from-amber-500/20 via-yellow-500/10 to-transparent border-amber-500/50 scale-[1.02] shadow-lg my-1"
                          : "bg-slate-900/60 border-slate-800 hover:border-slate-700"
                      }`}
                    >
                    
                      <div className="flex items-center gap-3.5">
                        <span className={`font-black w-7 text-center ${index > 2 ? "text-slate-500 text-xs font-mono" : "text-2xl"}`}>
                          {medaille}
                        </span>
                        <span className={`font-bold truncate max-w-[160px] ${isWinner ? "text-amber-300 text-lg font-black" : "text-slate-200 text-sm"}`}>
                          {joueur.username}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 bg-slate-950/80 px-3 py-1 rounded-lg border border-slate-800">
                        <span className={`font-mono font-bold ${isWinner ? "text-amber-400 text-lg" : "text-emerald-400 text-sm"}`}>
                          {joueur.score}
                        </span>
                        <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest">pts</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* BOUTON RETOUR AU LOBBY */}
              <button
                onClick={() => {
                  window.location.href = "/dashboard";
                }}
                className="mt-8 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-black px-8 py-3.5 rounded-xl shadow-xl hover:shadow-indigo-500/20 transition-all flex items-center gap-2 text-sm uppercase tracking-wider"
              >
                <span>⬅️ Return To Lobby</span>
              </button>
              {/* Play Again masqué pour le spectateur : il ne peut pas relancer une partie */}
              {!isSpectator && (
              <button
                onClick={handlePlayAgain}
                className="bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold px-6 py-3 rounded-xl shadow-lg hover:shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 text-sm uppercase tracking-wider border border-emerald-500/30"
              >
                <span>⬅️ Play Again</span>
              </button>
              )}

            </div>

              ) : (
        <main className="flex-1 w-full h-[50vh] lg:h-[82vh] bg-slate-900/40 rounded-xl border border-slate-700/50 p-3 flex flex-col items-center justify-center relative overflow-hidden shadow-inner">
          
          <div className="relative w-full h-full flex-1 overflow-hidden rounded-lg">
            <GameCanvas isDrawer={isMeTheDrawer} socket={socket} channelId={reelChannelId} /> 
          </div>

        </main>
          )}
        </section>

        {/* On utilise calc pour ajouter les 32px manquants au 82vh ! 👇 */}
        <aside className="h-[60vh] lg:h-[90vh] w-full lg:w-80 bg-slate-950 p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col">

          <h3 className="font-bold text-lg text-slate-800 border-b border-slate-100 pb-3 mb-3 shrink-0">
            Chat Game
          </h3>

          <div className="flex-1 overflow-hidden min-h-0">
            <GameChat channelId={reelChannelId} isSpectator={isSpectator} />
          </div>

        </aside>
      </main>

      {/* Modal de profil — clic sur un joueur dans la liste */}
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