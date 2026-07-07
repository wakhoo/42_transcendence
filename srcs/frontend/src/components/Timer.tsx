
import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';



export default function Timer() {
  const [tempsRestant, setTempsRestant] = useState(60);
  // 1. On crée un state pour stocker le socket et l'avoir dispo partout
  const [socket, setSocket] = useState<any>(null);
  // useEffect(() => {
  //   const token = localStorage.getItem('token'); 

  //   // 2. On crée la connexion
  //   const socketInstance = io('http://localhost:3000', {
  //     transports: ['websocket'],
  //     auth: {
  //       token: token
  //     }
  //   });

  //   setSocket(socketInstance);

  //   // 3. On rejoint la room
  //   socketInstance.emit('join_room', { roomId: 'Room-Test', dbId: 999 });

  //   // 4. On écoute le timer
  //   socketInstance.on('timer_update', (nouveauTemps) => {
  //     setTempsRestant(nouveauTemps);
  //   });

  //   // 5. Nettoyage
  //   return () => {
  //     socketInstance.off('timer_update');
  //     socketInstance.disconnect();
  //   };
    
useEffect(() => {
    const token = localStorage.getItem('token'); 
    console.log("Tentative de connexion en cours...");

    const socketInstance = io('http://localhost:3000', {
      transports: ['websocket'],
      auth: { token: token }
    });

    setSocket(socketInstance);

    // 📡 LES 3 RADARS DE DIAGNOSTIC
    socketInstance.on('connect', () => {
      console.log("🟢 CONNECTÉ AU BACKEND ! ID:", socketInstance.id);
      // On rejoint la room QUE quand on est sûr d'être connecté
      socketInstance.emit('join_room', { roomId: 'Room-Test', dbId: 999 });
    });

    socketInstance.on('connect_error', (err) => {
      console.error("🔴 ERREUR DE CONNEXION :", err.message);
    });

    socketInstance.on('disconnect', (reason) => {
      console.warn("⚠️ DÉCONNECTÉ DU BACKEND. Raison :", reason);
    });

    socketInstance.on('timer_update', (nouveauTemps) => {
      setTempsRestant(nouveauTemps);
    });

    return () => {
      socketInstance.off('connect');
      socketInstance.off('connect_error');
      socketInstance.off('disconnect');
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