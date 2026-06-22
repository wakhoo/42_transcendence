import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserService } from '../user/user.service';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
    constructor(
        private readonly userService: UserService,
        private readonly jwtService: JwtService,
    ) {}

    async register(email: string, username: string, password: string): Promise<{ accessToken: string }> {
        const existing = await this.userService.findByEmail(email);
        if (existing) throw new ConflictException('Email already in use');

        const takenUsername = await this.userService.findByUsername(username);
        if (takenUsername) throw new ConflictException('Username already in use');

        const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS);
        const user = await this.userService.create(email, username, hashed);

        const accessToken = this.jwtService.sign({ sub: user.id, email: user.email });
        return { accessToken };
    }

    async login(email: string, password: string): Promise<{ accessToken: string }> {
        const user = await this.userService.findByEmail(email);
        if (!user) throw new UnauthorizedException('Invalid credentials');

        if (!user.passwordHash) throw new UnauthorizedException('Invalid credentials');
        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) throw new UnauthorizedException('Invalid credentials');

        const accessToken = this.jwtService.sign({ sub: user.id, email: user.email });
        return { accessToken };
    }
}
