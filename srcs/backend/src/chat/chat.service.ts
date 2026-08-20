import {
    BadRequestException,
    ForbiddenException,
    forwardRef,
    Inject,
    Injectable,
    NotFoundException,
    OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Server } from 'socket.io';
import * as bcrypt from 'bcrypt';
import { Channel } from './entities/channel.entity';
import { ChannelMember } from './entities/channel-member.entity';
import { Message } from './entities/message.entity';
import { User } from '../user/user.entity';
import { Friendship } from './entities/friendship.entity';
import { BadWord } from './entities/bad-word.entity';
import { BAD_WORDS } from './words.seed';
import { GameService } from '../game/game.service';
import { UserService } from '../user/user.service';
import { BCRYPT_ROUNDS } from '../common/constants';

@Injectable()
export class ChatService implements OnModuleInit {
    public server!: Server;

    constructor(
        @InjectRepository(Channel)
        private readonly channelRepo: Repository<Channel>,

        @InjectRepository(ChannelMember)
        private readonly memberRepo: Repository<ChannelMember>,

        @InjectRepository(Message)
        private readonly messageRepo: Repository<Message>,

        @InjectRepository(Friendship)
        private readonly friendshipRepo: Repository<Friendship>,

        @InjectRepository(BadWord)
        private readonly badWordRepo: Repository<BadWord>,

        @Inject(forwardRef(() => GameService))
        private readonly gameService: GameService,

        private readonly userService: UserService,
    ) {}


    // INITIALISATION : si salon general ou badwords n'existent pas, les cree 

    async onModuleInit(): Promise<void> {
        const count = await this.badWordRepo.count();
        if (count === 0) {
            const entities = BAD_WORDS.map((word) => this.badWordRepo.create({ word }));
            await this.badWordRepo.save(entities);
        }
    }
    
    async ensureGeneralChannel(): Promise<Channel> {
        let general = await this.channelRepo.findOne({ where: { name: 'general' } });
        if (!general) {
            general = this.channelRepo.create({ name: 'general', type: 'general' });
            general = await this.channelRepo.save(general);
        }
        return general;
    }


    // CHANNELS : creation + getters

    async getGameChannels(userId: number) {
        const channels = await this.channelRepo.find({ where: { type: 'game' }, relations: { members: { user: true } } });
        return channels.map(channel => ({
            ...channel,
            members: channel.members.map(m => this.toPublicUser(m.user)),
            hasPassword: !!channel.passwordHash,
            isUserMember: channel.members.some(m => m.user?.id === userId),
            isUserKicked: this.gameService.isUserKick(channel.id, userId),
            maxRound: this.gameService.getSession(channel.id)?.maxRound,
        }));
    }

    async getMyChannels(userId: number): Promise<Channel[]> {
        const memberships = await this.memberRepo.find({ where: { user: { id: userId } }, relations: { channel: true }, });
        return memberships.map((m) => m.channel);
    }

    async createChannel(userId: number, name: string, type: 'general' | 'game' | 'dm', isPrivate: boolean, password?: string, maxMembers?: number): Promise<Channel> {
        const existing = await this.channelRepo.findOne({ where: { name } });
        if (existing) throw new BadRequestException('Channel name already taken');

        let passwordHash: string | null = null;
        if (password) {
            passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
        }

        const channel = this.channelRepo.create({
            name,
            type,
            isPrivate,
            passwordHash,
            maxMembers: maxMembers ?? (type === 'game' ? 8 : null),
        });
        const saved = await this.channelRepo.save(channel);

        const membership = this.memberRepo.create({ user: { id: userId }, channel: { id: saved.id }, role: 'admin'});
        await this.memberRepo.save(membership);

        if (type === 'game') {
            this.server.emit('gameRoomsChanged');
        }

        return saved;
    }


    // CHANNELS — rejoindre et quitter

    async getChannelMember(channelId: number): Promise<ChannelMember[]>  {
        return this.memberRepo.find({ where: { channel: { id: channelId } } });
    }


    async joinChannel(userId: number, channelId: number, password?: string): Promise<ChannelMember> {
        const channel = await this.channelRepo.findOne({ where: { id: channelId } });
        if (!channel) throw new NotFoundException('Channel not found');

        const existing = await this.memberRepo.findOne({ where: { user: { id: userId }, channel: { id: channelId } } });
        if (existing) 
            return existing;

        if (channel.type === 'game' && this.gameService.isUserKick(channelId, userId))
            throw new ForbiddenException('You have been kicked from this room');

        if (channel.isPrivate) throw new ForbiddenException('This room is private (invitation only)');

        if (channel.passwordHash) {
            if (!password) throw new ForbiddenException('This channel requires a password');
            const valid = await bcrypt.compare(password, channel.passwordHash);
            if (!valid) throw new ForbiddenException('Wrong password');
        }

        if (channel.maxMembers !== null) {
            const count = await this.memberRepo.count({ where: { channel: { id: channelId } } });
            if (count >= channel.maxMembers) throw new ForbiddenException('Channel is full');
        }

        const membership = this.memberRepo.create({ user: { id: userId }, channel: { id: channelId }, role: 'member'});
        return this.memberRepo.save(membership);
    }

    async leaveChannel(userId: number, channelId: number): Promise<void> {
        const membership = await this.memberRepo.findOne({ where: { user: { id: userId }, channel: { id: channelId } } });
        if (!membership) throw new NotFoundException('You are not a member of this channel');

        const wasAdmin = membership.role === 'admin' ;
        await this.memberRepo.remove(membership);

        if (wasAdmin){
            const remainingmembers = await this.memberRepo.find({ where: {channel : { id: channelId}}});
        
        if(remainingmembers.length > 0) {
            const newAdmin = remainingmembers[0];
            newAdmin.role = 'admin';
            await this.memberRepo.save(newAdmin);
            }
        }
    }


    // CHANNELS — actions admin (kick, invite, mute, password, limit, suppression)

    private async requireAdmin(userId: number, channelId: number): Promise<void> {
        const membership = await this.memberRepo.findOne({ where: { user: { id: userId }, channel: { id: channelId } } });
        if (!membership || membership.role !== 'admin') {
            throw new ForbiddenException('Admin privileges required');
        }
    }

    private async requireUserExists(userId: number): Promise<void> {
        const user = await this.userService.findById(userId);
        if (!user) throw new NotFoundException('User not found');
    }

    // resout un publicId (uuid, tel que fourni par le client) vers l'id numerique interne
    private async resolveUserId(publicId: string): Promise<number> {
        const user = await this.userService.findByPublicId(publicId);
        if (!user) throw new NotFoundException('User not found');
        return user.id;
    }

    async kickMember(adminId: number, channelId: number, targetPublicId: string): Promise<void> {
        await this.requireAdmin(adminId, channelId);
        const targetUserId = await this.resolveUserId(targetPublicId);
        this.gameService.banUserFromChannel(channelId, targetUserId);
        await this.gameService.forcedRemovePlayer(channelId, targetUserId);
        const target = await this.memberRepo.findOne({ where: { user: { id: targetUserId }, channel: { id: channelId } } });
        if (target)
            await this.memberRepo.remove(target);
    }

    async inviteUser(adminId: number, channelId: number, targetPublicId: string) {
        await this.requireAdmin(adminId, channelId);
        const targetUser = await this.userService.findByPublicId(targetPublicId);
        if (!targetUser) throw new NotFoundException('User not found');
        const targetUserId = targetUser.id;
        const existing = await this.memberRepo.findOne({ where: { user: { id: targetUserId }, channel: { id: channelId } } });
        if (existing) throw new BadRequestException('User is already in this channel');
        const channel = await this.channelRepo.findOne({ where: { id: channelId } });
        if (channel?.maxMembers !== null && channel?.maxMembers !== undefined) {
            const memberCount = await this.memberRepo.count({ where: { channel: { id: channelId } } });
            if (memberCount >= channel.maxMembers) throw new BadRequestException('Channel is full');
        }
        const membership = this.memberRepo.create({ user: { id: targetUserId }, channel: { id: channelId }, role: 'member'});
        await this.gameService.sendInviteNotif(targetPublicId, channelId,"Admin");
        const saved = await this.memberRepo.save(membership);
        return { ...saved, user: this.toPublicUser(targetUser) };
    }

    async muteMember(adminId: number, channelId: number, targetPublicId: string, minutes: number): Promise<void> {
        await this.requireAdmin(adminId, channelId);
        const targetUserId = await this.resolveUserId(targetPublicId);
        const target = await this.memberRepo.findOne({ where: { user: { id: targetUserId }, channel: { id: channelId } }, });
        if (!target) throw new NotFoundException('Target user is not in this channel');
        if (minutes > 60) 
            minutes = 60;
        target.mutedUntil = minutes > 0 ? new Date(Date.now() + minutes * 60000) : null;
        await this.memberRepo.save(target);
    }

    async setChannelPassword(adminId: number, channelId: number, oldPassword: string | undefined, password: string | undefined): Promise<void> {
        await this.requireAdmin(adminId, channelId);
        const channel = await this.channelRepo.findOne({ where: { id: channelId } });
        if (!channel) throw new NotFoundException('Channel not found');
        if (channel.passwordHash) {
            if (!oldPassword) throw new ForbiddenException('Current password required');
            const valid = await bcrypt.compare(oldPassword, channel.passwordHash);
            if (!valid) throw new ForbiddenException('Wrong current password');
        }
        channel.passwordHash = password ? await bcrypt.hash(password, BCRYPT_ROUNDS) : null;
        await this.channelRepo.save(channel);
        this.gameService.updateSessionHasPassword(channelId, !!channel.passwordHash);
    }

    async setChannelPrivacy(adminId: number, channelId: number, isPrivate: boolean): Promise<void> {
        await this.requireAdmin(adminId, channelId);
        const channel = await this.channelRepo.findOne({ where: { id: channelId } });
        if (!channel) throw new NotFoundException('Channel not found');
        channel.isPrivate = isPrivate;
        await this.channelRepo.save(channel);
    }

    async setMaxMember(adminId: number, channelId: number, maxMembers: number): Promise<void> {
        await this.requireAdmin(adminId, channelId);
        const channel = await this.channelRepo.findOne({ where: { id: channelId } });
        if (!channel) throw new NotFoundException('Channel not found');
        channel.maxMembers = maxMembers;
        await this.channelRepo.save(channel);
    }   

    async deleteChannel(adminId: number, channelId: number): Promise<void> {
        await this.requireAdmin(adminId, channelId);
        const channel = await this.channelRepo.findOne({ where: { id: channelId } });
        if (!channel) throw new NotFoundException('Channel not found');
        if (channel.type === 'general') throw new ForbiddenException('Cannot delete the general channel');

        await this.gameService.forceCloseGame(channelId);
        await this.channelRepo.remove(channel);

        if (channel.type === 'game') {
            this.server.emit('gameRoomsChanged');
        }
    }

    async deleteChannelIfEmpty(channelId: number): Promise<void> {
        const channel = await this.channelRepo.findOne({ where: { id: channelId } });
        if (!channel)
            return;
        if (channel.type === 'general')
            return;

        await this.memberRepo.delete({ channel: { id: channelId } });
        const memberCount = await this.memberRepo.count({ where: { channel: { id: channelId } } });
        if (memberCount > 0)
            return;

        await this.gameService.forceCloseGame(channelId);
        await this.channelRepo.remove(channel);

        if (channel.type === 'game') {
            this.server.emit('gameRoomsChanged');
        }
    }


    // MESSAGES

    async sendMessage(userId: number, channelId: number, content: string): Promise<Message | any> {
        const membership = await this.memberRepo.findOne({ where: { user: { id: userId }, channel: { id: channelId } }, relations: { channel: true }});
        if (!membership) throw new ForbiddenException('You are not a member of this channel');

        if (membership.mutedUntil && membership.mutedUntil > new Date()) {
            throw new ForbiddenException('You are muted in this channel');
        }

        const badWords = await this.badWordRepo.find();
        const lower = ' ' + content.toLowerCase() + ' ';
        const found = badWords.find((bw) => lower.includes(' ' + bw.word + ' '));
        if (found) {
            membership.warnings += 1;
            if (membership.warnings >= 2) {
                if (membership.channel.type === 'game') {
                    await this.memberRepo.remove(membership);
                    this.gameService.banUserFromChannel(channelId, userId);
                    await this.gameService.forcedRemovePlayer(channelId, userId);
                    throw new ForbiddenException('You were kicked from the game channel for repeated inappropriate messages.');
                } else {
                    membership.mutedUntil = new Date(Date.now() + 5 * 60000);
                    membership.warnings = 0;
                    await this.memberRepo.save(membership);
                    throw new ForbiddenException('You have been muted for 5 minutes for repeated inappropriate messages.');
                }
            }
            await this.memberRepo.save(membership);
            throw new ForbiddenException(`Your message was blocked: inappropriate content. Warning ${membership.warnings}/2.`);
        }

         if (membership.channel.type === 'game'){

            const isdrawer = this.gameService.isCurrentDrawer(channelId, userId);

            if (isdrawer) {
                const secretWord = this.gameService.getSecretWord(channelId);
                if (secretWord && content.toLowerCase().includes(secretWord.toLowerCase()))
                    throw new ForbiddenException(`You are the drawer, don't write the secret word.`);
            } else {
                const isWord = await this.gameService.checkGuess(userId, channelId, content, membership.role);
                if (isWord)
                    content = ` has found the word !`;
            }
         }

        const message = this.messageRepo.create({content, sender: { id: userId }, channel: { id: channelId }});
        const saved = await this.messageRepo.save(message);
        const full = await this.messageRepo.findOneOrFail({ where: { id: saved.id }, relations: { sender: true } });
        return { ...full, sender: this.toPublicUser(full.sender) };
    }

    async getMessages(channelId: number, limit = 50) {
        const messages = await this.messageRepo.find({ where: { channel: { id: channelId } }, relations: { sender: true }, order: { createdAt: 'DESC' }, take: limit });
        return messages.map((m) => ({ ...m, sender: this.toPublicUser(m.sender) }));
    }

    private toPublicUser(user: User | null) {
        if (!user) return null;
        const { publicId, username, avatarUrl, profileColor } = user;
        return { publicId, username, avatarUrl, profileColor };
    }


    // MESSAGES PRIVÉS — crée ou retrouve un channel DM entre deux users

    async getOrCreateDmChannel(userId: number, targetUserId: number): Promise<Channel> {
        const dmName = `dm_${Math.min(userId, targetUserId)}_${Math.max(userId, targetUserId)}`;

        let channel = await this.channelRepo.findOne({ where: { name: dmName } });
        if (!channel) {
            await this.requireUserExists(targetUserId);
            channel = await this.channelRepo.save(this.channelRepo.create({ name: dmName, type: 'dm', isPrivate: true }));
            await this.memberRepo.save([
                this.memberRepo.create({ user: { id: userId }, channel: { id: channel.id }, role: 'member' }),
                this.memberRepo.create({ user: { id: targetUserId }, channel: { id: channel.id }, role: 'member' }),
            ]);
        }
        return channel;
    }


    // AMIS

    // n'expose jamais requester/addressee tels quels (eager-loaded => email/oauth inclus) :
    // on les remplace par le profil public minimal
    private toPublicFriendship(f: Friendship) {
        return { ...f, requester: this.toPublicUser(f.requester), addressee: this.toPublicUser(f.addressee) };
    }

    async sendFriendRequest(requesterId: number, addresseePublicId: string) {
        const addressee = await this.userService.findByPublicId(addresseePublicId);
        if (!addressee) throw new NotFoundException('User not found');
        if (requesterId === addressee.id) throw new BadRequestException('Cannot add yourself');

        const existing = await this.friendshipRepo.findOne({
            where: [
                { requester: { id: requesterId }, addressee: { id: addressee.id } },
                { requester: { id: addressee.id }, addressee: { id: requesterId } },
            ],
        });
        if (existing) throw new BadRequestException('A relation already exists with this user');

        const friendship = this.friendshipRepo.create({
            requester: { id: requesterId },
            addressee: { id: addressee.id },
            status: 'pending',
        });
        const saved = await this.friendshipRepo.save(friendship);
        const full = await this.friendshipRepo.findOneOrFail({ where: { id: saved.id } });
        return this.toPublicFriendship(full);
    }

    async acceptFriendRequest(userId: number, friendshipId: number) {
        const friendship = await this.friendshipRepo.findOne({ where: { id: friendshipId } });
        if (!friendship) throw new NotFoundException('Friend request not found');
        if (friendship.addressee.id !== userId) throw new ForbiddenException('Not your request');
        if (friendship.status !== 'pending') throw new BadRequestException('Request is not pending');
        friendship.status = 'accepted';
        const saved = await this.friendshipRepo.save(friendship);
        return this.toPublicFriendship(saved);
    }

    async rejectFriendRequest(userId: number, friendshipId: number): Promise<void> {
        const friendship = await this.friendshipRepo.findOne({ where: { id: friendshipId } });
        if (!friendship) throw new NotFoundException('Friend request not found');
        if (friendship.addressee.id !== userId) throw new ForbiddenException('Not your request');
        await this.friendshipRepo.remove(friendship);
    }

    async unblockUser(userId: number, targetPublicId: string): Promise<void> {
        const targetUserId = await this.resolveUserId(targetPublicId);
        const block = await this.friendshipRepo.findOne({ where: { requester: { id: userId }, addressee: { id: targetUserId }, status: 'blocked' } });
        if (!block) throw new NotFoundException('No block found with this user');
        await this.friendshipRepo.remove(block);
    }

    async blockUser(userId: number, targetPublicId: string) {
        const target = await this.userService.findByPublicId(targetPublicId);
        if (!target) throw new NotFoundException('User not found');
        if (userId === target.id) throw new BadRequestException('Cannot block yourself');
        const existing = await this.friendshipRepo.findOne({ where: [{ requester: { id: userId }, addressee: { id: target.id } },
            { requester: { id: target.id }, addressee: { id: userId } },],});
        if (existing) await this.friendshipRepo.remove(existing);

        const block = this.friendshipRepo.create({requester: { id: userId }, addressee: { id: target.id }, status: 'blocked'});
        const saved = await this.friendshipRepo.save(block);
        const full = await this.friendshipRepo.findOneOrFail({ where: { id: saved.id } });
        return this.toPublicFriendship(full);
    }

    async getFriends(userId: number) {
        const friendships = await this.friendshipRepo.find({ where: [ { requester: { id: userId }, status: 'accepted' }, { addressee: { id: userId }, status: 'accepted' } ] });
        return friendships.map(f => this.toPublicFriendship(f));
    }

    async getPendingRequests(userId: number) {
        const friendships = await this.friendshipRepo.find({ where: { addressee: { id: userId }, status: 'pending' }, });
        return friendships.map(f => this.toPublicFriendship(f));
    }

    async isBlocked(userId: number, targetUserId: number): Promise<boolean> {
        const block = await this.friendshipRepo.findOne({ where: [ { requester: { id: userId }, addressee: { id: targetUserId }, status: 'blocked' },
                { requester: { id: targetUserId }, addressee: { id: userId }, status: 'blocked' } ] });
        return !!block;
    }

    async getMemberRole(userId: number, channelId: number): Promise<'admin' | 'member' | 'spec' | 'drawer' | null> {
        const membership = await this.memberRepo.findOne({ where: { user: { id: userId }, channel: { id: channelId } } });
        return membership?.role ?? null;
    }

    async getChannel(channelId: number): Promise<Channel | null> {
        return this.channelRepo.findOne({ where: { id: channelId } });
    }
}
