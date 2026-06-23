import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UserService {
    constructor(
        @InjectRepository(User)
        private readonly repo: Repository<User>,
    ) {}

    create(email: string, username: string, hashedPassword: string): Promise<User> {
        const user = this.repo.create({ email, username, passwordHash: hashedPassword });
        return this.repo.save(user);
    }

    findByEmail(email: string): Promise<User | null> {
        return this.repo.findOne({ where: { email } });
    }

    findByUsername(username: string): Promise<User | null> {
        return this.repo.findOne({ where: { username } });
    }

    findById(id: number): Promise<User | null> {
        return this.repo.findOne({ where: { id } });
    }

    findByOAuthId(provider: string, oauthId: string): Promise<User | null> {
        return this.repo.findOne({ where: { oauthProvider: provider, oauthId } });
    }

    async createOAuthUser(
        provider: string,
        oauthId: string,
        email: string,
        username: string,
        avatarUrl: string | null,
    ): Promise<User> {
        const user = this.repo.create({ email, username, oauthProvider: provider, oauthId, avatarUrl });
        return this.repo.save(user);
    }
}
