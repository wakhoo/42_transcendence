import {
    Column,
    CreateDateColumn,
    Entity,
    ManyToOne,
    PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../user/user.entity';
import { Channel } from './channel.entity';

@Entity('messages')
export class Message {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'text' })
    content!: string;

    @CreateDateColumn()
    createdAt!: Date;

    @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true, eager: true })
    sender!: User | null;

    @ManyToOne(() => Channel, (channel) => channel.messages, { onDelete: 'CASCADE' })
    channel!: Channel;
}
