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
import { Inject, forwardRef, ValidationPipe } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JoinChannelDto, ChannelIdDto, SendMessageDto, SendDmDto } from './dto/ws-chat.dto';
import { JwtService } from '@nestjs/jwt';
import { ChatService } from './chat.service';
import { UserService } from '../user/user.service';
import { onUserCreated, onUserDeleted, onUserUpdated } from '../common/user-events';

export const socketUserMap = new Map<string, number>();
// publicId (uuid) du meme utilisateur, pour tout ce qui part vers le client
const socketPublicIdMap = new Map<string, string>();

@WebSocketGateway({ namespace: '/chat', cors: { origin: process.env.NESTAUTH_URL } })
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server!: Server;

    constructor(
        @Inject(forwardRef(() => ChatService)) private readonly chatService: ChatService,
        private readonly jwtService: JwtService,
        private readonly userService: UserService,
    ) {}

    afterInit(server: Server) {
        this.chatService.server = server;
        onUserCreated(profile => server.emit('userCreated', profile));
        onUserUpdated(profile => server.emit('userUpdated', profile));
        onUserDeleted(userId => {
            try {
                this.disconnectUser(userId);
            } catch (err) {
                console.error(`Failed to disconnect chat sockets for deleted user ${userId}:`, err);
            }
        });
        console.log('ChatGateway initialized');
    }

    // Deleted accounts must not keep receiving room traffic through sockets
    // that connected before the DB row was removed.
    private disconnectUser(userId: number): void {
        const socketIds = [...socketUserMap.entries()].filter(([, uid]) => uid === userId).map(([id]) => id);
        if (socketIds.length === 0) return;

        // capture avant suppression : la ligne User peut deja avoir ete supprimee en base
        const publicId = socketPublicIdMap.get(socketIds[0]);
        for (const socketId of socketIds) {
            socketUserMap.delete(socketId);
            socketPublicIdMap.delete(socketId);
            this.server.in(socketId).disconnectSockets(true);
        }
        if (publicId) this.server.emit('presenceChanged', { userId: publicId, status: 'offline' });
    }

    async handleConnection(client: Socket) {
        try {
            const token = (client.handshake.auth as { token?: string })?.token?.replace('Bearer ', '');
            if (!token) { 
                client.disconnect(); 
                return; 
            }

            const payload = this.jwtService.verify<{ sub: string; pending2fa?: boolean }>(token);
            if (payload.pending2fa) {
                client.disconnect();
                return;
            }

            const user = await this.userService.findByPublicId(payload.sub);
            if (!user) {
                client.disconnect();
                return;
            }

            socketUserMap.set(client.id, user.id);
            socketPublicIdMap.set(client.id, user.publicId);

            const isGameMode = client.handshake.query?.mode === 'game';
            const targetChannelId = client.handshake.query?.channelId;

            if (isGameMode && targetChannelId) {
                const role = await this.chatService.getMemberRole(user.id, Number(targetChannelId));
                if (!role) {
                    client.disconnect();
                    return;
                }
                void client.join(`channel_${targetChannelId}`);
                void client.join(targetChannelId.toString());
                console.log(`User ${user.id} connect to the game chat (room #${targetChannelId})`);
                return;
            }

            const general = await this.chatService.ensureGeneralChannel();
            await this.chatService.joinChannel(user.id, general.id).catch(() => {});
            void client.join(`channel_${general.id}`);

            const myChannels = await this.chatService.getMyChannels(user.id);
            for (const ch of myChannels) {
                void client.join(`channel_${ch.id}`);
            }

            const onlineUserIds = [...new Set(socketPublicIdMap.values())];
            client.emit('ready', { generalChannelId: general.id, onlineUserIds });
            this.server.emit('presenceChanged', { userId: user.publicId, status: 'online' });
            console.log(`User ${user.id} connected (socket ${client.id})`);
        } catch {
            client.disconnect();
        }
}

    handleDisconnect(client: Socket) {
        const userId = socketUserMap.get(client.id);
        const publicId = socketPublicIdMap.get(client.id);
        socketUserMap.delete(client.id);
        socketPublicIdMap.delete(client.id);

        if (userId !== undefined) {
            const stillConnectedElsewhere = [...socketUserMap.values()].includes(userId);
            if (!stillConnectedElsewhere && publicId) {
                this.server.emit('presenceChanged', { userId: publicId, status: 'offline' });
            }
        }
        console.log(`User ${userId ?? '?'} disconnected (socket ${client.id})`);
    }

    // ── Événements reçus depuis le frontend ──────────────────────────────────

    @SubscribeMessage('joinChannel')
    async onJoinChannel(@ConnectedSocket() client: Socket, @MessageBody(new ValidationPipe()) data: JoinChannelDto) {
        const userId = socketUserMap.get(client.id);
        if (!userId)
            return;
        try {
            await this.chatService.joinChannel(userId, data.channelId, data.password);
            void client.join(`channel_${data.channelId}`);
        } catch (e) {
            client.emit('error', { message: (e as Error).message });
        }
    }

    @SubscribeMessage('leaveChannel')
    async onLeaveChannel(@ConnectedSocket() client: Socket, @MessageBody(new ValidationPipe()) data: ChannelIdDto) {
        const userId = socketUserMap.get(client.id);
        if (!userId)
            return;
        try {
            await this.chatService.leaveChannel(userId, data.channelId);
            void client.leave(`channel_${data.channelId}`);
        } catch (e) {
            client.emit('error', { message: (e as Error).message });
        }
    }

    @SubscribeMessage('sendMessage')
    async onSendMessage(@ConnectedSocket() client: Socket, @MessageBody(new ValidationPipe()) data: SendMessageDto) {
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

    private emitToUser(userId: number, event: string, payload: any) {
        for (const [socketId, uid] of socketUserMap.entries()) {
            if (uid === userId) {
                this.server.to(socketId).emit(event, payload);
            }
        }
    }

    @SubscribeMessage('sendDm')
    async onSendDm(@ConnectedSocket() client: Socket, @MessageBody(new ValidationPipe()) data: SendDmDto) {
        const userId = socketUserMap.get(client.id);
        if (!userId)
            return;
        try {
            const target = await this.userService.findByPublicId(data.targetUserId);
            if (!target) {
                client.emit('error', { message: 'User not found' });
                return;
            }
            const blocked = await this.chatService.isBlocked(userId, target.id);
            if (blocked) {
                client.emit('error', { message: 'Cannot message this user' });
                return;
            }
            const channel = await this.chatService.getOrCreateDmChannel(userId, target.id);
            const message = await this.chatService.sendMessage(userId, channel.id, data.content);
            const payload = {...message, channelId: channel.id, isDm: true };

            this.emitToUser(target.id, `newMessage`, payload);
            client.emit('newMessage', payload);
        } catch (e) {
            client.emit('error', { message: (e as Error).message });
        }
    }

    @SubscribeMessage('typing')
    onTyping(@ConnectedSocket() client: Socket, @MessageBody(new ValidationPipe()) data: ChannelIdDto) {
        const userId = socketUserMap.get(client.id);
        const publicId = socketPublicIdMap.get(client.id);
        if (!userId || !publicId)
            return;
        client.to(`channel_${data.channelId}`).emit('userTyping', { userId: publicId, channelId: data.channelId });
    }
}
