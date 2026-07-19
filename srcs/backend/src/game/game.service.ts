import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Server } from 'socket.io';
import { ChatService } from '../chat/chat.service';
import { UserService } from "../user/user.service";
import { Word } from './word.entity';
import { Match } from './match.entity';
import { gameSocketUserMap } from './game.gateway';
import { CurrentUser } from '../chat/decorators/current-user.decorator';
import { Socket } from 'dgram';
import { channel } from 'diagnostics_channel';


//represente une partie 
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
      @InjectRepository(Match)
      private readonly match: Repository<Match>,
      private readonly userService: UserService,

			@Inject(forwardRef(() => ChatService))
      private readonly chatService: ChatService) {}



   async createGameSession(channelId: number, creatorId: number): Promise<GameSession> {

      const newGameSession : GameSession = {

        channelId: channelId,
        totalPlayers: 1,
        playersIds: [creatorId],
        secretWord: '',
        currentDrawerId: 0,
        timeLeft: 60,
        scores: { [creatorId]: 0},
        guessedUsers: [],
        useWords: [],
        currentRound: 0,
        maxRound: 3,
        historicDraw: [],
      }   
      this.activeGames.set(channelId, newGameSession);
      console.log(`Room #${channelId} created by player #${creatorId}`);
      return newGameSession;
  }  


  // ajoute un joueur dans un salon de jeu et alerte les membres
  async joinGameSession(channelId: number, userId: number): Promise<GameSession | null> {

    const session = this.activeGames.get(channelId);
    if(!session){

      console.log(`Error : #${channelId} doesn't exist #`);
      return null;
    }
    if(!session.playersIds.includes(userId)){

      session.playersIds.push(userId);
      session.totalPlayers = session.playersIds.length;
      session.scores[userId] = 0;
    }
    this.server.to(`channel_${channelId}`).emit('message_channel', {channel: channelId, totalPlayer: session.totalPlayers, userId: userId });
    return session;
  }

      
      
  // recupere un mot aleatoire dans la base de doneee
	async getRandomWord(useWords: string[] = []): Promise<string> {


		let query =  this.wordRepo.createQueryBuilder('word');
		if(useWords.length > 0)
				query = query.where('word.content NOT IN (:...blackList)', { blackList: useWords });
		const randomWord = await query.orderBy('RAND()').getOne();
		if (!randomWord)
				return 'erreur'
		return randomWord.content;
	}



  // recupere les noms des users dans mariadb grace a l id
  async getUserName(channelId: number): Promise<Array<{id: number; username: string}>> {

    const session = this.activeGames.get(channelId);
    if(!session)
        return [];
    // lancement de la recherche pseudode chaque joeur dans la map jusque a ce que tout le monde a repondu plus filet de securite creatio nde faux joueur
    const playerName = await Promise.all(
      session.playersIds.map(async (id) => {

        try {
            const user = await this.userService.findById(id);
            return {

              id: Number(user?.id || id), username: String(user?.username || `Player #${id}`)
            };
          } catch {
            return { id: id, username: `Player #${id}`}
          }
      })
    );
    return playerName;
  }


  // debut de game choix du dessinateur plus chrono
	async startGame(userId: number, channelId: number) {


    // recuperatio ndes membres via chatservice
		//const members = await this.chatService.getChannelMember(channelId);
    const session = this.activeGames.get(channelId);
		if (!session || session.playersIds.length < 2) {

			this.server.to(channelId.toString()).emit('message_channel', 'Not enough player');
			return;
		}
		const secretWord = await this.getRandomWord();
		const index = Math.floor(Math.random() * session.playersIds.length);
		const drawerId = session.playersIds[index];
	
    
    session.secretWord = secretWord;
    session.currentDrawerId = drawerId;
    session.timeLeft = 60;
    session.scores = {};
    session.guessedUsers = [];
    session.useWords = [secretWord];
    session.currentRound = 1;


    session.playersIds.forEach((id) => {
        session.scores[id] = 0;
    });


		//this.activeGames.set(channelId, newGame);
    const playerList = await this.getUserName(channelId);
  const drawerProfile = playerList.find((p) => p.id === drawerId) || { username: `Joueur #${drawerId}` };
		this.server.to(channelId.toString()).emit('round_start', {message : `Game started! It's  ${drawerProfile.username} turn to draw`, 
			drawerId: drawerId });

		const hintLetter = "-".repeat(secretWord.length);
		this.server.to(channelId.toString()).emit('word_hint', {hint: hintLetter , length: secretWord.length} );	

		for (const[socketId, id] of gameSocketUserMap.entries()) {

			if(id === drawerId){
				this.server.to(socketId).emit('secret_word', secretWord);
				break;
			}

		}

		setTimeout(() =>{

          session.timerInterval = setInterval(() => {
         session.timeLeft -= 1;
          this.server.to(channelId.toString()).emit('timer_update',session.timeLeft);
          if(session.timeLeft <= 0){

            clearInterval(session.timerInterval);
            this.server.to(channelId.toString()).emit('secret_word',`Fin du temps reglementaire le mot a deviner etait ${session.secretWord}`);
            this.server.to(channelId.toString()).emit('classement',session.scores);
            setTimeout(() =>{
              this.handleNextTurn(channelId);
            },5000);
          }
        },1000);
      },10000);
    
    }



    // verification du mot taper dans le chat plus attribution des points
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

        this.server.to(channelId.toString()).emit('word_found', {userId});

        
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


  // passer a la manche suivante 
	async handleNextTurn(channelId: number) {

    const currentGame = this.activeGames.get(channelId);
    if (!currentGame)
        return false;
    if(currentGame.timerInterval)
      clearInterval(currentGame.timerInterval);
		currentGame.currentRound += 1;
    //fin de partie sauvgarde dans mariadb
    if (currentGame.currentRound > currentGame.maxRound)
    {
      this.server.to(channelId.toString()).emit('game_over',currentGame.scores);
      const matchHistory = this.match.create({
        channelId: currentGame.channelId,
        scores: currentGame.scores,
      });
      await this.match.save(matchHistory);
      this.activeGames.delete(channelId);
      return;
    }
    //changement de dessinateur
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
    this.server.to(channelId.toString()).emit('start_game', {drawerId: currentGame.currentDrawerId });

		const hintLetter = "-".repeat(currentGame.secretWord.length);
		this.server.to(channelId.toString()).emit('word_hint', {hint: hintLetter , length: currentGame.secretWord.length} );
    for(const[socketId, id] of gameSocketUserMap.entries()) {

      if(id === currentGame.currentDrawerId)
      {
        this.server.to(socketId).emit('secret_word', currentGame.secretWord);
        break;
      }

    }
   
		setTimeout(() =>{

          currentGame.timerInterval = setInterval(() => {
          currentGame.timeLeft -= 1;
          this.server.to(channelId.toString()).emit('timer_update',currentGame.timeLeft);
          if(currentGame.timeLeft <= 0){

            clearInterval(currentGame.timerInterval);
            this.server.to(channelId.toString()).emit('secret_word',`End of time the word was ${currentGame.secretWord}`);
            this.server.to(channelId.toString()).emit('classement',currentGame.scores);
            setTimeout(() =>{
              this.handleNextTurn(channelId);
            },5000);
          }
        },1000);
      },10000);
    
    }

    //enregistre en temps reel le dessin et le diffuse au channel 
    handleDraw(userId: number, channelId: number, drawData: any) {

      const currentGame = this.activeGames.get(channelId);
      if(!currentGame)
          return;
      if(userId === currentGame.currentDrawerId){

        currentGame.historicDraw.push(drawData);
        this.server.to(channelId.toString()).emit('draw', {drawerId: currentGame.currentDrawerId , data: drawData } );
      }
    }



//historiaue au cas ou actualisation
    sendHistory(clientId: string, channelId: number) {

      const currentGame = this.activeGames.get(channelId);
      if(!currentGame)
          return;
      this.server.to(clientId).emit('request_history', currentGame.historicDraw);

      }



      // gere les departs netoie la ram annule la partie etc
    async handleDisconnection(userId: number): Promise <number | null> {

      for (const[channelID, currentGame] of this.activeGames.entries()) {

			    if(currentGame.playersIds.includes(userId)){

				    currentGame.playersIds = currentGame.playersIds.filter(id => id != userId);
            currentGame.totalPlayers -= 1;

            const newPlayerList = await this.getUserName(channelID);
            this.server.to(channelID.toString()).emit('update_players', newPlayerList);
            if(currentGame.totalPlayers <= 1){

              clearInterval(currentGame.timerInterval);
              this.server.to(channelID.toString()).emit('game_cancelled', {reason : 'not_enough_players'});
              this.activeGames.delete(channelID);
              return null;
            }
          
            if(userId === currentGame.currentDrawerId){

              clearInterval(currentGame.timerInterval);
              this.server.to(channelID.toString()).emit('drawer_left', {drawerLeftId: userId});
              setTimeout(() =>{
                this.handleNextTurn(channelID);
                },5000);
              }
				      return channelID;
          }
        }
        return null;
      }
  }

