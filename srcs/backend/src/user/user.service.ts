import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as bcrypt from "bcrypt";
import { authenticator } from "otplib";
import { User } from "./user.entity";
import { Message } from "../chat/entities/message.entity";
import { GdprAuditService } from "./gdpr-audit.service";
import { MailService } from "../mail/mail.service";
import { UpdateUserDto } from "./dto/update-user.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { DeleteAccountDto } from "./dto/delete-account.dto";
import { BCRYPT_ROUNDS } from "../common/constants";

function randomColor(): string {
  return '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
}

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,

    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,

    private readonly gdprAudit: GdprAuditService,
    private readonly mail: MailService,
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
      profileColor: randomColor(),
    });
    return this.repo.save(user);
  }

  findAll(): Promise<User[]> {
    return this.repo.find(); //SELECT * FROM users;
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

    async setPasswordHash(userId: number, passwordHash: string): Promise<void> {
        await this.repo.update(userId, { passwordHash });
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
        const user = this.repo.create({ email, username, oauthProvider: provider, oauthId, avatarUrl, profileColor: randomColor() });
        return this.repo.save(user);
    }

    async update(userId: number, data: { email?: string; username?: string; avatarUrl?: string }): Promise<User> {
        await this.repo.update(userId, data);
        return (await this.findById(userId))!;
    }

    async remove(userId: number): Promise<void> {
        await this.repo.delete(userId);
    }

    async getProfile(userId: number) {
        const user = await this.findById(userId);
        if (!user) throw new UnauthorizedException();
        return this.toSafeProfile(user);
    }

    async getAllProfiles() {
        const users = await this.findAll();
        return users.map(u => this.toPublicProfile(u));
    }

    async updateProfile(userId: number, dto: UpdateUserDto, ip: string | null) {
        const user = await this.findById(userId);
        if (!user) throw new UnauthorizedException();

        const changingEmail = dto.email !== undefined && dto.email !== user.email;
        const changingUsername = dto.username !== undefined && dto.username !== user.username;

        if ((changingEmail || changingUsername) && user.totpEnabled) {
            if (!dto.code) throw new BadRequestException('2FA code required');
            const valid = authenticator.verify({ token: dto.code, secret: user.totpSecret! });
            if (!valid) throw new UnauthorizedException('Invalid 2FA code');
        }

        if (changingEmail) {
            const existing = await this.findByEmail(dto.email!);
            if (existing && existing.id !== userId) throw new ConflictException('Email already in use');
        }
        if (changingUsername) {
            const existing = await this.findByUsername(dto.username!);
            if (existing && existing.id !== userId) throw new ConflictException('Username already in use');
        }

        const updated = await this.update(userId, {
            email: dto.email,
            username: dto.username,
            avatarUrl: dto.avatarUrl,
        });
        await this.gdprAudit.logDataChanged(userId, ip);
        void this.mail.sendProfileChangedEmail(updated.email);
        return this.toSafeProfile(updated);
    }

    async changePassword(userId: number, dto: ChangePasswordDto, ip: string | null) {
        const user = await this.findById(userId);
        if (!user) throw new UnauthorizedException();

        if (user.passwordHash) {
            if (!dto.currentPassword) throw new BadRequestException('Current password required');
            const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
            if (!valid) throw new UnauthorizedException('Invalid current password');
        }

        if (user.totpEnabled) {
            if (!dto.code) throw new BadRequestException('2FA code required');
            const valid = authenticator.verify({ token: dto.code, secret: user.totpSecret! });
            if (!valid) throw new UnauthorizedException('Invalid 2FA code');
        }

        const newHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
        await this.setPasswordHash(userId, newHash);
        await this.gdprAudit.logDataChanged(userId, ip);
        void this.mail.sendProfileChangedEmail(user.email);
        return { success: true };
    }

    async exportUserData(userId: number, code: string | undefined, ip: string | null) {
        const user = await this.findById(userId);
        if (!user) throw new UnauthorizedException();

        if (user.totpEnabled) {
            if (!code) throw new BadRequestException('2FA code required');
            const valid = authenticator.verify({ token: code, secret: user.totpSecret! });
            if (!valid) throw new UnauthorizedException('Invalid 2FA code');
        }

        await this.gdprAudit.logDataExported(user.id, ip);
        void this.mail.sendDataExportedEmail(user.email);
        return {
            messages: await this.getUserMessage(user.id),
            profile: this.toSafeProfile(user),
            exportedAt: new Date().toISOString(),
        };
    }

    async deleteAccount(userId: number, dto: DeleteAccountDto | undefined, ip: string | null): Promise<void> {
        const user = await this.findById(userId);
        if (!user) throw new UnauthorizedException();

        if (user.passwordHash) {
            if (!dto?.password) throw new BadRequestException('Password confirmation required');
            const valid = await bcrypt.compare(dto.password, user.passwordHash);
            if (!valid) throw new UnauthorizedException('Invalid password');
        }

        if (user.totpEnabled) {
            if (!dto?.code) throw new BadRequestException('2FA code required');
            const valid = authenticator.verify({ token: dto.code, secret: user.totpSecret! });
            if (!valid) throw new UnauthorizedException('Invalid 2FA code');
        }

        const deletedEmail = user.email;
        await this.remove(userId);
        await this.gdprAudit.logAccountDeleted(userId, ip);
        void this.mail.sendAccountDeletedEmail(deletedEmail);
    }

    private toSafeProfile(user: User) {
        const { passwordHash, totpSecret, ...safe } = user;
        return { ...safe, hasPassword: !!passwordHash };
    }

    private toPublicProfile(user: User) {
        const { id, username, avatarUrl, profileColor } = user;
        return { id, username, avatarUrl, profileColor };
    }
}
