
// import { useState, useEffect } from 'react';
// import { io } from 'socket.io-client';



// export default function Timer() {
//   const [tempsRestant, setTempsRestant] = useState(60);
//   // 1. On crée un state pour stocker le socket et l'avoir dispo partout
//   const [socket, setSocket] = useState<any>(null);

    
// useEffect(() => {
//     const token = localStorage.getItem('token'); 
//     console.log("Tentative de connexion en cours...");

//     const socketInstance = io('http://localhost:3000', {
//       path: '/api/socket.io',
//       transports: ['websocket'],
//       auth: { token: token }
//     });

//     setSocket(socketInstance);

//     // 📡 LES 3 RADARS DE DIAGNOSTIC
//     socketInstance.on('connect', () => {
//       console.log("🟢 CONNECTÉ AU BACKEND ! ID:", socketInstance.id);
//       // On rejoint la room QUE quand on est sûr d'être connecté
//       socketInstance.emit('join_room', { roomId: 'Room-Test', dbId: 999 });
//     });

//     socketInstance.on('connect_error', (err) => {
//       console.error("🔴 ERREUR DE CONNEXION :", err.message);
//     });

//     socketInstance.on('disconnect', (reason) => {
//       console.warn("⚠️ DÉCONNECTÉ DU BACKEND. Raison :", reason);
//     });

//     socketInstance.on('timer_update', (nouveauTemps) => {
//       setTempsRestant(nouveauTemps);
//     });

//     return () => {
//       socketInstance.off('connect');
//       socketInstance.off('connect_error');
//       socketInstance.off('disconnect');
//       socketInstance.off('timer_update');
//       socketInstance.disconnect();
//     };
    

//   }, []); // S'exécute une seule fois

//   const handleStartGame = () => {

//     if(socket) {
//       socket.emit('start_game', {roomId: 'Room-Test'});
//     }
//   };

//   return (
//     <> 
//       <div 
//         className={`absolute top-5 left-1/2 -translate-x-1/2 text-5xl font-bold bg-gray-100 px-8 py-3 rounded-2xl border-[3px] border-gray-300 ${tempsRestant <= 10 ? 'text-red-600' : 'text-black'}`}
//       >
//         ⏱️ {tempsRestant}
//       </div>

//       <div className="mt-36 text-center">
//         <button
//           onClick={handleStartGame}
//           className="bg-green-500 hover:bg-green-600 text-white text-xl font-bold py-4 px-10 rounded-lg shadow-md transition-colors duration-200"
//         >
//           Start Game
//         </button>
//         onClick={handleJoinRoom}
//         className="bg-green-500 hover:bg-green-600 text-white text-xl font-bold py-4 px-10 rounded-lg shadow-md transition-colors duration-200"
        
//       </div>
//     </>
//   );
// }


import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

export default function GamePage() {
  const [tempsRestant, setTempsRestant] = useState(60);
  const [socket, setSocket] = useState<any>(null);
  
  // 🚨 NOUVEAU STATE : Pour stocker et afficher la liste des joueurs !
  const [listeJoueurs, setListeJoueurs] = useState<any[]>([]);

  useEffect(() => {
    const token = localStorage.getItem('token'); 
    const monIdUnique = Math.floor(Math.random() * 1000); // Faux ID pour nos tests

    // Connexion
    const socketInstance = io('http://localhost:3000', {
      path: '/api/socket.io',
      transports: ['websocket'],
      auth: { token: token }
    });

    setSocket(socketInstance);

    socketInstance.on('connect', () => {
      console.log("🟢 Connecté au GameGateway !");
      
      // 🚀 ACTION AUTOMATIQUE : Dès qu'on est connecté, on rejoint la room TOUT SEUL !
      socketInstance.emit('join_room', { roomId: 'Room-Test', dbId: monIdUnique });
    });

    // 📡 ÉCOUTEUR : Dès que le serveur dit que la liste a changé, on met à jour notre écran
    socketInstance.on('update_players', (listeVenantDuBack) => {
      setListeJoueurs(listeVenantDuBack);
    });

    socketInstance.on('timer_update', (nouveauTemps) => {
      setTempsRestant(nouveauTemps);
    });

    return () => {
      socketInstance.off('connect');
      socketInstance.off('update_players');
      socketInstance.off('timer_update');
      socketInstance.disconnect();
    };
  }, []);

  const handleStartGame = () => {
    if (socket) {
      socket.emit('start_game', { roomId: 'Room-Test' });
    }
  };
  
  return (
    <div> 
      
      {/* 1. Le Timer */}
      <div className={`absolute top-5 left-1/2 -translate-x-1/2 text-5xl font-bold bg-white px-8 py-3 rounded-2xl border-[3px] border-gray-300 ${tempsRestant <= 10 ? 'text-red-600' : 'text-black'}`}>
        ⏱️ {tempsRestant}
      </div>

      {/* 2. LE TABLEAU DES JOUEURS (S'affiche tout seul !) */}
      <div className="absolute left-2 top-50 bg-white p-6 rounded-xl shadow-lg border border-gray-200 w-64">
        <h3 className="text-xl font-bold text-slate-800 mb-4 border-b pb-2">👥 Joueurs Connectés</h3>
        <ul className="space-y-2">
          {listeJoueurs.map((joueur, index) => (
            <li key={index} className="flex items-center space-x-2 bg-slate-50 p-2 rounded-lg border border-slate-200">
              <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
              <span className="font-semibold text-slate-700">Joueur #{joueur.dbId}</span>
              {/* Optionnel : afficher si c'est le dessinateur actuel */}
            </li>
          ))}
        </ul>
      </div>

      {/* 3. Le Bouton Start */}
      <div className="mt-48 text-center">
        <button
          onClick={handleStartGame}
          className="bg-green-500 hover:bg-green-600 text-white text-xl font-bold py-4 px-10 rounded-lg shadow-md transition-colors duration-200"
        >
          Start Game
        </button>
      </div>
    </div>
  );
}