import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModule } from '../user/user.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtGuard } from './guards/jwt.guard';
import { Session } from './session.entity';
import { SessionService } from './session.service';

@Module({
    imports: [
        UserModule,
        TypeOrmModule.forFeature([Session]),
        JwtModule.registerAsync({
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
                secret: config.getOrThrow<string>('JWT_SECRET'),
                signOptions: { expiresIn: config.get<number>('JWT_EXPIRES_IN', 900) },
            }),
        }),
    ],
    controllers: [AuthController],
    providers: [AuthService, SessionService, JwtGuard],
    exports: [JwtGuard, JwtModule],
})
export class AuthModule {}
