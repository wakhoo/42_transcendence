import { SubscribeMessage,  WebSocketGateway, WebSocketServer, OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, ConnectedSocket, MessageBody } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GameService } from './game.service';
import { JwtService } from '@nestjs/jwt';
import { Injectable, Inject, forwardRef } from '@nestjs/common';



// creation d'une map pour lier le socket a l'user via token et mariadb
export const gameSocketUserMap = new Map<string, number>();


// point d'entree reseau 
@WebSocketGateway({ cors: true, namespace: '/game'})

export class GameGateway implements OnGatewayInit, OnGatewayDisconnect, OnGatewayConnection{
  
  @WebSocketServer()
    server!: Server;
  
    constructor(@Inject(forwardRef(() => GameService)) private readonly gameService: GameService,private readonly jwtService: JwtService ) {}


    // partage du serverur gateway avec service pour emettre les alertes
    afterInit(server: Server) {

      this.gameService.server = server;
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
      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET || 'secret_par_defaut', 
      });

      const userId = payload.sub || payload.id;

      if (!userId) {
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
@SubscribeMessage('create_room')
  async handleRoom(@ConnectedSocket() client: Socket, @MessageBody() data: { channelId: number }) {
    const userId = gameSocketUserMap.get(client.id); 
    if (!userId) {
      return;
    }

    await this.gameService.createGameSession(data.channelId, userId);
    client.join(data.channelId.toString());
    const reelPlayer = await this.gameService.getUserName(data.channelId);

    console.log(`GAME] Room #${data.channelId} créée ! Envoi de la liste update_players :`,reelPlayer);

    // Envoi à la room ET envoi direct au client pour forcer l'affichage sur son écran
    this.server.to(data.channelId.toString()).emit('update_players', reelPlayer);
    client.emit('update_players', reelPlayer);
  }



  // fait joindre un inivtee
    @SubscribeMessage('join_room')
    async handleJoinRoom(@ConnectedSocket() client: Socket, @MessageBody() data: {channelId: number}) {

      const userId = gameSocketUserMap.get(client.id);
      if(!userId) {

        client.emit('error', {message: 'User non identify'});
        return;
      }
      client.join(data.channelId.toString());
      const session = await this.gameService.joinGameSession(data.channelId, userId);
      const reelPlayer = await this.gameService.getUserName(data.channelId);
      if(session){
        this.server.to(data.channelId.toString()).emit('update_players', reelPlayer);
        client.emit('update_players', reelPlayer);
      }

    }
    

    //debut de manche 
    @SubscribeMessage('start_game')
    async handleGame(@ConnectedSocket() client: Socket, @MessageBody() data: { channelId: number}) {

      const userId = gameSocketUserMap.get(client.id); 
      if(!userId) {

        client.emit('error', {message: 'User non identify'});
        return;
      }
      await this.gameService.startGame(userId, data.channelId);
    }


    // donee du tracee a tout les joeuur du salon
    @SubscribeMessage('draw')
    async handleDrawing(@ConnectedSocket() client: Socket, 
            @MessageBody() data: {channelId: number, drawData: any}){


      const userId = gameSocketUserMap.get(client.id);
      if(!userId){

        client.emit('error' , {message: "User non identify"});
        return;
      }
      this.gameService.handleDraw(userId, data.channelId, data.drawData);
    }



    // histrique du ddessin a un joueur qu ia par exemple actualsier la page
    @SubscribeMessage('request_history')
    async handleHistory(@ConnectedSocket() client: Socket, 
            @MessageBody() data: {channelId: number}){


      const userId = gameSocketUserMap.get(client.id);
      if(!userId){

        client.emit('error' , {message: "User non identify"});
        return;
      }
      this.gameService.sendHistory(client.id, data.channelId);
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