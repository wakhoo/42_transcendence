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
import * as bcrypt from 'bcrypt';
import { Channel } from './entities/channel.entity';
import { ChannelMember } from './entities/channel-member.entity';
import { Message } from './entities/message.entity';
import { Friendship } from './entities/friendship.entity';
import { BadWord } from './entities/bad-word.entity';
import { BAD_WORDS } from './words.seed';
import { GameService } from '../game/game.service';
//import { WORD } from './../word.seed';

@Injectable()
export class ChatService implements OnModuleInit {
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
    ) {}


    // ─────────────────────────────────────────────────────────────────────────
    // INITIALISATION : si salon general ou badwords n'existent pas, les cree
    // ─────────────────────────────────────────────────────────────────────────

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

    // ─────────────────────────────────────────────────────────────────────────
    // CHANNELS : creation + getters
    // ─────────────────────────────────────────────────────────────────────────

    async getPublicChannels(): Promise<Channel[]> {
        return this.channelRepo.find({ where: { isPrivate: false } });
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
            passwordHash = await bcrypt.hash(password, 10);
        }

        const channel = this.channelRepo.create({
            name,
            type,
            isPrivate,
            passwordHash,
            maxMembers: maxMembers ?? null,
        });
        const saved = await this.channelRepo.save(channel);

        const membership = this.memberRepo.create({
            user: { id: userId },
            channel: { id: saved.id },
            role: 'admin',
        });
        await this.memberRepo.save(membership);

        return saved;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CHANNELS — rejoindre et quitter
    // ─────────────────────────────────────────────────────────────────────────


    async getChannelMember(channelId: number): Promise<ChannelMember[]>  {

        return this.memberRepo.find({ where: { channel: { id: channelId } } });
    }


    async joinChannel(userId: number, channelId: number, password?: string): Promise<ChannelMember> {
        const channel = await this.channelRepo.findOne({ where: { id: channelId } });
        if (!channel) throw new NotFoundException('Channel not found');

        if (channel.passwordHash) {
            if (!password) throw new ForbiddenException('This channel requires a password');
            const valid = await bcrypt.compare(password, channel.passwordHash);
            if (!valid) throw new ForbiddenException('Wrong password');
        }

        if (channel.maxMembers !== null) {
            const count = await this.memberRepo.count({ where: { channel: { id: channelId } } });
            if (count >= channel.maxMembers) throw new ForbiddenException('Channel is full');
        }

        const existing = await this.memberRepo.findOne({ where: { user: { id: userId }, channel: { id: channelId } }, });
        if (existing) throw new BadRequestException('Already a member of this channel');

        const membership = this.memberRepo.create({
            user: { id: userId },
            channel: { id: channelId },
            role: 'member',
        });
        return this.memberRepo.save(membership);
    }

    async leaveChannel(userId: number, channelId: number): Promise<void> {
        const membership = await this.memberRepo.findOne({ where: { user: { id: userId }, channel: { id: channelId } }, });
        if (!membership) throw new NotFoundException('You are not a member of this channel');
        await this.memberRepo.remove(membership);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CHANNELS — actions admin (kick, invite, mute, password, suppression)
    // ─────────────────────────────────────────────────────────────────────────

    private async requireAdmin(userId: number, channelId: number): Promise<void> {
        const membership = await this.memberRepo.findOne({ where: { user: { id: userId }, channel: { id: channelId } }, });
        if (!membership || membership.role !== 'admin') {
            throw new ForbiddenException('Admin privileges required');
        }
    }

    async kickMember(adminId: number, channelId: number, targetUserId: number): Promise<void> {
        await this.requireAdmin(adminId, channelId);
        const target = await this.memberRepo.findOne({ where: { user: { id: targetUserId }, channel: { id: channelId } }, });
        if (!target) throw new NotFoundException('Target user is not in this channel');
        await this.memberRepo.remove(target);
        await this.gameService.forcedRemovePlayer(channelId, targetUserId);
    }

    async inviteUser(adminId: number, channelId: number, targetUserId: number): Promise<ChannelMember> {
        await this.requireAdmin(adminId, channelId);
        const existing = await this.memberRepo.findOne({ where: { user: { id: targetUserId }, channel: { id: channelId } }, });
        if (existing) throw new BadRequestException('User is already in this channel');
        const membership = this.memberRepo.create({
            user: { id: targetUserId },
            channel: { id: channelId },
            role: 'member',
        });
        await this.gameService.sendInviteNotif(targetUserId, channelId,"Admin");
        return this.memberRepo.save(membership);
    }

    async muteMember(adminId: number, channelId: number, targetUserId: number, minutes: number): Promise<void> {
        await this.requireAdmin(adminId, channelId);
        const target = await this.memberRepo.findOne({ where: { user: { id: targetUserId }, channel: { id: channelId } }, });
        if (!target) throw new NotFoundException('Target user is not in this channel');
        target.mutedUntil = minutes > 0 ? new Date(Date.now() + minutes * 60000) : null;
        await this.memberRepo.save(target);
    }

    async setChannelPassword(adminId: number, channelId: number, password: string | null): Promise<void> {
        await this.requireAdmin(adminId, channelId);
        const channel = await this.channelRepo.findOne({ where: { id: channelId } });
        if (!channel) throw new NotFoundException('Channel not found');
        channel.passwordHash = password ? await bcrypt.hash(password, 10) : null;
        await this.channelRepo.save(channel);
    }

    async setChannelPrivacy(adminId: number, channelId: number, isPrivate: boolean): Promise<void> {
        await this.requireAdmin(adminId, channelId);
        const channel = await this.channelRepo.findOne({ where: { id: channelId } });
        if (!channel) throw new NotFoundException('Channel not found');
        channel.isPrivate = isPrivate;
        await this.channelRepo.save(channel);
    }

    async deleteChannel(adminId: number, channelId: number): Promise<void> {
        await this.requireAdmin(adminId, channelId);
        const channel = await this.channelRepo.findOne({ where: { id: channelId } });
        if (!channel) throw new NotFoundException('Channel not found');
        if (channel.type === 'general') throw new ForbiddenException('Cannot delete the general channel');

        await this.gameService.forceCloseGame(channelId);
        await this.channelRepo.remove(channel);
    }

    // Nettoyage automatique (pas une action admin) : supprime le salon si plus
    // personne n'y est reellement (verifie en base, pas juste en memoire), pour
    // que les salons publics abandonnes ne restent pas trainer indefiniment.
    async deleteChannelIfEmpty(channelId: number): Promise<void> {
        const channel = await this.channelRepo.findOne({ where: { id: channelId } });
        if (!channel) return;
        if (channel.type === 'general') return;

        const memberCount = await this.memberRepo.count({ where: { channel: { id: channelId } } });
        if (memberCount > 0) return;

        await this.gameService.forceCloseGame(channelId);
        await this.channelRepo.remove(channel);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MESSAGES
    // ─────────────────────────────────────────────────────────────────────────

    async sendMessage(userId: number, channelId: number, content: string): Promise<Message | any> {
        const membership = await this.memberRepo.findOne({ where: { user: { id: userId }, channel: { id: channelId } }, relations: { channel: true }});
        if (!membership) throw new ForbiddenException('You are not a member of this channel');

        if (membership.mutedUntil && membership.mutedUntil > new Date()) {
            throw new ForbiddenException('You are muted in this channel');
        }

        const badWords = await this.badWordRepo.find();
        const lower = content.toLowerCase();
        const found = badWords.find((bw) => lower.includes(bw.word));
        if (found) {
            membership.warnings += 1;
            if (membership.warnings >= 2) {
                if (membership.channel.type === 'game') {
                    await this.memberRepo.remove(membership);
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
        return this.messageRepo.findOneOrFail({ where: { id: saved.id }, relations: { sender: true } });
    }

    async getMessages(channelId: number, limit = 50): Promise<Message[]> {
        return this.messageRepo.find({ where: { channel: { id: channelId } }, relations: { sender: true }, order: { createdAt: 'DESC' }, take: limit });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MESSAGES PRIVÉS — crée ou retrouve un channel DM entre deux users
    // ─────────────────────────────────────────────────────────────────────────

    async getOrCreateDmChannel(userId: number, targetUserId: number): Promise<Channel> {
        const dmName = `dm_${Math.min(userId, targetUserId)}_${Math.max(userId, targetUserId)}`;

        let channel = await this.channelRepo.findOne({ where: { name: dmName } });
        if (!channel) {
            channel = await this.channelRepo.save(
                this.channelRepo.create({ name: dmName, type: 'dm', isPrivate: true }),
            );
            await this.memberRepo.save([
                this.memberRepo.create({ user: { id: userId }, channel: { id: channel.id }, role: 'member' }),
                this.memberRepo.create({ user: { id: targetUserId }, channel: { id: channel.id }, role: 'member' }),
            ]);
        }
        return channel;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // AMIS
    // ─────────────────────────────────────────────────────────────────────────

    async sendFriendRequest(requesterId: number, addresseeId: number): Promise<Friendship> {
        if (requesterId === addresseeId) throw new BadRequestException('Cannot add yourself');

        const existing = await this.friendshipRepo.findOne({
            where: [
                { requester: { id: requesterId }, addressee: { id: addresseeId } },
                { requester: { id: addresseeId }, addressee: { id: requesterId } },
            ],
        });
        if (existing) throw new BadRequestException('A relation already exists with this user');

        const friendship = this.friendshipRepo.create({
            requester: { id: requesterId },
            addressee: { id: addresseeId },
            status: 'pending',
        });
        return this.friendshipRepo.save(friendship);
    }

    async acceptFriendRequest(userId: number, friendshipId: number): Promise<Friendship> {
        const friendship = await this.friendshipRepo.findOne({ where: { id: friendshipId } });
        if (!friendship) throw new NotFoundException('Friend request not found');
        if (friendship.addressee.id !== userId) throw new ForbiddenException('Not your request');
        if (friendship.status !== 'pending') throw new BadRequestException('Request is not pending');
        friendship.status = 'accepted';
        return this.friendshipRepo.save(friendship);
    }

    async rejectFriendRequest(userId: number, friendshipId: number): Promise<void> {
        const friendship = await this.friendshipRepo.findOne({ where: { id: friendshipId } });
        if (!friendship) throw new NotFoundException('Friend request not found');
        if (friendship.addressee.id !== userId) throw new ForbiddenException('Not your request');
        await this.friendshipRepo.remove(friendship);
    }

    async unblockUser(userId: number, targetUserId: number): Promise<void> {
        // correction : on ne cherche que dans le sens userId=requester pour que seul le bloqueur puisse débloquer
        const block = await this.friendshipRepo.findOne({ where: { requester: { id: userId }, addressee: { id: targetUserId }, status: 'blocked' } });
        if (!block) throw new NotFoundException('No block found with this user');
        await this.friendshipRepo.remove(block);
    }

    async blockUser(userId: number, targetUserId: number): Promise<Friendship> {
        const existing = await this.friendshipRepo.findOne({ where: [{ requester: { id: userId }, addressee: { id: targetUserId } },
            { requester: { id: targetUserId }, addressee: { id: userId } },],});
        if (existing) await this.friendshipRepo.remove(existing);

        const block = this.friendshipRepo.create({requester: { id: userId }, addressee: { id: targetUserId }, status: 'blocked'});
        return this.friendshipRepo.save(block);
    }

    async getFriends(userId: number): Promise<Friendship[]> {
        return this.friendshipRepo.find({ where: [ { requester: { id: userId }, status: 'accepted' }, { addressee: { id: userId }, status: 'accepted' } ] });
    }

    async getPendingRequests(userId: number): Promise<Friendship[]> {
        return this.friendshipRepo.find({ where: { addressee: { id: userId }, status: 'pending' }, });
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
}
