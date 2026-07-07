import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthController } from './health/health.controller';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { ChatModule } from './chat/chat.module';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
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
    providers: [],
})
export class AppModule {}
