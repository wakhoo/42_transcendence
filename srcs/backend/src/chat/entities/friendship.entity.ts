import {
    Column,
    CreateDateColumn,
    Entity,
    ManyToOne,
    PrimaryGeneratedColumn,
    Unique,
} from 'typeorm';
import { User } from '../../user/user.entity';

@Unique(['requester', 'addressee'])
@Entity('friendships')
export class Friendship {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'enum', enum: ['pending', 'accepted', 'blocked'], default: 'pending' })
    status!: 'pending' | 'accepted' | 'blocked';

    @CreateDateColumn()
    createdAt!: Date;

    @ManyToOne(() => User, { onDelete: 'CASCADE', eager: true })
    requester!: User;

    @ManyToOne(() => User, { onDelete: 'CASCADE', eager: true })
    addressee!: User;
}
