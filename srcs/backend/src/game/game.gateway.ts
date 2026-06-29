import { SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({ cors: true})

export class GameGateway {
  
/* Fonction pour Dorian permettant de stocker chaque client se connectant et deconnectant etc*/


  //   tab : string[] = [];
  //   secretWord : string = "secret";
    

  //   handleConnection(client: any){

  //     this.tab.push(client.id);
  //     console.log("conexion : " , client.id);
  //     console.log("joueur actuel " ,this.tab);
      
  //   }

  //   handleDisconnect(client: any) {

  //     this.tab = this.tab.filter(id => id !== client.id);
  //     console.log("deconnexion " , client.id);
  //     console.log("joueur deco " ,this.tab);
  //   }

  //   @SubscribeMessage('draw')
  //   handleDraw(client: any, donnees : any) {

  // console.log(`✏️ Le joueur ${client.id} vient de dessiner :`, donnees);

  //     client.broadcast.emit('draw', donnees);

  //   }

  // debut de la boucle du jeu declaratio nde variable globale utilsiable dans toutes les fonctions 
    @WebSocketServer()
    server!: Server;
    secretWord: string = "";
    currentWord:  string ="";
    spectatorId : string[] = [];
    timer: any;
    timeLeft: number = 0;
    wordList : string[] = ['pomme', 'television', 'parachute', 'voiture', 'Dorian', 'harmonica'];
    currentDrawer: string = "";
    playerList: string[] = [];
    currentPlayerIndex: number = 0;
    historicDraw : string[] = [];
    currentRound: number = 1;
    roundmax: number = 3;
    playerPoints: Record<string,number> = {};

    //chaque decorateur a utilsier avant sa fonction 
    //rappel decorateur etiquette intelligente ici subscribe message un ecouteur start game qui recueprera les doneee adequates
    @SubscribeMessage('start_game')
    handleGame(client: any , data: any) {

      console.log('Game started ');
      console.log('manche numero 1');


      // random pour choix du mot secret a chaque tour stockage du joueur numero un qui dessine 
      
      this.secretWord = this.wordList[Math.floor(Math.random() * this.wordList.length)];
      this.currentDrawer = data.players[0];
      this.playerList = data.players;
      console.log(this.secretWord);
      console.log("Dessinateur :", this.currentDrawer);
     

      //on donne un indice a tout les autres joueur la taille du mot
      this.server.emit('word_hint' , {

        drawer : this.currentDrawer,
        wordLength: this.secretWord.length
      });

      // on donne le mot secret au dessinateur
     
        this.server.to(this.currentDrawer).emit('secret_word', this.secretWord);

      // tableau d historique de dessin mis a null pour stocker chaque dessi nen temps reel a recueprer niveau front
      this.historicDraw = [];
      this.timeLeft = 60;
      this.timer = setInterval(() => {

        // debut de boucle de temps decrementation sur 60 s
        this.timeLeft -= 1;
        console.log(`Temps restant : ${this.timeLeft}s`);

        if(this.timeLeft == 0){

          clearInterval(this.timer);
          this.server.emit('secret_word',`Fin du temps reglementaire le mot a deviner etait ${this.secretWord}`);
          this.wordList = this.wordList.filter(currentWord => currentWord !== this.secretWord);
          this.handleNextTurn();
        }
     },1000);
    }

    @SubscribeMessage('draw')
    handleDraw(client: any, drawData : any) { 

      // recuperation du dessin push dans tab si le dessinateur dessine
      if(client.id === this.currentDrawer){
          this.server.emit('draw', drawData);
          this.historicDraw.push(drawData);
          console.log(this.historicDraw.length);
      }
      //si spectateur essaye de dessiner message d erreur
      else
        console.log('Spectateur essaye de dessiner ')
    }

    @SubscribeMessage('request_history')
    handleRequest(client: any, drawData: any) {

        client.emit('request_history', this.historicDraw);
    }

    // fonction de verification du mot proposer si ces le bon attribution des points remise a zero du timer
    
    @SubscribeMessage('wordCheck')
    handleWordFinding(client: any, wordProposition: any){


      if(client.id === this.currentDrawer || this.spectatorId.includes(client.id))
          return;
      if(wordProposition === this.secretWord) {

        if(!this.playerPoints[client.id])
            this.playerPoints[client.id] = 0;

          clearInterval(this.timer);

          if(this.timeLeft >= 50)
            this.playerPoints[client.id] += 100;
          else if(this.timeLeft >= 40 )
            this.playerPoints[client.id] += 80;
          else if(this.timeLeft >= 30)
            this.playerPoints[client.id] += 60;
          else if(this.timeLeft >= 20 )
            this.playerPoints[client.id] += 40;
          else if(this.timeLeft >= 10 )
            this.playerPoints[client.id] += 20;
          else if(this.timeLeft > 0)
            this.playerPoints[client.id] += 5;
          this.server.emit('chat_message', `${client.id} a trouver le mot`);
          this.wordList = this.wordList.filter(currentWord => currentWord !== this.secretWord);
          this.handleNextTurn();
          }
      }

      handleNextTurn() {

        this.historicDraw = [];
        this.currentPlayerIndex += 1;
        if (!this.playerList[this.currentPlayerIndex]){
          
          if(this.currentRound >= this.roundmax){

            this.server.emit('game_over',this.playerPoints);
            return;
          }
          this.currentRound +=1;
          this.currentPlayerIndex = 0;
          this.server.emit('next_round', `Manche numero ${this.currentRound}`);
        }
        this.currentDrawer = this.playerList[this.currentPlayerIndex];
        this.secretWord = this.wordList[Math.floor(Math.random() * this.wordList.length)];
         this.server.emit('word_hint' , {

          drawer : this.currentDrawer,
          wordLength: this.secretWord.length
        });

        this.server.to(this.currentDrawer).emit('secret_word', this.secretWord);
        this.timeLeft = 60;
        this.timer = setInterval(() => {

        // debut de boucle de temps decrementation sur 60 s
        this.timeLeft -= 1;
        console.log(`Temps restant : ${this.timeLeft}s`);

        if(this.timeLeft == 0){

          clearInterval(this.timer);
          this.server.emit('chat_message',`Fin du temps reglementaire le mot a deviner etait ${this.secretWord}`);
          this.wordList = this.wordList.filter(currentWord => currentWord !== this.secretWord);
          this.handleNextTurn();
        }
     },1000);


      }
  }