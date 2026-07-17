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
import { Inject,forwardRef } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ChatService } from './chat.service';

export const socketUserMap = new Map<string, number>();

@WebSocketGateway({ namespace: '/chat', cors: { origin: '*' } })
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server!: Server;

    constructor(
        @Inject(forwardRef(() => ChatService)) private readonly chatService: ChatService,
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
            await this.chatService.joinChannel(payload.sub, general.id).catch(() => {});
            void client.join(`channel_${general.id}`);

            const myChannels = await this.chatService.getMyChannels(payload.sub);
            for (const ch of myChannels) {
                void client.join(`channel_${ch.id}`);
            }

            client.emit('ready', { generalChannelId: general.id });
            this.server.emit('presenceChanged');
            console.log(`User ${payload.sub} connected (socket ${client.id})`);
        } catch {
            client.disconnect();
        }
    }



    // async handleConnection(client: Socket) {
    //     try {
    //         // 🛑 MODE DEV : On commente la vérification stricte
    //         /*
    //         const token = (client.handshake.auth as { token?: string })?.token?.replace('Bearer ', '');
    //         if (!token) { 
    //             client.disconnect(); 
    //             return; 
    //         }
    //         const payload = this.jwtService.verify<{ sub: number }>(token);
    //         */

    //         // 🟢 MODE DEV : On simule un utilisateur (ID 999 par exemple)
    //         const payload = { sub: 999 }; // Faux utilisateur

    //         socketUserMap.set(client.id, payload.sub);

    //         const general = await this.chatService.ensureGeneralChannel();
    //         await this.chatService.joinChannel(payload.sub, general.id).catch(() => {});
    //         void client.join(`channel_${general.id}`);

    //         const myChannels = await this.chatService.getMyChannels(payload.sub);
    //         for (const ch of myChannels) {
    //             void client.join(`channel_${ch.id}`);
    //         }

    //         client.emit('ready', { generalChannelId: general.id });
    //         console.log(`User ${payload.sub} connected (socket ${client.id})`);
    //     } catch {
    //         client.disconnect();
    //     }
    // }

    handleDisconnect(client: Socket) {
        const userId = socketUserMap.get(client.id);
        socketUserMap.delete(client.id);
        this.server.emit('presenceChanged');
        console.log(`User ${userId ?? '?'} disconnected (socket ${client.id})`);
    }

    // ── Événements reçus depuis le frontend ──────────────────────────────────

    @SubscribeMessage('joinChannel')
    async onJoinChannel(@ConnectedSocket() client: Socket, @MessageBody() data: { channelId: number; password?: string }) {
        const userId = socketUserMap.get(client.id);
        if (!userId)
            return;
        try {
            await this.chatService.joinChannel(userId, data.channelId, data.password);
            void client.join(`channel_${data.channelId}`);
            client.emit('joinedChannel', { channelId: data.channelId });
        } catch (e) {
            client.emit('error', { message: (e as Error).message });
        }
    }

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
            const role = await this.chatService.getMemberRole(userId, data.channelId); 
            this.server.to(`channel_${data.channelId}`).emit('newMessage', { ...message, role });
        } catch (e) {
            client.emit('error', { message: (e as Error).message });
        }
    }

    @SubscribeMessage('sendDm')
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
