import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { SetupTotpDto } from './dto/setup-totp.dto';
import { TotpDto } from './dto/totp.dto';
import { EnableTotpDto } from './dto/enable-totp.dto';
import { JwtGuard, JwtPayload } from './guards/jwt.guard';
import { Pending2faGuard } from './guards/pending2fa.guard';
import { GoogleProfile } from './strategies/google.strategy';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
    constructor(
        private readonly authService: AuthService,
        private readonly config: ConfigService,
    ) {}

    @Post('register')
    @Throttle({ default: { limit: 5, ttl: 60_000 } })
    register(@Body() dto: RegisterDto) {
        return this.authService.register(dto.email, dto.username, dto.password);
    }

    @Post('login')
    @Throttle({ default: { limit: 5, ttl: 60_000 } })
    login(@Body() dto: LoginDto) {
        return this.authService.login(dto.email, dto.password);
    }

    @Post('refresh')
    refresh(@Body() dto: RefreshDto) {
        return this.authService.refresh(dto.refreshToken);
    }

    @Post('logout')
    @HttpCode(200)
    @UseGuards(JwtGuard)
    @ApiBearerAuth()
    logout(@Body() dto: RefreshDto) {
        return this.authService.logout(dto.refreshToken);
    }

    @Get('google')
    @UseGuards(AuthGuard('google'))
    googleAuth() {
        // Passport redirects to Google consent screen
    }

    @Get('callback/google')
    @UseGuards(AuthGuard('google'))
    async googleCallback(@Req() req: { user: GoogleProfile }, @Res() res: Response) {
        const result = await this.authService.googleLogin(req.user);
        const base = this.config.getOrThrow<string>('NESTAUTH_URL');

        // Tokens travel in the URL fragment, not the query string: the fragment is never
        // sent to the server by the browser, so it never ends up in nginx/proxy access logs.
        if ('accessToken' in result) {
            const url = new URL(`${base}/auth/callback`);
            url.hash = new URLSearchParams({ accessToken: result.accessToken, refreshToken: result.refreshToken }).toString();
            return res.redirect(url.toString());
        }

        const url = new URL(`${base}/auth/2fa`);
        url.hash = new URLSearchParams({ partialToken: result.partialToken }).toString();
        return res.redirect(url.toString());
    }

    @Post('2fa/setup')
    @UseGuards(JwtGuard)
    @ApiBearerAuth()
    @Throttle({ default: { limit: 5, ttl: 60_000 } })
    setup2fa(@Req() req: { user: JwtPayload }, @Body() dto: SetupTotpDto) {
        return this.authService.setupTotp(req.user.sub, dto.code);
    }

    @Post('2fa/enable')
    @HttpCode(200)
    @UseGuards(JwtGuard)
    @ApiBearerAuth()
    @Throttle({ default: { limit: 5, ttl: 60_000 } })
    enable2fa(@Req() req: { user: JwtPayload }, @Body() dto: EnableTotpDto) {
        return this.authService.enableTotp(req.user.sub, dto.code, dto.currentPassword, dto.emailCode);
    }

    @Post('2fa/disable')
    @HttpCode(200)
    @UseGuards(JwtGuard)
    @ApiBearerAuth()
    @Throttle({ default: { limit: 5, ttl: 60_000 } })
    disable2fa(@Req() req: { user: JwtPayload }, @Body() dto: TotpDto) {
        return this.authService.disableTotp(req.user.sub, dto.code);
    }

    @Post('2fa/verify')
    @UseGuards(Pending2faGuard)
    @ApiBearerAuth()
    @Throttle({ default: { limit: 5, ttl: 60_000 } })
    verify2fa(@Req() req: { user: JwtPayload }, @Body() dto: TotpDto) {
        return this.authService.verifyTotp(req.user.sub, req.user.email, dto.code);
    }
}
