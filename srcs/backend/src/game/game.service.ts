import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Server } from 'socket.io';
import { ChatService } from '../chat/chat.service';
import { UserService } from "../user/user.service";
import { Word } from './word.entity';
import { socketUserMap } from '../chat/chat.gateway';

export interface GameSession {

  channelId: number;
  secretWord: string;
  currentDrawerId: number;
  timeLeft: number;
  timerInterval?: NodeJS.Timeout;
  scores: Record<number, number>;
  guessedUsers: number[];
  useWords: string[];
}


@Injectable()
export class GameService {

	private activeGames = new Map<number, GameSession> ();

	constructor(	
			@InjectRepository(Word)
			private wordRepo: Repository<Word>,

			private readonly ChatService: ChatService) {}

	async getRandomWord(useWords: string[] = []): Promise<string> {


		let query =  this.wordRepo.createQueryBuilder('word');
		if(useWords.length > 0)
				query = query.where('word.content NOT IN (:...blackList)', { blackList: useWords });
		const randomWord = await query.orderBy('RAND()').getOne();
		if (!randomWord)
				return 'erreur'
		return randomWord.content;
	}


	async startGame(userId: number, channelId: number, server: Server) {

		const members = await this.ChatService.getChannelMember(channelId);
		if (members.length < 2) {

			server.to(`channel_${channelId}`).emit('message_channel', 'Pas assez de joueurs');
			return;
		}
		const secretWord = await this.getRandomWord();
		const index = Math.floor(Math.random() * members.length);
		const drawer = members[index];
		const newGame : GameSession ={

			channelId: channelId,
			secretWord: secretWord,
			currentDrawerId: drawer.user.id,
			timeLeft: 60,
			scores: {},
			guessedUsers: [],
			useWords: [secretWord],
		};

		this.activeGames.set(channelId, newGame);
		server.to(`channel_${channelId}`).emit('start_game', {message : `La partie commence ! C'est au tour de ${drawer.user.username} de dessiner`, 
			drawerId: drawer.user.id });

		const hintLetter = "-".repeat(secretWord.length);
		server.to(`channel_${channelId}`).emit('word_hint', {hint: hintLetter , length: secretWord.length} );	

		let drawerSocketId: string = "";
		for (const[socketId, id] of socketUserMap.entries()) {

			if(id === drawer.user.id){
				drawerSocketId = socketId;
				break;
			}

		}
		if(drawerSocketId !== "")
			server.to(drawerSocketId).emit('secret_word', secretWord);

		setTimeout(() =>{

          newGame.timerInterval = setInterval(() => {
          newGame.timeLeft -= 1;
          server.to(`channel_${channelId}`).emit('timer_update',newGame.timeLeft);
          if(newGame.timeLeft <= 0){

            clearInterval(newGame.timerInterval);
            server.to(`channel_${channelId}`).emit('secret_word',`Fin du temps reglementaire le mot a deviner etait ${newGame.secretWord}`);
            server.to(`channel_${channelId}`).emit('classement',newGame.scores);
            setTimeout(() =>{
              this.handleNextTurn(channelId, server);
            },5000);
          }
        },1000);
      },10000);
    
    }

	async handleNextTurn(channelId: number, server: Server) {

		prochain round pas utiliser la lsite des mots deja utilsier 
		//this.getRandomWord(newGame.useWords);
		newGame.useWords.push(newSecretWord);





//       handleNextTurn() {

//         this.wordList = this.wordList.filter(currentWord => currentWord !== this.secretWord);
//         this.historicDraw = [];
//         this.playersWhoGuessed = [];
//         this.server.to(this.roomId).emit('clear_canvas');
//         this.currentPlayerIndex += 1;
//         //verification pour passer la manche suivante 
//         if (!this.playerList[this.currentPlayerIndex]){
          
//           //verification pas depassement du roundmax defini
//           if(this.currentRound >= this.roundmax){

//             this.server.to(this.roomId).emit('game_over',this.playerPoints);
//             const matchFinalData = {

//               room: this.roomId,
//               players: this.playerList,
//               scores: this.playerPoints,

//             };
//             this.gameService.saveMatchHistory(matchFinalData);
//             return;
//           }
//           this.currentRound += 1;
//           this.currentPlayerIndex = 0;
//           this.server.to(this.roomId).emit('next_round', `Manche numero ${this.currentRound}`);
//         }
//         this.currentDrawer = this.playerList[this.currentPlayerIndex].socketId;
//         this.secretWord = this.wordList[Math.floor(Math.random() * this.wordList.length)];
//         this.server.to(this.roomId).emit('word_hint' , {

//           drawer : this.currentDrawer,
//           wordLength: this.secretWord.length
//         });

//         this.server.to(this.currentDrawer).emit('secret_word', this.secretWord);
//         this.timeOut = setTimeout(() => {
//         this.timeLeft = 60;
//         this.timer = setInterval(() => {

//         // debut de boucle de temps decrementation sur 60 s
//         this.timeLeft -= 1;
//         console.log("Temps restant :", this.timeLeft);

//         if(this.timeLeft == 0){

//           clearInterval(this.timer);
//           this.server.to(this.roomId).emit('chat_message',`Fin du temps reglementaire le mot a deviner etait ${this.secretWord}`);
//           this.server.to(this.roomId).emit('classement',this.playerPoints);
//           this.timeOut = setTimeout(() =>{
//             this.handleNextTurn();
//           },5000)
//         }
//       },1000);
//      },10000);
//     }
//   }




	}

	async checkGuess(userId: number, channelId: number, content: string) {



		return false;
	}

}

	




	saveMatchHistory(matchData: any) {

		console.log("bien recu dossier match' : ", matchData);

	}















      for (let i = 0; i < this.playerList.length ; i++) {

        const idPlayer = this.playerList[i].dbId;
        this.playerPoints[idPlayer] = 0;
            
      }
      this.roomId = data.roomId;
      console.log('Game started in room ', this.roomId);
      console.log('la manche numero 1 va demaree');



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


      if(this.playersWhoGuessed.includes(client.id))
          return;
      //stock le dossier du joueur
      const realPlayer = this.playerList.find(player => player.socketId === client.id);
      if(!realPlayer)
          return;
      // seul ceux qui devinent on le droit de proposer un mot
      if(client.id === this.currentDrawer || this.spectatorId.includes(client.id))
          return;

      if(wordProposition === this.secretWord) {

        this.playersWhoGuessed.push(client.id);
      

        // if(!this.playerPoints[realPlayer.dbId])
        //     this.playerPoints[realPlayer.dbId] = 0;

          
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
        //this.server.to(this.roomId).emit('classement',this.playerPoints);
        if(this.playersWhoGuessed.length === this.playerList.length - 1) {
          
            clearInterval(this.timer);
            this.server.to(this.roomId).emit('classement',this.playerPoints);
            this.timeOut = setTimeout(() => {

              this.handleNextTurn();
            },5000);
          }
      }
      else {

          this.server.to(this.roomId).emit('chat_message', `${realPlayer.dbId} : ${wordProposition}`);
      }
    }
