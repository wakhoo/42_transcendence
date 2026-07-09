import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GameGateway } from './game.gateway';
import { GameService } from './game.service';
import { Word } from './word.entity';


@Module({

	imports: [TypeOrmModule.forFeature([Word])],
	providers: [GameGateway, GameService],
})

export class Gamemodule {}