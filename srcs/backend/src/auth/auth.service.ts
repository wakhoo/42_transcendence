import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserService } from '../user/user.service';
import { SessionService } from './session.service';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
    constructor(
        private readonly userService: UserService,
        private readonly sessionService: SessionService,
        private readonly jwtService: JwtService,
    ) {}

    async register(
        email: string,
        username: string,
        password: string,
    ): Promise<{ accessToken: string; refreshToken: string }> {
        const existing = await this.userService.findByEmail(email);
        if (existing) throw new ConflictException('Email already in use');

        const takenUsername = await this.userService.findByUsername(username);
        if (takenUsername) throw new ConflictException('Username already in use');

        const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS);
        const user = await this.userService.create(email, username, hashed);

        return this.issueTokens(user.id, user.email);
    }

    async login(
        email: string,
        password: string,
    ): Promise<{ accessToken: string; refreshToken: string }> {
        const user = await this.userService.findByEmail(email);
        if (!user) throw new UnauthorizedException('Invalid credentials');

        if (!user.passwordHash) throw new UnauthorizedException('Invalid credentials');
        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) throw new UnauthorizedException('Invalid credentials');

        return this.issueTokens(user.id, user.email);
    }

    async refresh(
        token: string,
    ): Promise<{ accessToken: string; refreshToken: string }> {
        const session = await this.sessionService.findValid(token);
        if (!session) throw new UnauthorizedException('Invalid or expired refresh token');

        const user = await this.userService.findById(session.userId);
        if (!user) throw new UnauthorizedException('Invalid or expired refresh token');

        // rotate: delete old session, issue new pair
        await this.sessionService.delete(token);
        return this.issueTokens(user.id, user.email);
    }

    async logout(token: string): Promise<void> {
        await this.sessionService.delete(token);
    }

    private async issueTokens(
        userId: number,
        email: string,
    ): Promise<{ accessToken: string; refreshToken: string }> {
        const accessToken = this.jwtService.sign({ sub: userId, email });
        const refreshToken = await this.sessionService.create(userId);
        return { accessToken, refreshToken };
    }
}
