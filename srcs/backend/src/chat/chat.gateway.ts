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
import { Inject, forwardRef, ValidationPipe, HttpException } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JoinChannelDto, ChannelIdDto, SendMessageDto, SendDmDto } from './dto/ws-chat.dto';
import { JwtService } from '@nestjs/jwt';
import { ChatService } from './chat.service';
import { UserService } from '../user/user.service';
import { onUserCreated, onUserDeleted, onUserUpdated } from '../common/user-events';

export const socketUserMap = new Map<string, { id: number; publicId: string }>();

function safeWsMessage(e: unknown): string {
    if (e instanceof HttpException)
        return e.message;
    return 'An error occurred';
}

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

    private disconnectUser(userId: number): void {
        const entries = [...socketUserMap.entries()].filter(([, e]) => e.id === userId);
        if (entries.length === 0) 
            return;

        const publicId = entries[0][1].publicId;
        for (const [socketId] of entries) {
            socketUserMap.delete(socketId);
            this.server.in(socketId).disconnectSockets(true);
        }
        if (publicId) 
            this.server.emit('presenceChanged', { userId: publicId, status: 'offline' });
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

            socketUserMap.set(client.id, { id: user.id, publicId: user.publicId });

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

            const onlineUserIds = [...new Set([...socketUserMap.values()].map(e => e.publicId))];
            client.emit('ready', { generalChannelId: general.id, onlineUserIds });
            this.server.emit('presenceChanged', { userId: user.publicId, status: 'online' });
            console.log(`User ${user.id} connected (socket ${client.id})`);
        } catch {
            client.disconnect();
        }
}

    handleDisconnect(client: Socket) {
        const entry = socketUserMap.get(client.id);
        socketUserMap.delete(client.id);

        if (entry) {
            const stillConnectedElsewhere = [...socketUserMap.values()].some(e => e.id === entry.id);
            if (!stillConnectedElsewhere) {
                this.server.emit('presenceChanged', { userId: entry.publicId, status: 'offline' });
            }
        }
        console.log(`User ${entry?.id ?? '?'} disconnected (socket ${client.id})`);
    }

    // ── Événements reçus depuis le frontend ──────────────────────────────────

    @SubscribeMessage('joinChannel')
    async onJoinChannel(@ConnectedSocket() client: Socket, @MessageBody(new ValidationPipe()) data: JoinChannelDto) {
        const userId = socketUserMap.get(client.id)?.id;
        if (!userId)
            return;
        try {
            await this.chatService.joinChannel(userId, data.channelId, data.password);
            void client.join(`channel_${data.channelId}`);
        } catch (e) {
            client.emit('error', { message: safeWsMessage(e) });
        }
    }

    @SubscribeMessage('leaveChannel')
    async onLeaveChannel(@ConnectedSocket() client: Socket, @MessageBody(new ValidationPipe()) data: ChannelIdDto) {
        const userId = socketUserMap.get(client.id)?.id;
        if (!userId)
            return;
        try {
            await this.chatService.leaveChannel(userId, data.channelId);
            void client.leave(`channel_${data.channelId}`);
        } catch (e) {
            client.emit('error', { message: safeWsMessage(e) });
        }
    }

    @SubscribeMessage('sendMessage')
    async onSendMessage(@ConnectedSocket() client: Socket, @MessageBody(new ValidationPipe()) data: SendMessageDto) {
        const userId = socketUserMap.get(client.id)?.id;
        if (!userId)
            return;
        try {
            const message = await this.chatService.sendMessage(userId, data.channelId, data.content);
            const role = await this.chatService.getMemberRole(userId, data.channelId);
            this.server.to(`channel_${data.channelId}`).emit('newMessage', { ...message, role });
        } catch (e) {
            client.emit('error', { message: safeWsMessage(e) });
        }
    }

    private emitToUser(userId: number, event: string, payload: any) {
        for (const [socketId, entry] of socketUserMap.entries()) {
            if (entry.id === userId) {
                this.server.to(socketId).emit(event, payload);
            }
        }
    }

    @SubscribeMessage('sendDm')
    async onSendDm(@ConnectedSocket() client: Socket, @MessageBody(new ValidationPipe()) data: SendDmDto) {
        const userId = socketUserMap.get(client.id)?.id;
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
            client.emit('error', { message: safeWsMessage(e) });
        }
    }

    @SubscribeMessage('typing')
    onTyping(@ConnectedSocket() client: Socket, @MessageBody(new ValidationPipe()) data: ChannelIdDto) {
        const entry = socketUserMap.get(client.id);
        if (!entry)
            return;
        client.to(`channel_${data.channelId}`).emit('userTyping', { userId: entry.publicId, channelId: data.channelId });
    }
}
