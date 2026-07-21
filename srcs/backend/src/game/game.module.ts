import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GameGateway } from './game.gateway';
import { GameService } from './game.service';
import { Word } from './word.entity';
import { Match } from './match.entity';
import { ChatModule } from '../chat/chat.module';
import { JwtModule } from '@nestjs/jwt';
import { UserModule } from '../user/user.module';


@Module({

	imports: [TypeOrmModule.forFeature([Word, Match]), forwardRef(() => ChatModule), JwtModule, UserModule],
	providers: [GameGateway, GameService],
	exports: [GameService]
})

export class GameModule {}