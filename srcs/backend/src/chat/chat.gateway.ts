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

@WebSocketGateway({ cors: { origin: '*' } }) //a changer pour n'accepter que les connexions depuis le site
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
            void client.join(`channel_${general.id}`); //void sert a ne pas attendre une promise

            const myChannels = await this.chatService.getMyChannels(payload.sub);
            for (const ch of myChannels) {
                void client.join(`channel_${ch.id}`);
            }

            console.log(`User ${payload.sub} connected (socket ${client.id})`);
        } catch {
            client.disconnect();
        }
    }

    handleDisconnect(client: Socket) {
        const userId = socketUserMap.get(client.id);
        socketUserMap.delete(client.id);
        console.log(`User ${userId ?? '?'} disconnected (socket ${client.id})`);
    }

    // ── Événements reçus depuis le frontend ──────────────────────────────────

    // Elvelida envoie par exemple : socket.emit('joinChannel', { channelId: 3, password: 'secret'  }); , nestjs reconnait joinChannel et lance cette fonction grace a subscribemessage
    @SubscribeMessage('joinChannel')
    async onJoinChannel(@ConnectedSocket() client: Socket, @MessageBody() data: { channelId: number; password?: string }) { //ici je recupere tes arguments avec messageBody, c'est donc important que tu me les envoies exactement dans ce format
        const userId = socketUserMap.get(client.id); //j'ai fait plus haut une map qui me permet de recup le userId depuis le Socket.id
        if (!userId)
            return;
        try {
            await this.chatService.joinChannel(userId, data.channelId, data.password); //ici chat.service va verifier si userID peut rentrer dans channelID
            void client.join(`channel_${data.channelId}`);
            client.emit('joinedChannel', { channelId: data.channelId }); //si aucune exception n'est lancee je te renvoie ca pour te dire que ca a marche, il faut donc que dans ton code tu ais la fonction joinedChannel
        } catch (e) {
            client.emit('error', { message: (e as Error).message }); //sinon je te renvoie directement le message d'erreur de l'exception
        }
    }

    // Meme principe pour les autres fonctions
    @SubscribeMessage('leaveChannel')
    async onLeaveChannel(@ConnectedSocket() client: Socket, @MessageBody() data: { channelId: number } ) {
        const userId = socketUserMap.get(client.id);
        if (!userId)
            return;
        try {
            await this.chatService.leaveChannel(userId, data.channelId);
            void client.leave(`channel_${data.channelId}`);
            client.emit('leftChannel', { channelId: data.channelId });
        } catch (e) {
            client.emit('error', { message: (e as Error).message });
        }
    }

    @SubscribeMessage('sendMessage')
    async onSendMessage( @ConnectedSocket() client: Socket, @MessageBody() data: { channelId: number; content: string } ) {
        const userId = socketUserMap.get(client.id);
        if (!userId) 
            return;
        try {
            const message = await this.chatService.sendMessage(userId, data.channelId, data.content);
            const role = await this.chatService.getMemberRole(userId, data.channelId); //je t'envoie egalement le role si jamais tu veux colorer les pseudos des admins pour les differencier et obtenir un outstanding de la part de David
            this.server.to(`channel_${data.channelId}`).emit('newMessage', { ...message, role }); //message est un objet appartenant a la classe message contenant (id, content, sender, createdAt, channel), les ... c'est juste pour ajouter le role de l'emetteur dans le meme json
        } catch (e) {
            client.emit('error', { message: (e as Error).message });
        }
    }

    @SubscribeMessage('sendDm') //tu peux chopper normalement le targetUserId via sub dans le payload du token
    async onSendDm( @ConnectedSocket() client: Socket, @MessageBody() data: { targetUserId: number; content: string } ) {
        const userId = socketUserMap.get(client.id); 
        if (!userId) 
            return;
        try {
            const blocked = await this.chatService.isBlocked(userId, data.targetUserId);
            if (blocked) {
                client.emit('error', { message: 'Cannot message this user' });
                return;
            }
            const channel = await this.chatService.getOrCreateDmChannel(userId, data.targetUserId);
            const message = await this.chatService.sendMessage(userId, channel.id, data.content);
            this.server.to(`channel_${channel.id}`).emit('newMessage', message);
        } catch (e) {
            client.emit('error', { message: (e as Error).message });
        }
    }

    @SubscribeMessage('typing')
    onTyping( @ConnectedSocket() client: Socket, @MessageBody() data: { channelId: number } ) {
        const userId = socketUserMap.get(client.id);
        if (!userId)
            return;
        client.to(`channel_${data.channelId}`).emit('userTyping', { userId, channelId: data.channelId });
    }
}
