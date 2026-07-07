<<<<<<< Updated upstream
import React, { useState, useEffect } from 'react';
=======
// import { useState, useEffect } from 'react';
// import { io, Socket } from 'socket.io-client';

// // On prépare notre téléphone pour appeler le serveur
// const socket = io('http://localhost:3000');

// export default function Timer() {
//   // 1. LE STATE : La variable magique qui met à jour l'écran
//   const [tempsRestant, setTempsRestant] = useState(60);

//   // 2. LE USEEFFECT : La salle d'écoute
//   useEffect(() => {
    
// 	socket.emit('join_room', { roomId: 'Room-Test', dbId: 999 });
//     // On branche notre écouteur sur le canal du serveur
//     socket.on('timer_update', (nouveauTemps) => {
//       // Dès qu'on reçoit le temps, on met à jour la variable magique
//       setTempsRestant(nouveauTemps);
//     });

//     // Règle d'or en React : on nettoie derrière soi !
//     // Si le chronomètre disparaît de l'écran, on coupe l'écouteur.
//     return () => {
//       socket.off('timer_update');
//     };
    
//   }, []); // Ce petit tableau vide signifie : "Fais ça une seule fois au chargement"

//   // 3. LE VISUEL : Ce qui s'affiche à l'écran
//   return (
//     <div style={{
//       position: 'absolute',       // Permet de le placer où l'on veut sur l'écran
//       top: '20px',                // À 20 pixels du haut
//       left: '50%',                // Pile au milieu horizontalement
//       transform: 'translateX(-50%)', // Centre parfaitement la boîte
//       fontSize: '48px',           // Taille du texte
//       fontWeight: 'bold',         // Texte en gras
//       color: tempsRestant <= 10 ? 'red' : 'black', // Devient rouge sous 10 secondes !
//       backgroundColor: '#f0f0f0', // Couleur de fond gris clair
//       padding: '10px 30px',       // Espace à l'intérieur de la boîte
//       borderRadius: '15px',       // Bords arrondis
//       border: '3px solid #ccc'    // Petite bordure
//     }}>
//       ⏱️ {tempsRestant}
//     </div>
//   );
// }

import { useState, useEffect } from 'react';
>>>>>>> Stashed changes
import { io } from 'socket.io-client';



export default function Timer() {
  const [tempsRestant, setTempsRestant] = useState(60);
  // 1. On crée un state pour stocker le socket et l'avoir dispo partout
  const [socket, setSocket] = useState<any>(null);
  useEffect(() => {
    const token = localStorage.getItem('token'); 

    // 2. On crée la connexion
    const socketInstance = io('http://localhost:3000', {
      path: '/api/socket.io',
      transports: ['websocket'],
      auth: {
        token: token
      }
    });

    setSocket(socketInstance);

    // 3. On rejoint la room
    socketInstance.emit('join_room', { roomId: 'Room-Test', dbId: 999 });

    // 4. On écoute le timer
    socketInstance.on('timer_update', (nouveauTemps) => {
      setTempsRestant(nouveauTemps);
    });

    // 5. Nettoyage
    return () => {
      socketInstance.off('timer_update');
      socketInstance.disconnect();
    };
    
  }, []); // S'exécute une seule fois



  const handleStartGame = () => {


    if(socket) {

      console.log("envoi du boutton");
      socket.emit('start_game', {roomId: 'Room-Test'});

    }


  };
  
  return (
    <> {/* <--- Balise parente ouverte (Fragment) */}
      {/* 1. Le Timer */}
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        fontSize: '48px',
        fontWeight: 'bold',
        color: tempsRestant <= 10 ? 'red' : 'black',
        backgroundColor: '#f0f0f0',
        padding: '10px 30px',
        borderRadius: '15px',
        border: '3px solid #ccc'
      }}>
        ⏱️ {tempsRestant}
      </div>

      {/* 2. Le Bouton décalé vers le bas pour ne pas chevaucher le timer absolu */}
      <div style={{ marginTop: '140px', textAlign: 'center' }}>
        <button
          onClick={handleStartGame} // Attention à la majuscule sur le S si ta fonction s'appelle handleStartGame
          style={{
            backgroundColor: '#2ecc71',
            color: 'white',
            fontSize: '20px',
            fontWeight: 'bold',
            padding: '15px 40px',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            transition: 'background-color 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#27ae60'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#2ecc71'}
        >
          Start Game
        </button>
      </div>
    </>
  );
}