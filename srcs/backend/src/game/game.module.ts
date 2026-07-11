import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GameGateway } from './game.gateway';
import { GameService } from './game.service';
import { Word } from './word.entity';
import { Match } from './match.entity';


@Module({

	imports: [TypeOrmModule.forFeature([Word, Match])],
	providers: [GameGateway, GameService],
})

export class Gamemodule {}