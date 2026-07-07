import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User } from "./user.entity";
import { Message } from "../chat/entities/message.entity";

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,

    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
  ) {}

  create(
    email: string,
    username: string,
    hashedPassword: string,
  ): Promise<User> {
    const user = this.repo.create({
      email,
      username,
      passwordHash: hashedPassword,
    });
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

    async getUserMessage(userId: number): Promise<Message[]> {
        const messages = await this.messageRepo.find({ where: { sender: { id: userId } }, relations: { channel: true } });
        return messages;
    }

    async setTotpSecret(userId: number, secret: string | null): Promise<void> {
        await this.repo.update(userId, { totpSecret: secret });
    }

    async enableTotp(userId: number): Promise<void> {
        await this.repo.update(userId, { totpEnabled: true });
    }

    async disableTotp(userId: number): Promise<void> {
        await this.repo.update(userId, { totpSecret: null, totpEnabled: false });
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

    async update(userId: number, data: { email?: string; username?: string }): Promise<User> {
        await this.repo.update(userId, data);
        return (await this.findById(userId))!;
    }

    async remove(userId: number): Promise<void> {
        await this.repo.delete(userId);
    }
}
