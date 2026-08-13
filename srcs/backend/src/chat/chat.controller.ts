import {
    Body,
    Controller,
    Delete,
    Get,
    NotFoundException,
    Param,
    ParseIntPipe,
    Patch,
    Post,
    UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { CurrentUser, JwtPayload } from './decorators/current-user.decorator';
import { CreateChannelDto } from './dto/create-channel.dto';
import { JoinChannelDto } from './dto/join-channel.dto';
import { MuteMemberDto } from './dto/mute-member.dto';
import { SetPasswordDto } from './dto/set-password.dto';
import { GameService } from '../game/game.service';

@ApiTags('chat')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('chat')
export class ChatController {
    constructor(private readonly chatService: ChatService, private readonly gameService: GameService) {}

    // ── Channels ──────────────────────────────────────────────────────────────


    @Get('channels/mine')
    getMyChannels(@CurrentUser() user: JwtPayload) {
        return this.chatService.getMyChannels(user.sub);
    }

    @Post('channels')
    createChannel(@CurrentUser() user: JwtPayload, @Body() dto: CreateChannelDto) {
        return this.chatService.createChannel(user.sub, dto.name, dto.type ?? 'general', dto.isPrivate ?? false, dto.password, dto.maxMembers);
    }

    @Post('channels/:id/join')
    joinChannel( @CurrentUser() user: JwtPayload, @Param('id', ParseIntPipe) channelId: number, @Body() dto: JoinChannelDto) {
        return this.chatService.joinChannel(user.sub, channelId, dto.password);
    }

    @Delete('channels/:id/leave')
    leaveChannel( @CurrentUser() user: JwtPayload, @Param('id', ParseIntPipe) channelId: number) {
        return this.chatService.leaveChannel(user.sub, channelId);
    }

    @Get('channels/:id/messages')
    getMessages(@Param('id', ParseIntPipe) channelId: number) {
        return this.chatService.getMessages(channelId);
    }

    @Get('find-private-game/:code')
    async findPrivateGame(@Param('code') code: string) {
        const channelId = this.gameService.findRoomByCode(code);
        if (!channelId) throw new NotFoundException('Invalid code or room closed');
        return { channelId };
    }

    // ── Actions admin ─────────────────────────────────────────────────────────

    @Delete('channels/:id/kick/:userId')
    kickMember( @CurrentUser() user: JwtPayload, @Param('id', ParseIntPipe) channelId: number, @Param('userId', ParseIntPipe) targetUserId: number) {
        return this.chatService.kickMember(user.sub, channelId, targetUserId);
    }

    @Post('channels/:id/invite/:userId')
    inviteUser( @CurrentUser() user: JwtPayload, @Param('id', ParseIntPipe) channelId: number, @Param('userId', ParseIntPipe) targetUserId: number) {
        return this.chatService.inviteUser(user.sub, channelId, targetUserId);
    }

    @Patch('channels/:id/mute/:userId')
    muteMember( @CurrentUser() user: JwtPayload, @Param('id', ParseIntPipe) channelId: number, @Param('userId', ParseIntPipe) targetUserId: number, @Body() dto: MuteMemberDto) {
        return this.chatService.muteMember(user.sub, channelId, targetUserId, dto.minutes);
    }

    @Patch('channels/:id/password')
    setPassword( @CurrentUser() user: JwtPayload, @Param('id', ParseIntPipe) channelId: number, @Body() dto: SetPasswordDto) {
        return this.chatService.setChannelPassword(user.sub, channelId, dto.password);
    }

    @Patch('channels/:id/privacy')
    setPrivacy( @CurrentUser() user: JwtPayload, @Param('id', ParseIntPipe) channelId: number, @Body('isPrivate') isPrivate: boolean) {
        return this.chatService.setChannelPrivacy(user.sub, channelId, isPrivate);
    }

    @Patch('channels/:id/max-members')
    setMaxMembers( @CurrentUser() user: JwtPayload, @Param('id', ParseIntPipe) channelId: number, @Body('maxMembers') maxMembers: number) {
        return this.chatService.setMaxMember(user.sub, channelId, maxMembers);
    }

    @Delete('channels/:id')
    deleteChannel( @CurrentUser() user: JwtPayload, @Param('id', ParseIntPipe) channelId: number) {
        return this.chatService.deleteChannel(user.sub, channelId);
    }

    // ── Amis ──────────────────────────────────────────────────────────────────

    @Get('friends')
    getFriends(@CurrentUser() user: JwtPayload) {
        return this.chatService.getFriends(user.sub);
    }

    @Get('friends/pending')
    getPending(@CurrentUser() user: JwtPayload) {
        return this.chatService.getPendingRequests(user.sub);
    }

    @Post('friends/:userId')
    sendFriendRequest( @CurrentUser() user: JwtPayload, @Param('userId', ParseIntPipe) addresseeId: number) {
        return this.chatService.sendFriendRequest(user.sub, addresseeId);
    }

    @Patch('friends/:friendshipId/accept')
    acceptFriendRequest( @CurrentUser() user: JwtPayload, @Param('friendshipId', ParseIntPipe) friendshipId: number) {
        return this.chatService.acceptFriendRequest(user.sub, friendshipId);
    }

    @Delete('friends/:friendshipId')
    rejectFriendRequest( @CurrentUser() user: JwtPayload, @Param('friendshipId', ParseIntPipe) friendshipId: number) {
        return this.chatService.rejectFriendRequest(user.sub, friendshipId);
    }

    @Post('block/:userId')
    blockUser( @CurrentUser() user: JwtPayload, @Param('userId', ParseIntPipe) targetUserId: number) {
        return this.chatService.blockUser(user.sub, targetUserId);
    }

    @Delete('block/:userId')
    unblockUser( @CurrentUser() user: JwtPayload, @Param('userId', ParseIntPipe) targetUserId: number) {
        return this.chatService.unblockUser(user.sub, targetUserId);
    }

    @Get('game-rooms')
    getGameRooms(@CurrentUser() user: JwtPayload) {
        return this.chatService.getGameChannels(user.sub);
    }

    @Post('create-game')
    async createGameRoom(@CurrentUser() user: JwtPayload, @Body() body: { name?: string; isPrivate?: boolean; maxMembers?: number; password?: string; rounds?: number }) {
        const roomName = body.name || `Game Room ${Math.floor(Math.random() * 1000)}`;
        const session = await this.gameService.createGameSession(user.sub, roomName, body.isPrivate ?? false, body.maxMembers, body.password, body.rounds);
        return session;
    }
}