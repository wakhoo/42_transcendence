import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';
import { GameGateway } from './game/game.gateway';
import { GameService } from './game/game.service';

@Module ({
    imports: [],
    controllers: [HealthController],
    providers: [GameGateway, GameService],
})
export class AppModule {}