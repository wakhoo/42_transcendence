import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

// On prépare notre téléphone pour appeler le serveur
const socket = io();

export default function Timer() {
  // 1. LE STATE : La variable magique qui met à jour l'écran
  const [tempsRestant, setTempsRestant] = useState(60);

  // 2. LE USEEFFECT : La salle d'écoute
  useEffect(() => {
    
	socket.emit('join_room', { roomId: 'Room-Test', dbId: 999 });
    // On branche notre écouteur sur le canal du serveur
    socket.on('timer_update', (nouveauTemps) => {
      // Dès qu'on reçoit le temps, on met à jour la variable magique
      setTempsRestant(nouveauTemps);
    });

    // Règle d'or en React : on nettoie derrière soi !
    // Si le chronomètre disparaît de l'écran, on coupe l'écouteur.
    return () => {
      socket.off('timer_update');
    };
    
  }, []); // Ce petit tableau vide signifie : "Fais ça une seule fois au chargement"

  // 3. LE VISUEL : Ce qui s'affiche à l'écran
  return (
    <div style={{
      position: 'absolute',       // Permet de le placer où l'on veut sur l'écran
      top: '20px',                // À 20 pixels du haut
      left: '50%',                // Pile au milieu horizontalement
      transform: 'translateX(-50%)', // Centre parfaitement la boîte
      fontSize: '48px',           // Taille du texte
      fontWeight: 'bold',         // Texte en gras
      color: tempsRestant <= 10 ? 'red' : 'black', // Devient rouge sous 10 secondes !
      backgroundColor: '#f0f0f0', // Couleur de fond gris clair
      padding: '10px 30px',       // Espace à l'intérieur de la boîte
      borderRadius: '15px',       // Bords arrondis
      border: '3px solid #ccc'    // Petite bordure
    }}>
      ⏱️ {tempsRestant}
    </div>
  );
}