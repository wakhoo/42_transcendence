import { SubscribeMessage, WebSocketGateway, WebSocketServer, OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, ConnectedSocket, MessageBody } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GameService } from './game.service';
import { socketUserMap } from '../chat/chat.gateway';
import { JwtService } from '@nestjs/jwt';



@WebSocketGateway({ cors: true,
  path: '/api/socket.io'})

export class GameGateway implements OnGatewayInit, OnGatewayDisconnect{
  
  @WebSocketServer()
    server!: Server;
  
    constructor(private readonly gameService: GameService,private readonly jwtService: JwtService ) {}

    afterInit(server: Server) {

      this.gameService.server = server;
    }


    async handleConnection(client: Socket) {

      try {

        const token = client.handshake.auth.token;
        if(!token){

          client.disconnect();
          return;
        }
        const payload = await this.jwtService.verifyAsync<{ id: number }>(token);
        const userId = payload.id;

        socketUserMap.set(client.id, userId);
      }
      catch (error) {
        client.disconnect();

      }

    }





    @SubscribeMessage('create_room')
    async handleRoom(@ConnectedSocket() client: Socket, @MessageBody() data: {channelId: number}) {

      const userId = socketUserMap.get(client.id); 
      if(!userId) {

        client.emit('error', {message: 'User non identify'});
        return;
      }
      const session = await this.gameService.createGameSession(data.channelId,userId);
      client.join(data.channelId.toString());
      this.server.to(data.channelId.toString()).emit('update_players', session.playersIds);

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
      if(session)
        this.server.to(data.channelId.toString()).emit('update_players', session.playersIds);


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