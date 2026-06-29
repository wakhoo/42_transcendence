import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Channel } from './entities/channel.entity';
import { ChannelMember } from './entities/channel-member.entity';
import { Message } from './entities/message.entity';
import { Friendship } from './entities/friendship.entity';

@Injectable()
export class ChatService {
    constructor(
        @InjectRepository(Channel)
        private readonly channelRepo: Repository<Channel>,

        @InjectRepository(ChannelMember)
        private readonly memberRepo: Repository<ChannelMember>,

        @InjectRepository(Message)
        private readonly messageRepo: Repository<Message>,

        @InjectRepository(Friendship)
        private readonly friendshipRepo: Repository<Friendship>,
    ) {}

    // ─────────────────────────────────────────────────────────────────────────
    // INITIALISATION
    // Appelé au démarrage : crée le salon général s'il n'existe pas encore
    // ─────────────────────────────────────────────────────────────────────────

    async ensureGeneralChannel(): Promise<Channel> {
        let general = await this.channelRepo.findOne({ where: { name: 'general' } });
        if (!general) {
            general = this.channelRepo.create({ name: 'general', type: 'general' });
            general = await this.channelRepo.save(general);
        }
        return general;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CHANNELS — création et consultation
    // ─────────────────────────────────────────────────────────────────────────

    // Retourne tous les channels publics (visible dans la liste des salons)
    async getPublicChannels(): Promise<Channel[]> {
        return this.channelRepo.find({ where: { isPrivate: false } });
    }

    // Retourne les channels dont l'utilisateur est membre
    async getMyChannels(userId: number): Promise<Channel[]> {
        const memberships = await this.memberRepo.find({
            where: { user: { id: userId } },
            relations: ['channel'],
        });
        return memberships.map((m) => m.channel);
    }

    // Crée un nouveau channel et ajoute le créateur comme admin
    async createChannel(
        userId: number,
        name: string,
        type: 'general' | 'game' | 'dm',
        isPrivate: boolean,
        password?: string,
        maxMembers?: number,
    ): Promise<Channel> {
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

        // Le créateur devient automatiquement admin du salon
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



    // ─────────────────────────────────────────────────────────────────────────
    // CHANNELS — actions admin (kick, invite, mute, password, suppression)
    // ─────────────────────────────────────────────────────────────────────────



    // ─────────────────────────────────────────────────────────────────────────
    // MESSAGES
    // ─────────────────────────────────────────────────────────────────────────



    // ─────────────────────────────────────────────────────────────────────────
    // MESSAGES PRIVÉS — crée ou retrouve un channel DM entre deux users
    // ─────────────────────────────────────────────────────────────────────────


    // ─────────────────────────────────────────────────────────────────────────
    // AMIS
    // ─────────────────────────────────────────────────────────────────────────


}
