import { SubscribeMessage, WebSocketGateway, WebSocketServer, OnGatewayDisconnect, ConnectedSocket, MessageBody } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GameService } from './game.service';
import { socketUserMap } from '../chat/chat.gateway';





@WebSocketGateway({ cors: true,
  path: '/api/socket.io'})

export class GameGateway{
  
    constructor(private readonly gameService: GameService) {}
    server!: Server;

    //wordList : string[] = ['pomme', 'television', 'parachute', 'voiture', 'Dorian', 'harmonica', 'guitare' ,'montagne', 'chat', 'biche'];

    @SubscribeMessage('start_game')
    async handleGame(@ConnectedSocket() client: Socket, @MessageBody() data: { channelId: number}) {

      const userId = socketUserMap.get(client.id); 
      if(!userId) {

        client.emit('error', {message: 'Utilisateur non identifie'});
        return;
      }
      await this.gameService.startGame(userId, data.channelId, this.server);
    }
}






