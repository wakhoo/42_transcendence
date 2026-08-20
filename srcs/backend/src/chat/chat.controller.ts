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
import { CurrentUser, AuthenticatedUser } from './decorators/current-user.decorator';
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
    getMyChannels(@CurrentUser() user: AuthenticatedUser) {
        return this.chatService.getMyChannels(user.id);
    }

    @Post('channels')
    createChannel(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateChannelDto) {
        return this.chatService.createChannel(user.id, dto.name, dto.type ?? 'general', dto.isPrivate ?? false, dto.password, dto.maxMembers);
    }

    @Post('channels/join')
    joinChannel(@CurrentUser() user: AuthenticatedUser, @Body() dto: JoinChannelDto) {
        return this.chatService.joinChannel(user.id, dto.channelId, dto.password);
    }

    @Post('channels/leave')
    leaveChannel(@CurrentUser() user: AuthenticatedUser, @Body() dto: ChannelIdDto) {
        return this.chatService.leaveChannel(user.id, dto.channelId);
    }

    @Post('channels/messages')
    async getMessages(@CurrentUser() user: AuthenticatedUser, @Body() dto: ChannelIdDto) {
        const role = await this.chatService.getMemberRole(user.id, dto.channelId);
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
    kickMember(@CurrentUser() user: AuthenticatedUser, @Body() dto: ChannelUserDto) {
        return this.chatService.kickMember(user.id, dto.channelId, dto.userId);
    }

    @Post('channels/invite')
    inviteUser(@CurrentUser() user: AuthenticatedUser, @Body() dto: ChannelUserDto) {
        return this.chatService.inviteUser(user.id, dto.channelId, dto.userId);
    }

    @Patch('channels/mute')
    muteMember(@CurrentUser() user: AuthenticatedUser, @Body() dto: MuteMemberDto) {
        return this.chatService.muteMember(user.id, dto.channelId, dto.targetUserId, dto.minutes);
    }

    @Patch('channels/password')
    setPassword(@CurrentUser() user: AuthenticatedUser, @Body() dto: SetPasswordDto) {
        return this.chatService.setChannelPassword(user.id, dto.channelId, dto.oldPassword, dto.password);
    }

    @Patch('channels/privacy')
    setPrivacy(@CurrentUser() user: AuthenticatedUser, @Body() dto: SetPrivacyDto) {
        return this.chatService.setChannelPrivacy(user.id, dto.channelId, dto.isPrivate);
    }

    @Patch('channels/max-members')
    setMaxMembers(@CurrentUser() user: AuthenticatedUser, @Body() dto: SetMaxMembersDto) {
        return this.chatService.setMaxMember(user.id, dto.channelId, dto.maxMembers);
    }

    @Post('channels/delete')
    deleteChannel(@CurrentUser() user: AuthenticatedUser, @Body() dto: ChannelIdDto) {
        return this.chatService.deleteChannel(user.id, dto.channelId);
    }

    // ── Amis ──────────────────────────────────────────────────────────────────

    @Get('friends')
    getFriends(@CurrentUser() user: AuthenticatedUser) {
        return this.chatService.getFriends(user.id);
    }

    @Get('friends/pending')
    getPending(@CurrentUser() user: AuthenticatedUser) {
        return this.chatService.getPendingRequests(user.id);
    }

    @Post('friends')
    sendFriendRequest(@CurrentUser() user: AuthenticatedUser, @Body() dto: UserIdDto) {
        return this.chatService.sendFriendRequest(user.id, dto.userId);
    }

    @Patch('friends/accept')
    acceptFriendRequest(@CurrentUser() user: AuthenticatedUser, @Body() dto: FriendshipIdDto) {
        return this.chatService.acceptFriendRequest(user.id, dto.friendshipId);
    }

    @Post('friends/remove')
    rejectFriendRequest(@CurrentUser() user: AuthenticatedUser, @Body() dto: FriendshipIdDto) {
        return this.chatService.rejectFriendRequest(user.id, dto.friendshipId);
    }

    @Post('block')
    blockUser(@CurrentUser() user: AuthenticatedUser, @Body() dto: UserIdDto) {
        return this.chatService.blockUser(user.id, dto.userId);
    }

    @Post('block/remove')
    unblockUser(@CurrentUser() user: AuthenticatedUser, @Body() dto: UserIdDto) {
        return this.chatService.unblockUser(user.id, dto.userId);
    }

    @Get('game-rooms')
    getGameRooms(@CurrentUser() user: AuthenticatedUser) {
        return this.chatService.getGameChannels(user.id);
    }

    @Post('create-game')
    async createGameRoom(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateGameRoomDto) {
        const roomName = dto.name || `Game Room ${Math.floor(Math.random() * 1000)}`;
        const session = await this.gameService.createGameSession(user.id, roomName, dto.isPrivate ?? false, dto.maxMembers, dto.password, dto.rounds);
        return session;
    }
}
