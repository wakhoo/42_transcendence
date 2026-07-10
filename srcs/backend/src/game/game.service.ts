import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Server } from 'socket.io';
import { ChatService } from '../chat/chat.service';
import { UserService } from "../user/user.service";
import { Word } from './word.entity';
import { socketUserMap } from '../chat/chat.gateway';
import { CurrentUser } from '../chat/decorators/current-user.decorator';
import { Socket } from 'dgram';

export interface GameSession {

  channelId: number;
  totalPlayers: number;
  playersIds: number[];
  secretWord: string;
  currentDrawerId: number;
  timeLeft: number;
  timerInterval?: NodeJS.Timeout;
  scores: Record<number, number>;
  guessedUsers: number[];
  useWords: string[];
  currentRound: number;
  maxRound: number;
  historicDraw: any[];
}


@Injectable()
export class GameService {

  public server!: Server; 
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


	async startGame(userId: number, channelId: number) {

		const members = await this.ChatService.getChannelMember(channelId);
		if (members.length < 2) {

			this.server.to(`channel_${channelId}`).emit('message_channel', 'Pas assez de joueurs');
			return;
		}
		const secretWord = await this.getRandomWord();
		const index = Math.floor(Math.random() * members.length);
		const drawer = members[index];
		const newGame : GameSession ={

			channelId: channelId,
      totalPlayers: members.length,
      playersIds: members.map(member => member.user.id),
			secretWord: secretWord,
			currentDrawerId: drawer.user.id,
			timeLeft: 60,
			scores: {},
			guessedUsers: [],
			useWords: [secretWord],
      currentRound: 1,
      maxRound: 3,
      historicDraw: [],
		};

		this.activeGames.set(channelId, newGame);
		this.server.to(`channel_${channelId}`).emit('start_game', {message : `La partie commence ! C'est au tour de ${drawer.user.username} de dessiner`, 
			drawerId: drawer.user.id });

		const hintLetter = "-".repeat(secretWord.length);
		this.server.to(`channel_${channelId}`).emit('word_hint', {hint: hintLetter , length: secretWord.length} );	

		let drawerSocketId: string = "";
		for (const[socketId, id] of socketUserMap.entries()) {

			if(id === drawer.user.id){
				drawerSocketId = socketId;
				break;
			}

		}
		if(drawerSocketId !== "")
			this.server.to(drawerSocketId).emit('secret_word', secretWord);

		setTimeout(() =>{

          newGame.timerInterval = setInterval(() => {
          newGame.timeLeft -= 1;
          this.server.to(`channel_${channelId}`).emit('timer_update',newGame.timeLeft);
          if(newGame.timeLeft <= 0){

            clearInterval(newGame.timerInterval);
            this.server.to(`channel_${channelId}`).emit('secret_word',`Fin du temps reglementaire le mot a deviner etait ${newGame.secretWord}`);
            this.server.to(`channel_${channelId}`).emit('classement',newGame.scores);
            setTimeout(() =>{
              this.handleNextTurn(channelId);
            },5000);
          }
        },1000);
      },10000);
    
    }


	async checkGuess(userId: number, channelId: number, content: string, role: string) {

    const currentGame = this.activeGames.get(channelId);
    if(!currentGame)
        return false;
    
    if(content.toLowerCase() === currentGame?.secretWord.toLowerCase()){

      if(userId === currentGame?.currentDrawerId)
        return true;
      else if(currentGame.guessedUsers.includes(userId))
          return true;
      else if(role === 'spec')
          return true;
      else{

        if(!currentGame.scores[userId])
           currentGame.scores[userId] = 0;
        currentGame.scores[userId] += currentGame.timeLeft *5;
        currentGame.guessedUsers.push(userId);

        this.server.to(`channel_${channelId}`).emit('word_found', {userId});

        
        if(currentGame.guessedUsers.length === currentGame.totalPlayers - 1)
        {
          currentGame.timeLeft = 0;
          return true;
        }
        return true;
      }
    }
		return false;
	}


	async handleNextTurn(channelId: number) {

    const currentGame = this.activeGames.get(channelId);
    if (!currentGame)
        return false;
		currentGame.currentRound += 1;
    if (currentGame.currentRound > currentGame.maxRound)
    {
      this.server.to(`channel_${channelId}`).emit('game_over',currentGame.scores);
      this.activeGames.delete(channelId);
      return;
    }
    else{

     let position = currentGame.playersIds.indexOf(currentGame.currentDrawerId);
     position++;
      if (position >= currentGame.playersIds.length)
          position = 0;
      currentGame.currentDrawerId = currentGame.playersIds[position];
    }
		currentGame.secretWord = await this.getRandomWord(currentGame.useWords);
		currentGame.useWords.push(currentGame.secretWord);
    currentGame.guessedUsers =[];
    currentGame.timeLeft = 60;
    this.server.to(`channel_${channelId}`).emit('start_game', {drawerId: currentGame.currentDrawerId });

		const hintLetter = "-".repeat(currentGame.secretWord.length);
		this.server.to(`channel_${channelId}`).emit('word_hint', {hint: hintLetter , length: currentGame.secretWord.length} );	
    clearInterval(currentGame.timerInterval);
		setTimeout(() =>{

          currentGame.timerInterval = setInterval(() => {
          currentGame.timeLeft -= 1;
          this.server.to(`channel_${channelId}`).emit('timer_update',currentGame.timeLeft);
          if(currentGame.timeLeft <= 0){

            clearInterval(currentGame.timerInterval);
            this.server.to(`channel_${channelId}`).emit('secret_word',`Fin du temps reglementaire le mot a deviner etait ${currentGame.secretWord}`);
            this.server.to(`channel_${channelId}`).emit('classement',currentGame.scores);
            setTimeout(() =>{
              this.handleNextTurn(channelId);
            },5000);
          }
        },1000);
      },10000);
    
    }

    handleDraw(userId: number, channelId: number, drawData: any) {

      const currentGame = this.activeGames.get(channelId);
      if(!currentGame)
          return;
      if(userId === currentGame.currentDrawerId){


        currentGame.historicDraw.push(drawData);
        this.server.to(`channel_${channelId}`).emit('draw', {drawerId: currentGame.currentDrawerId , data: drawData } );
      }


    }


    sendHistory(clientId: string, channelId: number) {

      const currentGame = this.activeGames.get(channelId);
      if(!currentGame)
          return;
      this.server.to(clientId).emit('request_history', currentGame.historicDraw);

      }


  //     // recuperation du dessin push dans tab si le dessinateur dessine
  //     if(client.id === this.currentDrawer){
  //         this.server.to(this.roomId).emit('draw', drawData);
  //         this.historicDraw.push(drawData);
  //         console.log(this.historicDraw.length);
  //     }









    }


  //     for (let i = 0; i < this.playerList.length ; i++) {

  //       const idPlayer = this.playerList[i].dbId;
  //       this.playerPoints[idPlayer] = 0;
            
  //     }
  //     this.roomId = data.roomId;
  //     console.log('Game started in room ', this.roomId);
  //     console.log('la manche numero 1 va demaree');



  //   handleDisconnect(client: any) {

      
  //     const leftPlayer = this.playerList.find(player => player.socketId == client.id);
  //     if(!leftPlayer)
  //         return;
        
  //     this.playerList = this.playerList.filter(player => player.socketId !== client.id)
  //     if (this.playerList.length < 2){

  //         console.log("Pas assez de joueur connecter");
  //         clearInterval(this.timer);
  //         clearTimeout(this.timeOut);
  //         this.server.to(this.roomId).emit('chat_message', "Partie terminée : il n'y a plus assez de joueurs.");
  //         return;
  //     }
  //     if(leftPlayer.socketId === this.currentDrawer)
  //     {

  //       clearInterval(this.timer);
  //       clearTimeout(this.timeOut);
  //       console.log('Le dessinateur est partie');
  //       this.server.to(this.roomId).emit('chat_message',  `${client.id} c'est deconnecte`);

  //       this.currentPlayerIndex -= 1;
  //       this.handleNextTurn();
  //     }
  //   }

  //   // sauvegarde  le dessin au cas ou o ndois le reafficher (f5 par exemple)
  //   @SubscribeMessage('request_history')
  //   handleRequest(client: any, drawData: any) {

  //       client.emit('request_history', this.historicDraw);
  //   }

