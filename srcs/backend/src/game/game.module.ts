import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GameGateway } from './game.gateway';
import { GameService } from './game.service';
import { Word } from './word.entity';
import { Match } from './match.entity';
import { ChatModule } from '../chat/chat.module';


@Module({

	imports: [TypeOrmModule.forFeature([Word, Match]), forwardRef(() => ChatModule)],
	providers: [GameGateway, GameService],
	exports: [GameService]
})

export class GameModule {}