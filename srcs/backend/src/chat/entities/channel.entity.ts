import {
    Column,
    CreateDateColumn,
    Entity,
    OneToMany,
    PrimaryGeneratedColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { Message } from './message.entity';
import { ChannelMember } from './channel-member.entity';

@Entity('channels')
export class Channel {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ length: 50, unique: true })
    name!: string;

    @Column({ type: 'enum', enum: ['general', 'game', 'dm'], default: 'general' })
    type!: 'general' | 'game' | 'dm';

    @Column({ default: false })
    isPrivate!: boolean;

    @Exclude()
    @Column({ nullable: true, type: 'varchar', length: 255 })
    passwordHash: string | null = null;

    @Column({ nullable: true, type: 'int', unsigned: true })
    maxMembers: number | null = null;

    @CreateDateColumn()
    createdAt!: Date;

    @OneToMany(() => Message, (message) => message.channel)
    messages!: Message[];

    @OneToMany(() => ChannelMember, (member) => member.channel)
    members!: ChannelMember[];
}
