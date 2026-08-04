import { SubscribeMessage,  WebSocketGateway, WebSocketServer, OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, ConnectedSocket, MessageBody } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GameService } from './game.service';
import { JwtService } from '@nestjs/jwt';
import { ChatService } from '../chat/chat.service';
import { Injectable, Inject, forwardRef, ValidationPipe } from '@nestjs/common';
import { CreateRoomDto, ChannelIdDto, DrawDto } from './dto/ws-game.dto';



// creation d'une map pour lier le socket a l'user via token et mariadb
export const gameSocketUserMap = new Map<string, number>();


// point d'entree reseau 
@WebSocketGateway({ cors: true, namespace: '/game'})

export class GameGateway implements OnGatewayInit, OnGatewayDisconnect, OnGatewayConnection{
  
  @WebSocketServer()
    server!: Server;
  
    constructor(@Inject(forwardRef(() => GameService)) private readonly gameService: GameService,
    private readonly jwtService: JwtService, @Inject(forwardRef(() => ChatService)) private readonly chatService: ChatService) {}


    // partage du serveur gateway avec service pour emettre les alertes
    afterInit(server: Server) {

      this.gameService.server = server;
    }


    @SubscribeMessage('get_my_id')
    getId(client: Socket){

      const userId = gameSocketUserMap.get(client.id);
      return {userId};
    }

    async handleConnection(client: Socket) {
    try {
      //  Récupération du token
      const authHeader = client.handshake.auth?.token || client.handshake.headers?.authorization;
      if (!authHeader) {
        client.disconnect();
        return;
      }

      // Nettoyage du mot "Bearer " s'il y est
      const token = authHeader.replace(/^Bearer\s+/i, '');
      
      // Décodage cle secrete  pour verifier que token pas flasifier)
      const payload = await this.jwtService.verifyAsync(token);

      const userId = payload.sub || payload.id;

      if (!userId) {
        client.disconnect();
        return;
      }

      if (payload.pending2fa) {
        client.disconnect();
        return;
      }

      // On stocke le VRAI userId dans la Map
      gameSocketUserMap.set(client.id, userId);

    } catch {
      client.disconnect();
    }
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
  }



  // fait joindre un inivtee
    @SubscribeMessage('join_room')
    async handleJoinRoom(@ConnectedSocket() client: Socket, @MessageBody(new ValidationPipe()) data: ChannelIdDto) {

      const userId = gameSocketUserMap.get(client.id);
      if(!userId) {

        client.emit('error', {message: 'User non identify'});
        return;
      }
     
      const roomName = data.channelId.toString();
      client.join(roomName);
      try {
        await this.chatService.joinChannel(userId, data.channelId);
      }
      catch (e)
      {}

      const realPlayer = await this.gameService.getUserName(data.channelId);
      if(realPlayer) {
        this.server.to(roomName).emit('update_players', realPlayer);
      }
    }

    // @SubscribeMessage('join_public_room')
    // async handleJoinPublicRoom(@ConnectedSocket() client: Socket, @MessageBody() data: {channelId: number}) {

    //   const userId = gameSocketUserMap.get(client.id);
    //   if(!userId) {

    //     client.emit('error', {message: 'User non identify'});
    //     return;
    //   }

    //   const channelFound = await this.gameService.findPublicRoom();
    //   if(channelFound)
    //     client.emit('public_room_found', { channelId: channelFound });
    //   else
    //     client.emit('error', { message: 'No public room yet you can create one !' });
    // }
    

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

      await this.gameService.handleDisconnection(userId); 


      
    }

}