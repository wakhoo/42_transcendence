import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UserModule } from '../user/user.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtGuard } from './guards/jwt.guard';
import { Pending2faGuard } from './guards/pending2fa.guard';
import { SessionModule } from './session.module';
import { GoogleStrategy } from './strategies/google.strategy';

@Module({
    imports: [
        UserModule,
        PassportModule,
        SessionModule,
        JwtModule.registerAsync({
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
                secret: config.getOrThrow<string>('JWT_SECRET'),
                signOptions: { expiresIn: parseInt(config.get('JWT_EXPIRES_IN', '900'), 10) },
            }),
        }),
    ],
    controllers: [AuthController],
    providers: [AuthService, JwtGuard, Pending2faGuard, GoogleStrategy],
    exports: [JwtGuard, Pending2faGuard, JwtModule],
})
export class AuthModule {}
