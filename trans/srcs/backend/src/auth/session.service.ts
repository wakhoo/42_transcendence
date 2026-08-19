import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { Session } from './session.entity';

const REFRESH_TOKEN_EXPIRES_DAYS = 7;

@Injectable()
export class SessionService {
    constructor(
        @InjectRepository(Session)
        private readonly repo: Repository<Session>,
    ) {}

    async create(userId: number): Promise<string> {
        const token = randomBytes(32).toString('hex');
        const tokenHash = this.hash(token);
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRES_DAYS);

        await this.repo.save({ userId, tokenHash, expiresAt });
        return token;
    }

    async findValid(token: string): Promise<Session | null> {
        const tokenHash = this.hash(token);
        const session = await this.repo.findOne({ where: { tokenHash } });

        if (!session) return null;
        if (session.expiresAt < new Date()) {
            await this.repo.delete({ id: session.id });
            return null;
        }
        return session;
    }

    async delete(token: string): Promise<void> {
        const tokenHash = this.hash(token);
        await this.repo.delete({ tokenHash });
    }

    private hash(token: string): string {
        return createHash('sha256').update(token).digest('hex');
    }
}
