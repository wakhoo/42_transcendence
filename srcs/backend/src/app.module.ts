import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthController } from './health/health.controller';
import { GameGateway } from './game/game.gateway';
import { GameService } from './game/game.service';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { ChatModule } from './chat/chat.module';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
        TypeOrmModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
                type: 'mysql',
                host: config.getOrThrow('MARIADB_HOST'),
                port: config.get<number>('MARIADB_PORT', 3306),
                username: config.getOrThrow('MARIADB_USER'),
                password: config.getOrThrow('MARIADB_PASSWORD'),
                database: config.getOrThrow('MARIADB_DATABASE'),
                entities: [__dirname + '/**/*.entity{.ts,.js}'],
                synchronize: true,
            }),
        }),
        AuthModule,
        UserModule,
        ChatModule,
    ],
    controllers: [HealthController],
    providers: [
        GameGateway,
        GameService,
        { provide: APP_GUARD, useClass: ThrottlerGuard },
    ],
})
export class AppModule {}
