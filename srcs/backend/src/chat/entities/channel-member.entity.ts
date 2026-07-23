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

    @Column({ type: 'enum', enum: ['admin', 'member', 'spec', 'drawer'], default: 'member' })
    role!: 'admin' | 'member' | 'spec' | 'drawer';

    @Column({ type: 'datetime', nullable: true })
    mutedUntil: Date | null = null;

    @Column({ default: 0 })
    warnings!: number;

    @CreateDateColumn()
    joinedAt!: Date;

    @ManyToOne(() => User, { onDelete: 'CASCADE', eager: true })
    user!: User;

    @ManyToOne(() => Channel, (channel) => channel.members, { onDelete: 'CASCADE' })
    channel!: Channel;
}
