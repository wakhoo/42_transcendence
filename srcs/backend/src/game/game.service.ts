import { Injectable, Inject, forwardRef, OnModuleInit, ForbiddenException} from '@nestjs/common';
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
  type?: 'public' | 'private';
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
  isDrawing: boolean;
  currentHint: string;
  maxMembers?: number | null;
  code?: string;
  // mutex pour eviter deux appels handleNextTurn simultanement (race condition sur les await DB)
  isHandlingTurn?: boolean;
}


@Injectable()
export class GameService implements OnModuleInit {

  public server!: Server; 
	private activeGames = new Map<number, GameSession> ();
  private bannedUser = new Map<number, Set<number>>();

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

      private generateUniqueCode(): string {
      let code: string;
      do {
        code = Math.floor(10000 + Math.random() * 90000).toString();
      } while ([...this.activeGames.values()].some(session => session.code === code));
      return code;
    }

    //j'ai rajoute le nbr de rounds en argument, ce sera 3 par defaut
   async createGameSession(creatorId: number, name: string, isPrivate: boolean = false, maxMembers?: number, password?: string, maxRound?: number): Promise<GameSession> {


    const channel = await this.chatService.createChannel(creatorId, name, 'game', isPrivate, password, maxMembers);
    const newGameSession : GameSession = {

        channelId: channel.id,
        type: isPrivate ? 'private' : 'public',
        maxMembers: channel.maxMembers,
        code: isPrivate ? this.generateUniqueCode() : undefined,
        creatorId: creatorId,
        secretWord: '',
        currentDrawerId: 0,
        timeLeft: 60,
        scores: { [creatorId]: 0},
        guessedUsers: [],
        useWords: [],
        currentRound: 0,
        maxRound: maxRound ?? 3,
        historicDraw: [],
        isDrawing: false,
        currentHint: '',
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
    this.server.to(channelId.toString()).emit('new_admin', { adminId: session.creatorId });

    // on peut chopper directement maintenant le nombre de joueurs depuis la DB
    const members = await this.chatService.getChannelMember(channelId);
    this.server.to(channelId.toString()).emit('message_channel', `${members.length} player(s) in the room`);
    return session;

  }

  getSession(channelId: number): GameSession | undefined {
      return this.activeGames.get(channelId);
  }

  findRoomByCode(code: string): number | null {
    for (const [channelId, session] of this.activeGames.entries()) {
      if (session.code === code) return channelId;
    }
    return null;
  }

  // Enregistre un joueur qui rejoint via le socket 'join_room' dans le suivi de session
  // (sans quoi handleDisconnection ne le reconnait ni comme createur ni comme membre du
  // salon, ne l'enleve jamais correctement, et le salon ne peut jamais etre detecte comme vide).
  // On ne touche pas au score si le joueur est deja suivi (reconnexion en plein milieu d'une manche).
  registerPlayer(channelId: number, userId: number): void {

    const session = this.activeGames.get(channelId);
    if (!session)
        return;
    if (session.scores[userId] === undefined)
        session.scores[userId] = 0;
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
  async getUserName(channelId: number): Promise<Array<{id: number; username: string ; avatarUrl: string | null; profileColor: string | null }>> {

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

              id: Number(user?.id || m.user.id), username: String(user?.username || `Player #${m.user.id}`),
                 avatarUrl: user?.avatarUrl || null, profileColor: user?.profileColor || null
            };
          } catch {
            return { id: m.user.id, username: `Player #${m.user.id}`, avatarUrl: null, profileColor: null}
          }
      })
    );
    return playerName;
  }


  // debut de game choix du dessinateur plus chrono
	async startGame(userId: number, channelId: number) {


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
        isDrawing: false,
        currentHint: '',
      };
		
			this.activeGames.set(channelId, session);
		}

    //j'ai ajoute cette condition pour que seul l'admin puisse lancer le jeu
    if(session && userId !== session.creatorId){
      return 'not_admin';
    }

    if(session){
      if (session.timerInterval) {
            clearInterval(session.timerInterval);
            session.timerInterval = undefined;
        }
        if (session.turnTimeout) {
            clearTimeout(session.turnTimeout);
            session.turnTimeout = undefined;
        }
    }
    // recuperatio ndes membres via chatservice
		const members = await this.chatService.getChannelMember(channelId);
    const playerIds = members ? members.map(m=> m.user.id) : [];
    if(playerIds.length < 2){
      	this.server.to(channelId.toString()).emit('message_channel', 'Not enough player');
        return;
    }
   
	
    session.timeLeft = 60;
    session.scores = {};
    session.guessedUsers = [];
    session.useWords = [];
    session.currentRound = 1;
    session.historicDraw = [];
    session.currentDrawerId = -1;
    session.currentHint = '';

    playerIds.forEach((id) => {
        session.scores[id] = 0;
    });
    await this.handleNextTurn(channelId);
  }



    // verification du mot taper dans le chat plus attribution des points
	async checkGuess(userId: number, channelId: number, content: string, role: string) {


    if(typeof content !== 'string')
        return false;
    const currentGame = this.activeGames.get(channelId);
    if(!currentGame)
        return false;
    
    if(!currentGame.isDrawing)
        return false;

    if(userId === currentGame.currentDrawerId && content.toLowerCase().includes(currentGame.secretWord.toLowerCase()))
        return true;

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

        this.server.to(channelId.toString()).emit('word_found', {userId: userId, word: currentGame.secretWord, scores: currentGame.scores});

        const members = await this.chatService.getChannelMember(channelId);
        if(currentGame.guessedUsers.length === members.length - 1)
        {

          if(currentGame.timerInterval)
            clearInterval(currentGame.timerInterval);

          this.server.to(channelId.toString()).emit('round_end', `Amazing ! Every players has found the word : ${currentGame.secretWord} !`);
          this.server.to(channelId.toString()).emit('classement', currentGame.scores);

          currentGame.turnTimeout = setTimeout(() => {
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

   // j'ai utilise ca comme un mutex pour eviter deux appels concurrents pendant un await DB
    // le deuxieme appel effacerait le timerInterval du premier sans en demarrer un nouveau et ca arrete le chrono
    if (currentGame.isHandlingTurn)
        return false;
    currentGame.isHandlingTurn = true;

    try {
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
   // const members = await this.chatService.getChannelMember(channelId);
     const playerIds = Object.keys(currentGame.scores).map(Number);
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
           // this.activeGames.delete(channelId);
            return;
          }
          else{

            this.server.to(channelId.toString()).emit('round_break',currentGame.scores);
            currentGame.turnTimeout = setTimeout(() =>{
              // j'ai mis a -1 sinon ca sautait le premier joueur
              currentGame.currentDrawerId = -1;
              this.handleNextTurn(channelId);
            },10000);
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
		currentGame.currentHint = hintLetter;
		this.server.to(channelId.toString()).emit('word_hint', {hint: hintLetter , length: currentGame.secretWord.length} );
    for(const[socketId, id] of gameSocketUserMap.entries()) {

      if(id === currentGame.currentDrawerId)
      {
        
        //setTimeout(() => {
        this.server.to(socketId).emit('secret_word', currentGame.secretWord);
        //}, 5000);
      }
    }
    // j'ai enleve le timer de 10sec avant le timer, c'etait bizarre et je ne voit pas l'interet, on aurait dit un bug volontaire
    currentGame.isDrawing = true;
    currentGame.timerInterval = setInterval(() => {
      currentGame.timeLeft -= 1;
      this.server.to(channelId.toString()).emit('timer_update',currentGame.timeLeft);
      if(currentGame.timeLeft == 45){

        const firstLetter = currentGame.secretWord[0];
        const newHint = "-".repeat(currentGame.secretWord.length-1);
        const hintLetter = firstLetter + newHint;
        currentGame.currentHint = hintLetter;
        this.server.to(channelId.toString()).emit('word_hint', {hint: hintLetter , length: currentGame.secretWord.length} );

      }
      else if (currentGame.timeLeft == 25){

        let hintArray = Array(currentGame.secretWord.length).fill("-");
        hintArray[0] = currentGame.secretWord[0];
        const random  = Math.floor(Math.random() * (currentGame.secretWord.length - 1) + 1);
        hintArray[random] = currentGame.secretWord[random];
        const hintLetter = hintArray.join("");
        currentGame.currentHint = hintLetter;
        this.server.to(channelId.toString()).emit('word_hint', {hint: hintLetter , length: currentGame.secretWord.length} );

      }
      if(currentGame.timeLeft <= 0){

        clearInterval(currentGame.timerInterval);
        this.server.to(channelId.toString()).emit('round_end',`End of time the word was ${currentGame.secretWord}`);
        this.server.to(channelId.toString()).emit('classement',currentGame.scores);
        currentGame.turnTimeout = setTimeout(() =>{
          this.handleNextTurn(channelId);
        },5000);
      }
    },1000);
    } finally {
      // relache le verrou meme si une exception est lancee
      currentGame.isHandlingTurn = false;
    }
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
      const remainingPlayerIds = Object.keys(currentGame.scores).map(Number);
      const remainingCount = remainingPlayerIds.length;

      if (isCreator && remainingCount > 0){
        let newAdmin = remainingPlayerIds[0];

        for(const playerId of remainingPlayerIds){

          const role = await this.chatService.getMemberRole(playerId, channelID);
          if(role === 'admin'){

            newAdmin = playerId;
            break;
          }
        }

      currentGame.creatorId = newAdmin;
      this.server.to(channelID.toString()).emit('new_admin', { adminId: currentGame.creatorId });
      }
       //SI LA ROOM EST TOTALEMENT VIDE: ON SUPPRIME TOUT !
      if (remainingCount === 0) {
        if (currentGame.timerInterval) clearInterval(currentGame.timerInterval);
        if (currentGame.turnTimeout) clearTimeout(currentGame.turnTimeout);
        
        this.activeGames.delete(channelID);
        try {
          // deleteChannel exige que currentGame.creatorId soit encore admin en base,
          // hors on vient de retirer sa propre ligne juste au dessus (leaveChannel) :
          // on utilise donc le nettoyage automatique, qui verifie juste que le salon
          // est vraiment vide en base plutot que de dependre d'un check admin
          await this.chatService.deleteChannelIfEmpty(channelID);
        } catch {}
        return null;
      }

      // ON MET À JOUR LA LISTE DES JOUEURS POUR CEUX QUI SONT ENCORE LÀ
      if (this.server) {
        const newPlayerList = await this.getUserName(channelID);
        this.server.to(channelID.toString()).emit('update_players', newPlayerList);
      }

      // S'IL NE RESTE QU'UN SEUL JOUEUR , ON ANNULE LA PARTIE !
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
        currentGame.currentHint = '';

        if (this.server) {
          this.server.to(channelID.toString()).emit('game_cancelled', { reason: 'not_enough_players' });
        }
        
        // On s'arrête là pour cette room (la partie est stoppée, mais la room reste en RAM pour le survivant)
        return null; 
      }

      // S'IL RESTE AU MOINS 2 JOUEURS : LA PARTIE CONTINUE !
      // Mais si c'était le dessinateur qui est parti, on doit passer au tour suivant :
      if (userId === currentGame.currentDrawerId&& currentGame.currentRound <= currentGame.maxRound && currentGame.currentRound > 0 ) {
        if (currentGame.timerInterval)
          clearInterval(currentGame.timerInterval);
        if (currentGame.turnTimeout)
          clearTimeout(currentGame.turnTimeout);

        if (this.server) {
          this.server.to(channelID.toString()).emit('drawer_left', { drawerLeftId: userId });
        }
        currentGame.turnTimeout = setTimeout(() => {
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

  // Reconstitue l'etat courant d'une partie deja en cours pour un joueur qui
  // (re)rejoint le salon (ex: refresh de page en plein milieu d'une manche),
  // pour qu'il retrouve son chrono, le dessin deja fait et ses outils si c'est lui qui dessine.
  async getGameStateSnapshot(channelId: number, userId: number) {

    const currentGame = this.activeGames.get(channelId);
    if (!currentGame || !currentGame.isDrawing)
        return null;

    const drawer = await this.userService.findById(currentGame.currentDrawerId);
    const drawerName = drawer ? drawer.username : `Player #${currentGame.currentDrawerId}`;

    return {
      drawerId: currentGame.currentDrawerId,
      drawerName: drawerName,
      timeLeft: currentGame.timeLeft,
      hint: currentGame.currentHint,
      hintLength: currentGame.secretWord.length,
      historicDraw: currentGame.historicDraw,
      scores: currentGame.scores,
      secretWord: userId === currentGame.currentDrawerId ? currentGame.secretWord : undefined,
    };
  }

  getSecretWord(channelId: number): string {
    return this.activeGames.get(channelId)?.secretWord ?? '';
  }

  async forcedRemovePlayer(channelId: number, kickedUserId: number) {


    if (this.server)
        this.server.to(channelId.toString()).emit('kicked_from_game', {userId: kickedUserId})

    await this.handleDisconnection(kickedUserId);
  }

  banUserFromChannel(channelId: number, userId: number) {

    if(!this.bannedUser.has(channelId))
      this.bannedUser.set(channelId, new Set());

    this.bannedUser.get(channelId)!.add(userId);

  }

  isUserKick(channelId: number , userId: number): boolean {

    const kicked = this.bannedUser.get(channelId);
    return kicked ? kicked.has(userId) : false;

  }

  async forceCloseGame(channelId: number) {


    if(this.server)
        this.server.to(channelId.toString()).emit('game_closed');

    this.activeGames.delete(channelId);
  }

  async sendInviteNotif(targetUserId: number, channelId: number, inviterName: String){

      if(this.server){

        this.server.emit('game_invite', {

          targetUserId: targetUserId,
          channelId: channelId,
          inviterName: inviterName
        });
      }
  }


  getRoomAdmin(channelId: number): number | null {

    const session = this.activeGames.get(channelId);
    return session ? session.creatorId : null;

  }
}


