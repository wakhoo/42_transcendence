import { SubscribeMessage, WebSocketGateway, WebSocketServer, OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, ConnectedSocket, MessageBody } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GameService } from './game.service';
import { socketUserMap } from '../chat/chat.gateway';
import { JwtService } from '@nestjs/jwt';



@WebSocketGateway({ cors: true, namespace: '/game'})

export class GameGateway implements OnGatewayInit, OnGatewayDisconnect{
  
  @WebSocketServer()
    server!: Server;
  
    constructor(private readonly gameService: GameService,private readonly jwtService: JwtService ) {}

    afterInit(server: Server) {

      this.gameService.server = server;
    }



    async handleConnection(client: Socket) {
    try {
      // 1. Récupération du token
      const authHeader = client.handshake.auth?.token || client.handshake.headers?.authorization;
      if (!authHeader) {
        console.log(`[GAME] Rejet : Aucun token fourni par la socket ${client.id}`);
        client.disconnect();
        return;
      }

      // 2. Nettoyage du mot "Bearer " s'il y est
      const token = authHeader.replace(/^Bearer\s+/i, '');
      
      // 3. Décodage du token pour choper le VRAI userId (et pas l'id socket !)
      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET || 'secret_par_defaut', // Adapte selon votre config
      });

      const userId = payload.sub || payload.id; // En NestJS, l'ID est souvent dans "sub" ou "id"

      if (!userId) {
        console.log(`[GAME] Rejet : ID utilisateur introuvable dans le token pour socket ${client.id}`);
        client.disconnect();
        return;
      }

      // 4. On stocke le VRAI userId (numéro) dans la Map !
      socketUserMap.set(client.id, userId);

      console.log(` [GAME] Joueur VIP #${userId} (Socket ID: ${client.id}) s'est connecté au salon /game !`);
    } catch (e) {
      console.log(`[GAME] Token invalide ou expiré pour la socket ${client.id} :`, (e as any )?.message);
      client.disconnect();
    }
  }

  
@SubscribeMessage('create_room')
  async handleRoom(@ConnectedSocket() client: Socket, @MessageBody() data: { channelId: number }) {
    const userId = socketUserMap.get(client.id); 

    console.log(`[GAME] Demande de création de la room #${data?.channelId} par le client ${client.id} (UserID de la map : ${userId})`);

    // 🚀 SÉCURITÉ : Si userId est indéfini, on prévient dans le terminal au lieu de couper en silence !
    if (!userId) {
      console.log(` [GAME] ERREUR : Impossible de créer la room car userId est indéfini pour la socket ${client.id} !`);
      client.emit('error', { message: 'Utilisateur non identifié dans la map.' });
      return;
    }

    await this.gameService.createGameSession(data.channelId, userId);
    client.join(data.channelId.toString());
    const reelPlayer = await this.gameService.getUserName(data.channelId);

    console.log(`📦 [GAME] Room #${data.channelId} créée ! Envoi de la liste update_players :`,reelPlayer);

    // Envoi à la room ET envoi direct au client pour forcer l'affichage sur son écran
    this.server.to(data.channelId.toString()).emit('update_players', reelPlayer);
    client.emit('update_players', reelPlayer);
  }




    @SubscribeMessage('join_room')
    async handleJoinRoom(@ConnectedSocket() client: Socket, @MessageBody() data: {channelId: number}) {

      const userId = socketUserMap.get(client.id);
      if(!userId) {

        client.emit('error', {message: 'User non identify'});
        return;
      }
      client.join(data.channelId.toString());
      const session = await this.gameService.joinGameSession(data.channelId, userId);
      const reelPlayer = await this.gameService.getUserName(data.channelId);
      if(session){
        this.server.to(data.channelId.toString()).emit('update_players', reelPlayer);
        client.emit('update_players', reelPlayer);}



    }
    

    @SubscribeMessage('start_game')
    async handleGame(@ConnectedSocket() client: Socket, @MessageBody() data: { channelId: number}) {

      const userId = socketUserMap.get(client.id); 
      if(!userId) {

        client.emit('error', {message: 'User non identify'});
        return;
      }
      await this.gameService.startGame(userId, data.channelId);
    }


    @SubscribeMessage('draw')
    async handleDrawing(@ConnectedSocket() client: Socket, 
            @MessageBody() data: {channelId: number, drawData: any}){


      const userId = socketUserMap.get(client.id);
      if(!userId){

        client.emit('error' , {message: "User non identify"});
        return;
      }
      this.gameService.handleDraw(userId, data.channelId, data.drawData);
    }


    @SubscribeMessage('request_history')
    async handleHistory(@ConnectedSocket() client: Socket, 
            @MessageBody() data: {channelId: number}){


      const userId = socketUserMap.get(client.id);
      if(!userId){

        client.emit('error' , {message: "User non identify"});
        return;
      }
      this.gameService.sendHistory(client.id, data.channelId);
    }


    async handleDisconnect(client: Socket) {

      const userId = socketUserMap.get(client.id);
      if(!userId){
        return;
      }
      socketUserMap.delete(client.id);
      await this.gameService.handleDisconnection(userId);
    }

}