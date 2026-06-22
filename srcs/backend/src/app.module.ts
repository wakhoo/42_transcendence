import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';
import { GameGateway } from './game/game.gateway';

@Module ({
    imports: [],
    controllers: [HealthController],
    providers: [GameGateway],
})
export class AppModule {}