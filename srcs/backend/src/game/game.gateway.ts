import { SubscribeMessage, WebSocketGateway, WebSocketServer, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server } from 'socket.io';
import {GameService} from './game.service';


export interface playerData {

  socketId: string;
  dbId: number;
}

@WebSocketGateway({ cors: true})

export class GameGateway implements OnGatewayDisconnect{
  
    constructor(private readonly gameService: GameService) {}
  // debut de la boucle du jeu declaratio nde variable globale utilsiable dans toutes les fonctions 
    @WebSocketServer()
    server!: Server;
    roomId: string = "";
    secretWord: string = "";
    currentWord:  string ="";
    spectatorId : string[] = [];
    player: string[] = [];
    timer: any;
    timeOut: any;
    timeLeft: number = 0;
    wordList : string[] = ['pomme', 'television', 'parachute', 'voiture', 'Dorian', 'harmonica'];
    currentDrawer: string = "";
    playerList: playerData[] = [];
    currentPlayerIndex: number = 0;
    historicDraw : string[] = [];
    currentRound: number = 1;
    roundmax: number = 3;
    playerPoints: Record<string,number> = {};

    
    //chaque decorateur a utiliser avant sa fonction 
    //rappel decorateur etiquette intelligente qui donne un ordre au framework  ici subscribe message un ecouteur start game qui recueprera les doneee adequates
    @SubscribeMessage('start_game')
    handleGame(client: any , data: any) {


      if (data.players.length  < 2) {

          console.log('manque de joueurs');
          return;
      }

      this.roomId = data.roomId;
      console.log('Game started in room ', this.roomId);
      console.log('la manche numero 1 va demaree');


      // random pour choix du mot secret a chaque tour stockage du joueur numero un qui dessine 
      
      this.secretWord = this.wordList[Math.floor(Math.random() * this.wordList.length)];
      this.playerList = data.players;
      this.currentDrawer = this.playerList[0].socketId;
      console.log(this.secretWord);
      console.log("Dessinateur :", this.currentDrawer);
     

      //on donne un indice a tout les autres joueur la taille du mot
      this.server.to(this.roomId).emit('word_hint' , {

        drawer : this.currentDrawer,
        wordLength: this.secretWord.length
      });

      // on donne le mot secret au dessinateur
     
        this.server.to(this.currentDrawer).emit('secret_word', this.secretWord);
      // tableau d historique de dessin mis a null pour stocker chaque dessi nen temps reel a recueprer niveau front
       
        this.historicDraw = [];
        this.timeOut = setTimeout(() =>{

          this.timeLeft = 60;
          this.timer = setInterval(() => {

        // debut de boucle de temps decrementation sur 60 s
          this.timeLeft -= 1;
          console.log(`Temps restant : ${this.timeLeft}s`);

          if(this.timeLeft == 0){

            clearInterval(this.timer);
            this.server.to(this.roomId).emit('secret_word',`Fin du temps reglementaire le mot a deviner etait ${this.secretWord}`);
            this.server.to(this.roomId).emit('classement',this.playerPoints);
            this.wordList = this.wordList.filter(currentWord => currentWord !== this.secretWord);
            this.timeOut = setTimeout(() =>{
              this.handleNextTurn();
            },5000);
          
          }
        },1000);
      },10000);
    
    }

    handleDisconnect(client: any) {

      
      const leftPlayer = this.playerList.find(player => player.socketId == client.id);
      if(!leftPlayer)
          return;
        
      this.playerList = this.playerList.filter(player => player.socketId !== client.id)
      if (this.playerList.length < 2){

          console.log("Pas assez de joueur connecter");
          clearInterval(this.timer);
          clearTimeout(this.timeOut);
          this.server.to(this.roomId).emit('chat_message', "Partie terminée : il n'y a plus assez de joueurs.");
          return;
      }
      if(leftPlayer.socketId === this.currentDrawer)
      {

        clearInterval(this.timer);
        clearTimeout(this.timeOut);
        console.log('Le dessinateur est partie');
        this.server.to(this.roomId).emit('chat_message',  `${client.id} c'est deconnecte`);

        this.currentPlayerIndex -= 1;
        this.handleNextTurn();
      }
    }

    @SubscribeMessage('draw')
    handleDraw(client: any, drawData : any) { 

      // recuperation du dessin push dans tab si le dessinateur dessine
      if(client.id === this.currentDrawer){
          this.server.to(this.roomId).emit('draw', drawData);
          this.historicDraw.push(drawData);
          console.log(this.historicDraw.length);
      }
      //si spectateur essaye de dessiner message d erreur ou si quelqun dessine via la console
      else
        console.log('Spectateur essaye de dessiner ')
    }


    // sauvegarde  le dessin au cas ou o ndois le reafficher (f5 par exemple)
    @SubscribeMessage('request_history')
    handleRequest(client: any, drawData: any) {

        client.emit('request_history', this.historicDraw);
    }

    // fonction de verification du mot proposer si ces le bon attribution des points remise a zero du timer
    
    @SubscribeMessage('wordCheck')
    handleWordFinding(client: any, wordProposition: any){


      //stock le dossier du joueur
      const realPlayer = this.playerList.find(player => player.socketId === client.id);
      if(!realPlayer)
          return;
      // seul ceux qui devinent on le droit de proposer un mot
      if(client.id === this.currentDrawer || this.spectatorId.includes(client.id))
          return;

      if(wordProposition === this.secretWord) {

        if(!this.playerPoints[realPlayer.dbId])
            this.playerPoints[realPlayer.dbId] = 0;

          clearInterval(this.timer);
          
          if(this.timeLeft >= 50)
            this.playerPoints[realPlayer.dbId] += 100;
          else if(this.timeLeft >= 40 )
            this.playerPoints[realPlayer.dbId] += 80;
          else if(this.timeLeft >= 30)
            this.playerPoints[realPlayer.dbId] += 60;
          else if(this.timeLeft >= 20 )
            this.playerPoints[realPlayer.dbId] += 40;
          else if(this.timeLeft >= 10 )
            this.playerPoints[realPlayer.dbId] += 20;
          else if(this.timeLeft > 0)
            this.playerPoints[realPlayer.dbId] += 5;
          this.server.to(this.roomId).emit('chat_message', `${realPlayer.dbId} a trouver le mot`);
          this.server.to(this.roomId).emit('classement',this.playerPoints);
          this.wordList = this.wordList.filter(currentWord => currentWord !== this.secretWord);

          this.timeOut = setTimeout(() => {
          this.handleNextTurn();
          },5000);
        }
      }

      handleNextTurn() {

        this.historicDraw = [];
        this.currentPlayerIndex += 1;
        //verification pour passer la manche suivante 
        if (!this.playerList[this.currentPlayerIndex]){
          
          //verification pas depassement du roundmax defini
          if(this.currentRound >= this.roundmax){

            this.server.to(this.roomId).emit('game_over',this.playerPoints);
            const matchFinalData = {

              room: this.roomId,
              players: this.playerList,
              scores: this.playerPoints,

            };
            this.gameService.saveMatchHistory(matchFinalData);
            return;
          }
          this.currentRound +=1;
          this.currentPlayerIndex = 0;
          this.server.to(this.roomId).emit('next_round', `Manche numero ${this.currentRound}`);
        }
        this.currentDrawer = this.playerList[this.currentPlayerIndex].socketId;
        this.secretWord = this.wordList[Math.floor(Math.random() * this.wordList.length)];
        this.server.to(this.roomId).emit('word_hint' , {

          drawer : this.currentDrawer,
          wordLength: this.secretWord.length
        });

        this.server.to(this.currentDrawer).emit('secret_word', this.secretWord);
        this.timeOut = setTimeout(() => {
        this.timeLeft = 60;
        this.timer = setInterval(() => {

        // debut de boucle de temps decrementation sur 60 s
        this.timeLeft -= 1;
        console.log(`Temps restant : ${this.timeLeft}s`);

        if(this.timeLeft == 0){

          clearInterval(this.timer);
          this.server.to(this.roomId).emit('chat_message',`Fin du temps reglementaire le mot a deviner etait ${this.secretWord}`);
          this.server.to(this.roomId).emit('classement',this.playerPoints);
          this.wordList = this.wordList.filter(currentWord => currentWord !== this.secretWord);
          this.timeOut = setTimeout(() =>{
            this.handleNextTurn();
          },5000)
        }
      },1000);
     },10000);
    }
  }