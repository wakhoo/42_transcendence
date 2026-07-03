import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { TotpDto } from './dto/totp.dto';
import { JwtGuard, JwtPayload } from './guards/jwt.guard';
import { Pending2faGuard } from './guards/pending2fa.guard';
import { GoogleProfile } from './strategies/google.strategy';

@Controller('auth')
export class AuthController {
    constructor(
        private readonly authService: AuthService,
        private readonly config: ConfigService,
    ) {}

    @Post('register')
    register(@Body() dto: RegisterDto) {
        return this.authService.register(dto.email, dto.username, dto.password);
    }

    @Post('login')
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
        const base = this.config.getOrThrow<string>('NEXTAUTH_URL');

        if ('accessToken' in result) {
            const url = new URL(`${base}/auth/callback`);
            url.searchParams.set('accessToken', result.accessToken);
            url.searchParams.set('refreshToken', result.refreshToken);
            return res.redirect(url.toString());
        }

        const url = new URL(`${base}/auth/2fa`);
        url.searchParams.set('partialToken', result.partialToken);
        return res.redirect(url.toString());
    }

    @Post('2fa/setup')
    @UseGuards(JwtGuard)
    setup2fa(@Req() req: { user: JwtPayload }) {
        return this.authService.setupTotp(req.user.sub);
    }

    @Post('2fa/enable')
    @HttpCode(200)
    @UseGuards(JwtGuard)
    enable2fa(@Req() req: { user: JwtPayload }, @Body() dto: TotpDto) {
        return this.authService.enableTotp(req.user.sub, dto.code);
    }

    @Post('2fa/disable')
    @HttpCode(200)
    @UseGuards(JwtGuard)
    disable2fa(@Req() req: { user: JwtPayload }, @Body() dto: TotpDto) {
        return this.authService.disableTotp(req.user.sub, dto.code);
    }

    @Post('2fa/verify')
    @UseGuards(Pending2faGuard)
    verify2fa(@Req() req: { user: JwtPayload }, @Body() dto: TotpDto) {
        return this.authService.verifyTotp(req.user.sub, req.user.email, dto.code);
    }
}
