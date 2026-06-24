import {
    Column,
    CreateDateColumn,
    Entity,
    ManyToOne,
    PrimaryGeneratedColumn,
    Unique,
} from 'typeorm';
import { User } from '../../user/user.entity';
import { Channel } from './channel.entity';


@Unique(['user', 'channel'])
@Entity('channel_members')
export class ChannelMember {
    @PrimaryGeneratedColumn()
    id!: number;

    // Rôle dans le salon : admin (créateur, peut kick/inviter/etc.) ou simple membre
    @Column({ type: 'enum', enum: ['admin', 'member'], default: 'member' })
    role!: 'admin' | 'member';

    // Muté jusqu'à cette date (null = pas muté)
    @Column({ type: 'datetime', nullable: true })
    mutedUntil: Date | null = null;

    @CreateDateColumn()
    joinedAt!: Date;

    @ManyToOne(() => User, { onDelete: 'CASCADE', eager: true })
    user!: User;

    @ManyToOne(() => Channel, (channel) => channel.members, { onDelete: 'CASCADE' })
    channel!: Channel;
}
