import {
    ConnectedSocket,
    MessageBody,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnGatewayInit,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ChatService } from './chat.service';

const socketUserMap = new Map<string, number>();

//ChatGateway n'est absolument pas fini, il manque les 3/4

@WebSocketGateway({ cors: { origin: '*' } })
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server!: Server;

    constructor(
        private readonly chatService: ChatService,
        private readonly jwtService: JwtService,
    ) {}

    afterInit() {
        console.log('ChatGateway initialized');
    }

    async handleConnection(client: Socket) {
        try {
            const token = (client.handshake.auth as { token?: string })?.token?.replace('Bearer ', '');
            if (!token) { 
                client.disconnect(); 
                return; 
            }

            const payload = this.jwtService.verify<{ sub: number }>(token);
            socketUserMap.set(client.id, payload.sub);

            const general = await this.chatService.ensureGeneralChannel();
            void client.join(`channel_${general.id}`);

            const myChannels = await this.chatService.getMyChannels(payload.sub);
            for (const ch of myChannels) {
                void client.join(`channel_${ch.id}`);
            }

            console.log(`User ${payload.sub} connected (socket ${client.id})`);
        } catch {
            client.disconnect();
        }
    }

}
