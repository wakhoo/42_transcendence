import { SubscribeMessage,  WebSocketGateway, WebSocketServer, OnGatewayInit, OnGatewayDisconnect, ConnectedSocket, MessageBody } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GameService } from './game.service';
import { JwtService } from '@nestjs/jwt';
import { ChatService } from '../chat/chat.service';
import { Injectable, Inject, forwardRef, ValidationPipe } from '@nestjs/common';
import { CreateRoomDto, ChannelIdDto, DrawDto } from './dto/ws-game.dto';
import { UserService } from '../user/user.service';



// creation d'une map pour lier le socket a l'user via token et mariadb
export const gameSocketUserMap = new Map<string, number>();

// point d'entree reseau 
@WebSocketGateway({ cors: { origin: process.env.NESTAUTH_URL }, namespace: '/game'})

export class GameGateway implements OnGatewayInit, OnGatewayDisconnect{

  @WebSocketServer()
    server!: Server;

    // délai de grâce avant d'acter un disconnect (ex: refresh de page = disconnect + reconnect immédiat)
    private static readonly RECONNECT_GRACE_MS = 8000;
    private readonly pendingDisconnects = new Map<number, NodeJS.Timeout>();

    constructor(@Inject(forwardRef(() => GameService)) private readonly gameService: GameService,
    private readonly jwtService: JwtService, @Inject(forwardRef(() => ChatService)) private readonly chatService: ChatService,
    private readonly userService: UserService) {}


    // partage du serveur gateway avec service pour emettre les alertes
    afterInit(server: Server) {

      this.gameService.server = server;

      // Authentification en middleware namespace : elle s'exécute AVANT que le
      // client ne reçoive l'event 'connect', donc gameSocketUserMap est garanti
      // rempli avant que le client puisse émettre join_room/get_my_id/etc.
      // (avant, l'auth se faisait dans handleConnection, un hook post-connexion :
      // le client recevait déjà 'connect' pendant que le JWT/DB check tournait
      // encore en arrière-plan, d'où les erreurs "User non identify" sporadiques,
      // surtout visibles quand la boucle d'event était chargée par une reconnexion.)
      server.use(async (client: Socket, next) => {
        try {
          const authHeader = client.handshake.auth?.token || client.handshake.headers?.authorization;
          if (!authHeader) {
            return next(new Error('Unauthorized'));
          }

          const token = authHeader.replace(/^Bearer\s+/i, '');
          const payload = await this.jwtService.verifyAsync(token);
          const userId = payload.sub || payload.id;

          if (!userId) {
            return next(new Error('Unauthorized'));
          }

          if (payload.pending2fa) {
            return next(new Error('Unauthorized'));
          }

          // Signature-only verification would still accept tokens for users deleted
          // after the token was issued, so the subject must still exist in the DB.
          const user = await this.userService.findById(userId);
          if (!user) {
            return next(new Error('Unauthorized'));
          }

          // On stocke le VRAI userId dans la Map
          gameSocketUserMap.set(client.id, userId);

          // Si un disconnect était en attente pour ce joueur (ex: refresh de page), on l'annule
          const pending = this.pendingDisconnects.get(userId);
          if (pending) {
            clearTimeout(pending);
            this.pendingDisconnects.delete(userId);
          }

          next();
        } catch {
          next(new Error('Unauthorized'));
        }
      });
    }


    @SubscribeMessage('get_my_id')
    getId(client: Socket){

      const userId = gameSocketUserMap.get(client.id);
      return {userId};
    }



 // cree une sessio n de jeu et ajoute le createur de la room
  // modifié : le front envoie maintenant un 'name' au lieu d'un 'channelId' aléatoire
  // createGameSession crée un vrai Channel en base et retourne la session avec le vrai ID
@SubscribeMessage('create_room')
  async handleRoom(@ConnectedSocket() client: Socket, @MessageBody(new ValidationPipe()) data: CreateRoomDto) {
    const userId = gameSocketUserMap.get(client.id);
    if (!userId) {
      return;
    }

    const session = await this.gameService.createGameSession(userId, data.name);
    client.join(session.channelId.toString());
    const reelPlayer = await this.gameService.getUserName(session.channelId);

    console.log(`GAME] Room #${session.channelId} created! :`,reelPlayer);

    // on renvoie le vrai channelId au créateur pour qu'il l'utilise dans les events suivants
    client.emit('room_created', { channelId: session.channelId });
    this.server.to(session.channelId.toString()).emit('update_players', reelPlayer);
    client.emit('update_players', reelPlayer);
    client.emit('new_admin', { adminId: session.creatorId });
  }



  // fait joindre un inivtee
    @SubscribeMessage('join_room')
    async handleJoinRoom(@ConnectedSocket() client: Socket, @MessageBody(new ValidationPipe()) data: ChannelIdDto) {

      
      const userId = gameSocketUserMap.get(client.id);
      if(!userId) {
        
        client.emit('error', {message: 'User non identify'});
        return;
      }

      if(this.gameService.isUserKick(data.channelId, userId)) {

        client.emit('error', { message: 'You have been kicked from the channel !' });
        client.emit('kicked_from_game', { userId: userId });
        return;
      }
     
      const roomName = data.channelId.toString();
      client.join(roomName);
      try {
        await this.chatService.joinChannel(userId, data.channelId);
      }
      catch (e) {
      }

      const session = this.gameService.getSession(data.channelId);
      if (session) {
        client.emit('room_info', { type: session.type, maxMembers: session.maxMembers, code: session.code });
      }

      // Pour que handleDisconnection sache que ce joueur fait partie du salon
      // (sinon son depart n'est jamais traite et le salon ne peut jamais etre nettoye)
      this.gameService.registerPlayer(data.channelId, userId);

      const realPlayer = await this.gameService.getUserName(data.channelId);
      if(realPlayer) {
        this.server.to(roomName).emit('update_players', realPlayer);
      }

      const adminId = this.gameService.getRoomAdmin(data.channelId);
      if(adminId)
        client.emit('new_admin', { adminId: adminId });
      // Si une partie est deja en cours dans ce salon (ex: reconnexion apres un refresh),
      // on renvoie l'etat courant au client qui vient de rejoindre pour qu'il ne parte pas de zero
      const snapshot = await this.gameService.getGameStateSnapshot(data.channelId, userId);
      if (snapshot) {
        client.emit('game_state_sync', snapshot);
      }
    }

    // ici on rejoint le jeu sans rejoindre le chat, c'est la facon la plus simple de gerer le spec
    @SubscribeMessage('join_room_as_spec')
    async handleJoinRoomAsSpec(@ConnectedSocket() client: Socket, @MessageBody(new ValidationPipe()) data: ChannelIdDto) {

      const userId = gameSocketUserMap.get(client.id);
      if (!userId) {
        client.emit('error', { message: 'User non identify' });
        return;
      }

      if (this.gameService.isUserKick(data.channelId, userId)) {
        client.emit('error', { message: 'You have been kicked from the channel!' });
        client.emit('kicked_from_game', { userId });
        return;
      }

      client.join(data.channelId.toString());

      const session = this.gameService.getSession(data.channelId);
      if (session) {
        client.emit('room_info', { type: session.type, maxMembers: session.maxMembers, isSpectator: true });
      }

      const adminId = this.gameService.getRoomAdmin(data.channelId);
      if (adminId) client.emit('new_admin', { adminId });

      // Envoyer la liste des joueurs au spec (sinon elle reste vide)
      const realPlayer = await this.gameService.getUserName(data.channelId);
      if (realPlayer) client.emit('update_players', realPlayer);

      // Si une partie est en cours, synchroniser l'état (dessin, scores, timer)
      const snapshot = await this.gameService.getGameStateSnapshot(data.channelId, userId);
      if (snapshot) client.emit('game_state_sync', snapshot);
    }

    //debut de manche 
    @SubscribeMessage('start_game')
    async handleGame(@ConnectedSocket() client: Socket, @MessageBody(new ValidationPipe()) data: ChannelIdDto) {

      const userId = gameSocketUserMap.get(client.id);
      if(!userId) {

        client.emit('error', {message: 'User non identify'});
        return;
      }
      // corrigé : startGame retourne 'not_admin' si l'utilisateur n'est pas le créateur
      // on émet l'erreur uniquement à client (pas à toute la room)
      const result = await this.gameService.startGame(userId, data.channelId);
      if (result === 'not_admin') {
        client.emit('error', {message: 'Only the room creator can start the game'});
      }
    }


    // donee du tracee a tout les joeuur du salon
    @SubscribeMessage('draw')
    async handleDrawing(@ConnectedSocket() client: Socket,
            @MessageBody(new ValidationPipe()) data: DrawDto){


      const userId = gameSocketUserMap.get(client.id);
      if(!userId){

        client.emit('error' , {message: "User non identify"});
        return;
      }
      this.gameService.handleDraw(userId, data.channelId, data.drawData);
      client.to(data.channelId.toString()).emit('draw', data.drawData);
    }



    @SubscribeMessage('leave_room')
    async handleLeaveRoom(@ConnectedSocket() client: Socket, @MessageBody(new ValidationPipe()) data: ChannelIdDto) {

      const userId = gameSocketUserMap.get(client.id);
      if(!userId)
          return;
      client.leave(data.channelId.toString());
      await this.gameService.handleDisconnection(userId);
    }


    @SubscribeMessage('clear_canvas')
    async handleClearCanvas(@ConnectedSocket() client: Socket, @MessageBody(new ValidationPipe()) data: ChannelIdDto) {

      const userId = gameSocketUserMap.get(client.id);
      if(!userId)
          return;
      
      if (this.gameService.isCurrentDrawer(data.channelId, userId))
          this.server.to(data.channelId.toString()).emit('clear_canvas');

    }

    
    async handleDisconnect(client: Socket) {

      const userId = gameSocketUserMap.get(client.id);
      if(!userId){
        return;
      }
      gameSocketUserMap.delete(client.id);

      // Si le joueur a un autre socket encore connecté (ex: autre onglet), on ne fait rien
      const stillConnected = [...gameSocketUserMap.values()].includes(userId);
      if (stillConnected) {
        return;
      }

      // On laisse un délai de grâce avant d'acter le départ, pour laisser le temps
      // à un refresh de page de se reconnecter sans faire annuler la partie
      const timeout = setTimeout(async () => {
        this.pendingDisconnects.delete(userId);
        await this.gameService.handleDisconnection(userId);
      }, GameGateway.RECONNECT_GRACE_MS);

      this.pendingDisconnects.set(userId, timeout);
    }

}