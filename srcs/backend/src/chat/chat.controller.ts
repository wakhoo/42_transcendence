import {
    Body,
    Controller,
    ForbiddenException,
    Get,
    NotFoundException,
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
import { SetPrivacyDto } from './dto/set-privacy.dto';
import { SetMaxMembersDto } from './dto/set-max-members.dto';
import { ChannelIdDto } from './dto/channel-id.dto';
import { ChannelUserDto } from './dto/channel-user.dto';
import { UserIdDto } from './dto/user-id.dto';
import { FriendshipIdDto } from './dto/friendship-id.dto';
import { FindPrivateGameDto } from './dto/find-private-game.dto';
import { GameService } from '../game/game.service';
import { CreateGameRoomDto } from './dto/create-game-room.dto';

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

    @Post('channels/join')
    joinChannel(@CurrentUser() user: JwtPayload, @Body() dto: JoinChannelDto) {
        return this.chatService.joinChannel(user.sub, dto.channelId, dto.password);
    }

    @Post('channels/leave')
    leaveChannel(@CurrentUser() user: JwtPayload, @Body() dto: ChannelIdDto) {
        return this.chatService.leaveChannel(user.sub, dto.channelId);
    }

    @Post('channels/messages')
    async getMessages(@CurrentUser() user: JwtPayload, @Body() dto: ChannelIdDto) {
        const role = await this.chatService.getMemberRole(user.sub, dto.channelId);
        if (!role) throw new ForbiddenException('Not a member of this channel');
        return this.chatService.getMessages(dto.channelId);
    }

    @Post('find-private-game')
    async findPrivateGame(@Body() dto: FindPrivateGameDto) {
        const channelId = this.gameService.findRoomByCode(dto.code);
        if (!channelId) throw new NotFoundException('Invalid code or room closed');
        return { channelId };
    }

    // ── Actions admin ─────────────────────────────────────────────────────────

    @Post('channels/kick')
    kickMember(@CurrentUser() user: JwtPayload, @Body() dto: ChannelUserDto) {
        return this.chatService.kickMember(user.sub, dto.channelId, dto.userId);
    }

    @Post('channels/invite')
    inviteUser(@CurrentUser() user: JwtPayload, @Body() dto: ChannelUserDto) {
        return this.chatService.inviteUser(user.sub, dto.channelId, dto.userId);
    }

    @Patch('channels/mute')
    muteMember(@CurrentUser() user: JwtPayload, @Body() dto: MuteMemberDto) {
        return this.chatService.muteMember(user.sub, dto.channelId, dto.targetUserId, dto.minutes);
    }

    @Patch('channels/password')
    setPassword(@CurrentUser() user: JwtPayload, @Body() dto: SetPasswordDto) {
        return this.chatService.setChannelPassword(user.sub, dto.channelId, dto.password);
    }

    @Patch('channels/privacy')
    setPrivacy(@CurrentUser() user: JwtPayload, @Body() dto: SetPrivacyDto) {
        return this.chatService.setChannelPrivacy(user.sub, dto.channelId, dto.isPrivate);
    }

    @Patch('channels/max-members')
    setMaxMembers(@CurrentUser() user: JwtPayload, @Body() dto: SetMaxMembersDto) {
        return this.chatService.setMaxMember(user.sub, dto.channelId, dto.maxMembers);
    }

    @Post('channels/delete')
    deleteChannel(@CurrentUser() user: JwtPayload, @Body() dto: ChannelIdDto) {
        return this.chatService.deleteChannel(user.sub, dto.channelId);
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

    @Post('friends')
    sendFriendRequest(@CurrentUser() user: JwtPayload, @Body() dto: UserIdDto) {
        return this.chatService.sendFriendRequest(user.sub, dto.userId);
    }

    @Patch('friends/accept')
    acceptFriendRequest(@CurrentUser() user: JwtPayload, @Body() dto: FriendshipIdDto) {
        return this.chatService.acceptFriendRequest(user.sub, dto.friendshipId);
    }

    @Post('friends/remove')
    rejectFriendRequest(@CurrentUser() user: JwtPayload, @Body() dto: FriendshipIdDto) {
        return this.chatService.rejectFriendRequest(user.sub, dto.friendshipId);
    }

    @Post('block')
    blockUser(@CurrentUser() user: JwtPayload, @Body() dto: UserIdDto) {
        return this.chatService.blockUser(user.sub, dto.userId);
    }

    @Post('block/remove')
    unblockUser(@CurrentUser() user: JwtPayload, @Body() dto: UserIdDto) {
        return this.chatService.unblockUser(user.sub, dto.userId);
    }

    @Get('game-rooms')
    getGameRooms(@CurrentUser() user: JwtPayload) {
        return this.chatService.getGameChannels(user.sub);
    }

    @Post('create-game')
    async createGameRoom(@CurrentUser() user: JwtPayload, @Body() body: CreateGameRoomDto) {
        const roomName = body.name || `Game Room ${Math.floor(Math.random() * 1000)}`;
        const session = await this.gameService.createGameSession(user.sub, roomName, body.isPrivate ?? false, body.maxMembers, body.password, body.rounds);
        return session;
    }
}
