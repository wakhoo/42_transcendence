import { Body, Controller, Delete, Get, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtGuard, JwtPayload } from '../auth/guards/jwt.guard';
import { UserService } from './user.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ExportDataDto } from './dto/export-data.dto';

type AuthedRequest = Request & { user: JwtPayload };

@ApiTags('user')
@ApiBearerAuth()
@Controller('user')
@UseGuards(JwtGuard)
export class UserController {
    constructor(private readonly userService: UserService) {}

    @Get('me')
    getMe(@Req() req: AuthedRequest) {
        return this.userService.getProfile(req.user.sub);
    }

    @Get()
    getAll() {
        return this.userService.getAllProfiles();
    }

    @Patch('me')
    updateMe(@Req() req: AuthedRequest, @Body() dto: UpdateUserDto) {
        return this.userService.updateProfile(req.user.sub, dto, req.ip ?? null);
    }

    @Patch('me/password')
    @Throttle({ default: { limit: 5, ttl: 60_000 } })
    changePassword(@Req() req: AuthedRequest, @Body() dto: ChangePasswordDto) {
        return this.userService.changePassword(req.user.sub, dto, req.ip ?? null);
    }

    @Post('me/export')
    @Throttle({ default: { limit: 5, ttl: 60_000 } })
    exportMe(@Req() req: AuthedRequest, @Body() dto: ExportDataDto) {
        return this.userService.exportUserData(req.user.sub, dto.code, req.ip ?? null);
    }

    @Delete('me')
    @Throttle({ default: { limit: 5, ttl: 60_000 } })
    deleteMe(@Req() req: AuthedRequest, @Body() dto: DeleteAccountDto) {
        return this.userService.deleteAccount(req.user.sub, dto, req.ip ?? null);
    }
}
