import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Channel } from './entities/channel.entity';
import { ChannelMember } from './entities/channel-member.entity';
import { Message } from './entities/message.entity';
import { Friendship } from './entities/friendship.entity';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Module({
    imports: [
        TypeOrmModule.forFeature([Channel, ChannelMember, Message, Friendship]),

        JwtModule.registerAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
                secret: config.getOrThrow<string>('JWT_SECRET'),
            }),
        }),
    ],
    controllers: [ChatController],
    providers: [ChatService, ChatGateway, JwtAuthGuard],
})
export class ChatModule {}
