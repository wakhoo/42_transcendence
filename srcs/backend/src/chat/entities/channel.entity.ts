import {
    Column,
    CreateDateColumn,
    Entity,
    OneToMany,
    PrimaryGeneratedColumn,
} from 'typeorm';
import { Message } from './message.entity';
import { ChannelMember } from './channel-member.entity';

@Entity('channels')
export class Channel {
    @PrimaryGeneratedColumn()
    id!: number;

    // Nom du salon
    @Column({ length: 50, unique: true })
    name!: string;

    // general = salon par défaut à l'arrivée sur le site
    // game    = salon créé automatiquement pour une partie en cours
    // dm      = conversation privée entre deux utilisateurs
    @Column({ type: 'enum', enum: ['general', 'game', 'dm'], default: 'general' })
    type!: 'general' | 'game' | 'dm';

    // Invite only (l'admin doit envoyer une invitation pour rejoindre)
    @Column({ default: false })
    isPrivate!: boolean;

    // Mot de passe optionnel — null = pas de mot de passe
    @Column({ nullable: true, type: 'varchar', length: 255 })
    passwordHash: string | null = null;

    // Limite de membres (utile pour les salons de jeu) — null = pas de limite
    @Column({ nullable: true, type: 'int', unsigned: true })
    maxMembers: number | null = null;

    @CreateDateColumn()
    createdAt!: Date;

    // Un channel a plusieurs messages
    @OneToMany(() => Message, (message) => message.channel)
    messages!: Message[];

    // Un channel a plusieurs membres (avec leurs rôles)
    @OneToMany(() => ChannelMember, (member) => member.channel)
    members!: ChannelMember[];
}
