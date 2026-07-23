import { Injectable, Inject, forwardRef, OnModuleInit} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Server } from 'socket.io';
import { ChatService } from '../chat/chat.service';
import { UserService } from "../user/user.service";
import { Word } from './word.entity';
import { word as wordTab} from './word.seed';
import { Match } from './match.entity';
import { gameSocketUserMap } from './game.gateway';
import { CurrentUser } from '../chat/decorators/current-user.decorator';
import { Socket } from 'dgram';
import { channel } from 'diagnostics_channel';


//represente une partie 
export interface GameSession {

  channelId: number;
  creatorId: number;
  //totalPlayers: number;
  //playersIds: number[];
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
export class GameService implements OnModuleInit {

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


  async onModuleInit() {

    const count = await this.wordRepo.count();
    if (count === 0){

      for (const word of wordTab) {

          const newWord = this.wordRepo.create({content: word});
          await this.wordRepo.save(newWord);
      }
    }
  }

   async createGameSession(creatorId: number, name: string): Promise<GameSession> {


    const channel = await this.chatService.createChannel(creatorId, name, 'game', false);
    const newGameSession : GameSession = {

        channelId: channel.id,
        creatorId: creatorId,
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
      this.activeGames.set(channel.id, newGameSession);
      console.log(`Room #${channel.id} created by player #${creatorId}`);
      return newGameSession;
  }  


  // ajoute un joueur dans un salon de jeu et alerte les membres
  async joinGameSession(channelId: number, userId: number): Promise<GameSession | null> {

    const session = this.activeGames.get(channelId);
    if(!session){

      console.log(`Error : #${channelId} doesn't exist #`);
      return null;
    }
        // on utilise cette fois joinChannel pour ajouter un joueur
    await this.chatService.joinChannel(userId, channelId);
    session.scores[userId] = 0;

    // on peut chopper directement maintenant le nombre de joueurs depuis la DB
    const members = await this.chatService.getChannelMember(channelId);
    this.server.to(channelId.toString()).emit('message_channel', {channel: channelId, totalPlayer: members.length, userId: userId });
    // bug corrige : t'envoyait a this.server.to(`channel_${channelId}`) dans le gateway donc c'etait pas coherent avec ici donc ca pouvait pas marcher
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

    const members = await this.chatService.getChannelMember(channelId);
    if(!members)
        return [];
    // lancement de la recherche pseudode chaque joeur dans la map jusque a ce que tout le monde a repondu plus filet de securite creatio nde faux joueur
    const playerName = await Promise.all(
      members.map(async (m) => {

        try {
            const user = await this.userService.findById(m.user.id);
            return {

              id: Number(user?.id || m.user.id), username: String(user?.username || `Player #${m.user.id}`)
            };
          } catch {
            return { id: m.user.id, username: `Player #${m.user.id}`}
          }
      })
    );
    return playerName;
  }


  // debut de game choix du dessinateur plus chrono
	async startGame(userId: number, channelId: number) {


    // recuperatio ndes membres via chatservice
		const members = await this.chatService.getChannelMember(channelId);
    const playerIds = members.map(m => m.user.id)
    const session = this.activeGames.get(channelId);
		if (!session || playerIds.length < 2) {

			this.server.to(channelId.toString()).emit('message_channel', 'Not enough player');
			return;
		}
		const secretWord = await this.getRandomWord();
		const index = Math.floor(Math.random() * playerIds.length);
		const drawerId = playerIds[index];
	
    
    session.secretWord = secretWord;
    session.currentDrawerId = drawerId;
    session.timeLeft = 60;
    session.scores = {};
    session.guessedUsers = [];
    session.useWords = [secretWord];
    session.currentRound = 1;
    session.historicDraw = [];


    playerIds.forEach((id) => {
        session.scores[id] = 0;
    });


		//this.activeGames.set(channelId, newGame);
    const playerList = await this.getUserName(channelId);
    const drawerProfile = playerList.find((p) => p.id === drawerId) || { username: `Joueur #${drawerId}` };
		this.server.to(channelId.toString()).emit('round_start', {drawerName: drawerProfile.username, 
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
          if(session.guessedUsers)
          if(session.timeLeft <= 0){

            clearInterval(session.timerInterval);
            this.server.to(channelId.toString()).emit('round_end',`Fin du temps reglementaire le mot a deviner etait ${session.secretWord}`);
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

        const members = await this.chatService.getChannelMember(channelId);
        if(currentGame.guessedUsers.length === members.length - 1)
        {

          if(currentGame.timerInterval)
            clearInterval(currentGame.timerInterval);

          this.server.to(channelId.toString()).emit('round_end', `Incroyable ! Tous les joueurs ont trouvé le mot : ${currentGame.secretWord} !`);
          this.server.to(channelId.toString()).emit('classement', currentGame.scores);

          setTimeout(() => {
            this.handleNextTurn(channelId);
          }, 5000);

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

    const members = await this.chatService.getChannelMember(channelId);
    const playerIds = members.map(m => m.user.id);
     let position = playerIds.indexOf(currentGame.currentDrawerId);
     position++;
      if (position >= playerIds.length)
          position = 0;
      currentGame.currentDrawerId = playerIds[position];
    }
		currentGame.secretWord = await this.getRandomWord(currentGame.useWords);
		currentGame.useWords.push(currentGame.secretWord);
    currentGame.historicDraw = [];
    currentGame.guessedUsers =[];
    currentGame.timeLeft = 60;
    const user = await this.userService.findById(currentGame.currentDrawerId);
    const pseudo = user ? user.username : `Player #${currentGame.currentDrawerId}`;
    this.server.to(channelId.toString()).emit('round_start', {drawerName: pseudo, drawerId: currentGame.currentDrawerId });

		const hintLetter = "-".repeat(currentGame.secretWord.length);
		this.server.to(channelId.toString()).emit('word_hint', {hint: hintLetter , length: currentGame.secretWord.length} );
    for(const[socketId, id] of gameSocketUserMap.entries()) {

      if(id === currentGame.currentDrawerId)
      {
        
    
        setTimeout(() => {
        this.server.to(socketId).emit('secret_word', currentGame.secretWord);
        }, 5000);
        break;
      }
    }
		setTimeout(() =>{
          currentGame.timerInterval = setInterval(() => {
          currentGame.timeLeft -= 1;
          this.server.to(channelId.toString()).emit('timer_update',currentGame.timeLeft);
          if(currentGame.timeLeft <= 0){

            clearInterval(currentGame.timerInterval);
            this.server.to(channelId.toString()).emit('round_end',`End of time the word was ${currentGame.secretWord}`);
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
      this.server.to(clientId).emit('load_history', currentGame.historicDraw);

      }



      // gere les departs netoie la ram annule la partie etc
    async handleDisconnection(userId: number): Promise <number | null> {

      for (const[channelID, currentGame] of this.activeGames.entries()) {


          const members = await this.chatService.getChannelMember(channelID);
          const playerIds = members.map(m => m.user.id);
			    if(playerIds.includes(userId)){

				   await this.chatService.leaveChannel(userId, channelID);
           

            const remaining = await this.chatService.getChannelMember(channelID);
            const newPlayerList = await this.getUserName(channelID);
            this.server.to(channelID.toString()).emit('update_players', newPlayerList);
            if(remaining.length <= 1){

              clearInterval(currentGame.timerInterval);
              this.server.to(channelID.toString()).emit('game_cancelled', {reason : 'not_enough_players'});
              await this.chatService.deleteChannel(currentGame.creatorId, channelID);
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
  
  
  isCurrentDrawer(channelId: number, userId: number): boolean {

    const game = this.activeGames.get(channelId);
    if(!game)
        return false;
      return game.currentDrawerId === userId;
  }
}
  
