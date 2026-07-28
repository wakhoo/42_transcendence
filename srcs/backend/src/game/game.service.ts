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
  type?: 'public' | 'private',
  creatorId: number;
  secretWord: string;
  currentDrawerId: number;
  timeLeft: number;
  timerInterval?: NodeJS.Timeout;
  turnTimeout?: NodeJS.Timeout;
  scores: Record<number, number>;
  guessedUsers: number[];
  useWords: string[];
  currentRound: number;
  maxRound: number;
  historicDraw: any[];
  isDrawing: boolean
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
        type: 'public',
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
        isDrawing: false,
      }   
      this.activeGames.set(channel.id, newGameSession);
      console.log(`Room #${channel.id} created by player #${creatorId}`);
      return newGameSession;
  }  


  // ajoute un joueur dans un salon de jeu et alerte les membres
  async joinGameSession(channelId: number, userId: number): Promise<GameSession | null> {

    const session = this.activeGames.get(channelId);
    if(!session){
      return null;
    }
    
    try {
        await this.chatService.joinChannel(userId, channelId);
    } catch (error) {
        // Le créateur est déjà dans la BDD SQL : on ignore l'erreur et on continue tranquillement !
    }
    session.scores[userId] = 0;

    // on peut chopper directement maintenant le nombre de joueurs depuis la DB
    const members = await this.chatService.getChannelMember(channelId);
    this.server.to(channelId.toString()).emit('message_channel', `${members.length} player(s) in the room`);
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
    if(!members || members.length === 0)
        return [];
    // lancement de la recherche pseudo de chaque joeur dans la map jusque a ce que tout le monde a repondu plus filet de securite creation de faux joueur
    const playerName = await Promise.all(
      members.map(async (m) => {

        //const userId = m?.user?.id || m?.userId || m?.id;
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


    const sessionCheck = this.activeGames.get(channelId);
    if(sessionCheck){
      if (sessionCheck.timerInterval) {
            clearInterval(sessionCheck.timerInterval);
            sessionCheck.timerInterval = undefined;
        }
        if (sessionCheck.turnTimeout) {
            clearTimeout(sessionCheck.turnTimeout);
            sessionCheck.turnTimeout = undefined;
        }
    }
    // recuperatio ndes membres via chatservice
		const members = await this.chatService.getChannelMember(channelId);
    const playerIds = members.map(m => m.user.id)
    if(playerIds.length < 2){
      	this.server.to(channelId.toString()).emit('message_channel', 'Not enough player');
        return;
    }
    let session = this.activeGames.get(channelId);
		if (!session ) {

      session = {
        channelId: channelId,
        creatorId: userId,
        secretWord: '',
        currentDrawerId: -1,
        timeLeft: 60,
        scores: {},
        guessedUsers: [],
        useWords: [],
        currentRound: 1,
        maxRound: 3, 
        historicDraw: [],
        isDrawing: false
      };
		
			this.activeGames.set(channelId, session);
		}
	
    session.timeLeft = 60;
    session.scores = {};
    session.guessedUsers = [];
    session.useWords = [];
    session.currentRound = 1;
    session.historicDraw = [];
    session.currentDrawerId = -1;

    playerIds.forEach((id) => {
        session.scores[id] = 0;
    });

    await this.handleNextTurn(channelId);
  }



    // verification du mot taper dans le chat plus attribution des points
	async checkGuess(userId: number, channelId: number, content: string, role: string) {

    const currentGame = this.activeGames.get(channelId);
    if(!currentGame)
        return false;
    
    if(!currentGame.isDrawing)
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
    if(currentGame.timerInterval){
      clearInterval(currentGame.timerInterval);
      currentGame.timerInterval = undefined;
    }
    if (currentGame.turnTimeout) {
      clearTimeout(currentGame.turnTimeout);
      currentGame.turnTimeout = undefined;
    }
	
    currentGame.isDrawing = false;
    //fin de partie sauvgarde dans mariadb
   
    //changement de dessinateur
    const members = await this.chatService.getChannelMember(channelId);
    const playerIds = members.map(m => m.user.id);
     let position = playerIds.indexOf(currentGame.currentDrawerId);
     position++;
      if (position >= playerIds.length){
          position = 0;
          currentGame.currentRound += 1;
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
      }
      currentGame.currentDrawerId = playerIds[position];

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
          currentGame.isDrawing = true;  
          currentGame.timeLeft -= 1;
          this.server.to(channelId.toString()).emit('timer_update',currentGame.timeLeft);
          if(currentGame.timeLeft <= 0){

            clearInterval(currentGame.timerInterval);
            this.server.to(channelId.toString()).emit('round_end',`End of time the word was ${currentGame.secretWord}`);
            this.server.to(channelId.toString()).emit('classement',currentGame.scores);
            currentGame.turnTimeout = setTimeout(() =>{
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



  
  //   async handleDisconnection(userId: number): Promise<number | null> {
  //   for (const [channelID, currentGame] of this.activeGames.entries()) {
  //     const isCreator = currentGame.creatorId === userId;
  //     const isInScore = currentGame.scores && currentGame.scores[userId] != undefined;
      
  //     if (!isCreator && !isInScore) {
  //       continue;
  //     }

  //     // 🚀 1. On vérifie combien de joueurs sont présents AVANT le départ
  //     const currentMembers = await this.chatService.getChannelMember(channelID);


  //     if (currentMembers.length <= 2) {
  //       if (currentGame.timerInterval) {
  //         clearInterval(currentGame.timerInterval);
  //         currentGame.timerInterval = undefined;

  //       }
  //       if (currentGame.turnTimeout) {
  //         clearTimeout(currentGame.turnTimeout);
  //         currentGame.turnTimeout = undefined;
  //       }

  //       currentGame.isDrawing = false;
  //       currentGame.currentRound = 0;
  //       currentGame.currentDrawerId = 0;
  //       currentGame.secretWord = '';
  //       currentGame.guessedUsers = [];
  //       currentGame.timeLeft = 60;
  //       if (this.server) {
  //         this.server.to(channelID.toString()).emit('game_cancelled', { reason: 'not_enough_players' });
  //       }

  //       try {
  //         // Le créateur n'a pas encore fait "leaveChannel", donc la sécurité requireAdmin de ton mate RÉUSSIT !
  //         await this.chatService.leaveChannel(userId, channelID);
  //       } catch (error) {
  //         //console.error("Erreur lors de la suppression SQL du salon :", error);
  //       }

  //       if (this.server) {
  //         const newPlayerList = await this.getUserName(channelID);
  //         this.server.to(channelID.toString()).emit('update_players', newPlayerList);
  //       }
  //       if (currentMembers.length - 1 <= 0) {

  //         if (currentGame.timerInterval) 
  //           clearInterval(currentGame.timerInterval);
  //         if (currentGame.turnTimeout) 
  //           clearTimeout(currentGame.turnTimeout);

  //       this.activeGames.delete(channelID);
  //         try {
  //           await this.chatService.deleteChannel(currentGame.creatorId, channelID);
  //         }
  //         catch{}

  //       }

  //       return null;
  //     }

  //     try {
  //       await this.chatService.leaveChannel(userId, channelID);
  //     } catch {
  //       console.log(`Le joueur #${userId} était déjà parti du salon SQL #${channelID}`);
  //     }
  //     delete currentGame.scores[userId];

  //     const remaining = await this.chatService.getChannelMember(channelID);
  //     const newPlayerList = await this.getUserName(channelID);
      
  //     if (this.server) {
  //       this.server.to(channelID.toString()).emit('update_players', newPlayerList);
  //     }

  //     // SI LE DESSINATEUR A QUITTÉ EN PLEINE MANCHE :
  //     if (userId === currentGame.currentDrawerId) {
  //       if (currentGame.timerInterval) clearInterval(currentGame.timerInterval);
  //       if (currentGame.turnTimeout) clearTimeout(currentGame.turnTimeout);

  //       if (this.server) {
  //         this.server.to(channelID.toString()).emit('drawer_left', { drawerLeftId: userId });
  //       }
  //       setTimeout(() => {
  //         if (this.activeGames.has(channelID)) {
  //           this.handleNextTurn(channelID);
  //         }
  //       }, 5000);
  //     }
  //     return channelID;
  //   }
  //   return null;
  // }  

async handleDisconnection(userId: number): Promise<number | null> {
    for (const [channelID, currentGame] of this.activeGames.entries()) {
      const isCreator = currentGame.creatorId === userId;
      const isInScore = currentGame.scores && currentGame.scores[userId] != undefined;
      
      if (!isCreator && !isInScore) {
        continue;
      }

      //ON FAIT QUITTER LE JOUEUR DU SQL DIRECTEMENT
      try {
        await this.chatService.leaveChannel(userId, channelID);
      } catch {
        console.log(`Le joueur #${userId} était déjà parti du salon SQL #${channelID}`);
      }
      delete currentGame.scores[userId];

      //ON REGARDE COMBIEN DE JOUEURS IL RESTE VRAIMENT MAINTENANT
      const remainingMembers = await this.chatService.getChannelMember(channelID);
      const remainingCount = remainingMembers.length;

      // 3. SI LA ROOM EST TOTALEMENT VIDE (0 JOUEUR) : ON SUPPRIME TOUT !
      if (remainingCount === 0) {
        if (currentGame.timerInterval) clearInterval(currentGame.timerInterval);
        if (currentGame.turnTimeout) clearTimeout(currentGame.turnTimeout);
        
        this.activeGames.delete(channelID);
        try {
          await this.chatService.deleteChannel(currentGame.creatorId, channelID);
        } catch {}
        return null;
      }

      // ON MET À JOUR LA LISTE DES JOUEURS POUR CEUX QUI SONT ENCORE LÀ
      if (this.server) {
        const newPlayerList = await this.getUserName(channelID);
        this.server.to(channelID.toString()).emit('update_players', newPlayerList);
      }

      // 5. S'IL NE RESTE QU'UN SEUL JOUEUR (OU MOINS DE 2), ON ANNULE LA PARTIE !
      if (remainingCount < 2) {
        if (currentGame.timerInterval) {
          clearInterval(currentGame.timerInterval);
          currentGame.timerInterval = undefined;
        }
        if (currentGame.turnTimeout) {
          clearTimeout(currentGame.turnTimeout);
          currentGame.turnTimeout = undefined;
        }

        // On remet la room au propre pour qu'elle soit prête à relancer plus tard
        currentGame.isDrawing = false;
        currentGame.currentRound = 0;
        currentGame.currentDrawerId = 0;
        currentGame.secretWord = '';
        currentGame.guessedUsers = [];
        currentGame.timeLeft = 60;

        if (this.server) {
          this.server.to(channelID.toString()).emit('game_cancelled', { reason: 'not_enough_players' });
        }
        
        // On s'arrête là pour cette room (la partie est stoppée, mais la room reste en RAM pour le survivant)
        return null; 
      }

      // 6. S'IL RESTE AU MOINS 2 JOUEURS : LA PARTIE CONTINUE !
      // Mais si c'était le dessinateur qui est parti, on doit passer au tour suivant :
      if (userId === currentGame.currentDrawerId) {
        if (currentGame.timerInterval) clearInterval(currentGame.timerInterval);
        if (currentGame.turnTimeout) clearTimeout(currentGame.turnTimeout);

        if (this.server) {
          this.server.to(channelID.toString()).emit('drawer_left', { drawerLeftId: userId });
        }
        setTimeout(() => {
          if (this.activeGames.has(channelID)) {
            this.handleNextTurn(channelID);
          }
        }, 5000);
      }

      return channelID;
    }
    return null;
  }



  isCurrentDrawer(channelId: number, userId: number): boolean {

    const game = this.activeGames.get(channelId);
    if(!game)
        return false;
      return game.currentDrawerId === userId;
  }

  
  async findPublicRoom(): Promise<number | null> {

     for (const [channelID, currentGame] of this.activeGames.entries()) {
      
      const currentMembers = await this.chatService.getChannelMember(channelID);
        if(currentGame.type === 'public' && currentMembers.length < 8){
            return channelID;
        }
      }
       return null;
  }

 
}