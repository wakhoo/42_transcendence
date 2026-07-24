import {
    BadRequestException,
    Body,
    ConflictException,
    Controller,
    Delete,
    Get,
    Patch,
    Query,
    Req,
    UnauthorizedException,
    UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import * as bcrypt from 'bcrypt';
import { authenticator } from 'otplib';
import { JwtGuard, JwtPayload } from '../auth/guards/jwt.guard';
import { User } from './user.entity';
import { UserService } from './user.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { GdprAuditService } from './gdpr-audit.service';

type AuthedRequest = Request & { user: JwtPayload };

@ApiTags('user')
@ApiBearerAuth()
@Controller('user')
@UseGuards(JwtGuard)
export class UserController {
    constructor(
        private readonly userService: UserService,
        private readonly gdprAudit: GdprAuditService,
    ) {}

    @Get('me')
    async getMe(@Req() req: AuthedRequest) {
        const user = await this.userService.findById(req.user.sub);
        if (!user) throw new UnauthorizedException();
        return this.toSafeProfile(user);
    }

    @Get()
    async getAll() {
        const users = await this.userService.findAll();
        return users.map(u => this.toPublicProfile(u));
    }

    @Patch('me')
    async updateMe(@Req() req: AuthedRequest, @Body() dto: UpdateUserDto) {
        const userId = req.user.sub;
        const user = await this.userService.findById(userId);
        if (!user) throw new UnauthorizedException();

        const changingEmail = dto.email !== undefined && dto.email !== user.email;
        const changingUsername = dto.username !== undefined && dto.username !== user.username;

        if ((changingEmail || changingUsername) && user.totpEnabled) {
            if (!dto.code) throw new BadRequestException('2FA code required');
            const valid = authenticator.verify({ token: dto.code, secret: user.totpSecret! });
            if (!valid) throw new UnauthorizedException('Invalid 2FA code');
        }

        if (changingEmail) {
            const existing = await this.userService.findByEmail(dto.email!);
            if (existing && existing.id !== userId) throw new ConflictException('Email already in use');
        }
        if (changingUsername) {
            const existing = await this.userService.findByUsername(dto.username!);
            if (existing && existing.id !== userId) throw new ConflictException('Username already in use');
        }

        const updated = await this.userService.update(userId, {
            email: dto.email,
            username: dto.username,
            avatarUrl: dto.avatarUrl,
        });
        this.gdprAudit.logDataChanged(userId);
        return this.toSafeProfile(updated);
    }

    @Patch('me/password')
    @Throttle({ default: { limit: 5, ttl: 60_000 } })
    async changePassword(@Req() req: AuthedRequest, @Body() dto: ChangePasswordDto) {
        const userId = req.user.sub;
        const user = await this.userService.findById(userId);
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

        const newHash = await bcrypt.hash(dto.newPassword, 12);
        await this.userService.setPasswordHash(userId, newHash);
        this.gdprAudit.logDataChanged(userId);
        return { success: true };
    }

    @Get('me/export')
    @Throttle({ default: { limit: 5, ttl: 60_000 } })
    async exportMe(@Req() req: AuthedRequest, @Query('code') code?: string) {
        const user = await this.userService.findById(req.user.sub);
        if (!user) throw new UnauthorizedException();

        if (user.totpEnabled) {
            if (!code) throw new BadRequestException('2FA code required');
            const valid = authenticator.verify({ token: code, secret: user.totpSecret! });
            if (!valid) throw new UnauthorizedException('Invalid 2FA code');
        }

        this.gdprAudit.logDataExported(user.id);
        return {
            messages: await this.userService.getUserMessage(user.id),
            profile: this.toSafeProfile(user),
            exportedAt: new Date().toISOString(),
        };
    }

    @Delete('me')
    @Throttle({ default: { limit: 5, ttl: 60_000 } })
    async deleteMe(@Req() req: AuthedRequest, @Body() dto: DeleteAccountDto) {
        const userId = req.user.sub;
        const user = await this.userService.findById(userId);
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

        await this.userService.remove(userId);
        this.gdprAudit.logAccountDeleted(userId);
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
