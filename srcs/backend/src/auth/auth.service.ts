import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { authenticator } from 'otplib';
import { toDataURL } from 'qrcode';
import { UserService } from '../user/user.service';
import { GoogleProfile } from './strategies/google.strategy';
import { SessionService } from './session.service';

const BCRYPT_ROUNDS = 12;

type TokenPair = { accessToken: string; refreshToken: string };
type LoginResult = TokenPair | { twoFactorRequired: true; partialToken: string };

@Injectable()
export class AuthService {
    constructor(
        private readonly userService: UserService,
        private readonly sessionService: SessionService,
        private readonly jwtService: JwtService,
        private readonly config: ConfigService,
    ) {}

    async register(email: string, username: string, password: string): Promise<TokenPair> {
        const existing = await this.userService.findByEmail(email);
        if (existing) throw new ConflictException('Email already in use');

        const takenUsername = await this.userService.findByUsername(username);
        if (takenUsername) throw new ConflictException('Username already in use');

        const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS);
        const user = await this.userService.create(email, username, hashed);

        return this.issueTokens(user.id, user.email);
    }

    async login(email: string, password: string): Promise<LoginResult> {
        const user = await this.userService.findByEmail(email);
        if (!user) throw new UnauthorizedException('Invalid credentials');

        if (!user.passwordHash) throw new UnauthorizedException('Invalid credentials');
        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) throw new UnauthorizedException('Invalid credentials');

        if (user.totpEnabled) {
            const partialToken = this.jwtService.sign(
                { sub: user.id, email: user.email, pending2fa: true },
                { expiresIn: 300 },
            );
            return { twoFactorRequired: true, partialToken };
        }

        return this.issueTokens(user.id, user.email);
    }

    async refresh(token: string): Promise<TokenPair> {
        const session = await this.sessionService.findValid(token);
        if (!session) throw new UnauthorizedException('Invalid or expired refresh token');

        const user = await this.userService.findById(session.userId);
        if (!user) throw new UnauthorizedException('Invalid or expired refresh token');

        await this.sessionService.delete(token);
        return this.issueTokens(user.id, user.email);
    }

    async logout(token: string): Promise<void> {
        await this.sessionService.delete(token);
    }

    async googleLogin(profile: GoogleProfile): Promise<LoginResult> {
        let user = await this.userService.findByOAuthId('google', profile.oauthId);

        if (!user) {
            const existing = await this.userService.findByEmail(profile.email);
            if (existing) throw new ConflictException('Email already registered with a password account');

            const username = await this.generateUsername(profile.email);
            const avatarUrl = (profile.avatarUrl?.length ?? 0) <= 500 ? profile.avatarUrl : null;
            user = await this.userService.createOAuthUser(
                'google',
                profile.oauthId,
                profile.email,
                username,
                avatarUrl,
            );
        }

        if (user.totpEnabled) {
            const partialToken = this.jwtService.sign(
                { sub: user.id, email: user.email, pending2fa: true },
                { expiresIn: 300 },
            );
            return { twoFactorRequired: true, partialToken };
        }

        return this.issueTokens(user.id, user.email);
    }

    async setupTotp(userId: number): Promise<{ otpauthUrl: string; secret: string; qrCode: string }> {
        const user = await this.userService.findById(userId);
        if (!user) throw new UnauthorizedException();

        const secret = authenticator.generateSecret();
        await this.userService.setTotpSecret(userId, secret);

        const issuer = this.config.get('TOTP_ISSUER', 'ft_transcendence');
        const otpauthUrl = authenticator.keyuri(user.email, issuer, secret);
        const qrCode = await toDataURL(otpauthUrl);

        return { otpauthUrl, secret, qrCode };
    }

    async enableTotp(userId: number, code: string): Promise<void> {
        const user = await this.userService.findById(userId);
        if (!user || !user.totpSecret) {
            throw new BadRequestException('2FA setup not started. Call POST /auth/2fa/setup first.');
        }

        const valid = authenticator.verify({ token: code, secret: user.totpSecret });
        if (!valid) throw new UnauthorizedException('Invalid 2FA code');

        await this.userService.enableTotp(userId);
    }

    async disableTotp(userId: number, code: string): Promise<void> {
        const user = await this.userService.findById(userId);
        if (!user || !user.totpEnabled) throw new BadRequestException('2FA is not enabled');

        const valid = authenticator.verify({ token: code, secret: user.totpSecret! });
        if (!valid) throw new UnauthorizedException('Invalid 2FA code');

        await this.userService.disableTotp(userId);
    }

    async verifyTotp(userId: number, email: string, code: string): Promise<TokenPair> {
        const user = await this.userService.findById(userId);
        if (!user || !user.totpEnabled || !user.totpSecret) {
            throw new UnauthorizedException('2FA not configured');
        }

        const valid = authenticator.verify({ token: code, secret: user.totpSecret });
        if (!valid) throw new UnauthorizedException('Invalid 2FA code');

        return this.issueTokens(userId, email);
    }

    private async generateUsername(email: string): Promise<string> {
        const base = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 18);
        let username = base;
        let suffix = 1;
        while (await this.userService.findByUsername(username)) {
            username = `${base}_${suffix++}`;
        }
        return username;
    }

    private async issueTokens(userId: number, email: string): Promise<TokenPair> {
        const accessToken = this.jwtService.sign({ sub: userId, email });
        const refreshToken = await this.sessionService.create(userId);
        return { accessToken, refreshToken };
    }
}
