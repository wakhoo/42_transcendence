import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtGuard } from './guards/jwt.guard';
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
        const tokens = await this.authService.googleLogin(req.user);
        const base = this.config.getOrThrow<string>('NEXTAUTH_URL');
        const url = new URL(`${base}/auth/callback`);
        url.searchParams.set('accessToken', tokens.accessToken);
        url.searchParams.set('refreshToken', tokens.refreshToken);
        return res.redirect(url.toString());
    }
}
