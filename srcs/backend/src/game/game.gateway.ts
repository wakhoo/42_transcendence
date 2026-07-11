import { SubscribeMessage, WebSocketGateway, WebSocketServer, OnGatewayInit, OnGatewayDisconnect, ConnectedSocket, MessageBody } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GameService } from './game.service';
import { socketUserMap } from '../chat/chat.gateway';




@WebSocketGateway({ cors: true,
  path: '/api/socket.io'})

export class GameGateway implements OnGatewayInit, OnGatewayDisconnect{
  
  @WebSocketServer()
    server!: Server;
  
    constructor(private readonly gameService: GameService) {}

    afterInit(server: Server) {

      this.gameService.server = server;
    }

    //wordList : string[] = ['pomme', 'television', 'parachute', 'voiture', 'Dorian', 'harmonica', 'guitare' ,'montagne', 'chat', 'biche'];

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