import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Channel } from './entities/channel.entity';
import { ChannelMember } from './entities/channel-member.entity';
import { Message } from './entities/message.entity';
import { Friendship } from './entities/friendship.entity';
import { BadWord } from './entities/bad-word.entity';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([Channel, ChannelMember, Message, Friendship, BadWord]),
        AuthModule,
    ],
    controllers: [ChatController],
    providers: [ChatService, ChatGateway],
})
export class ChatModule {}
