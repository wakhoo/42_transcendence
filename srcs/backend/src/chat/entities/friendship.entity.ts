import {
    Column,
    CreateDateColumn,
    Entity,
    ManyToOne,
    PrimaryGeneratedColumn,
    Unique,
} from 'typeorm';
import { User } from '../../user/user.entity';

// Un seul enregistrement par paire (requester -> addressee)
@Unique(['requester', 'addressee'])
@Entity('friendships')
export class Friendship {
    @PrimaryGeneratedColumn()
    id!: number;

    // pending  = demande envoyée, pas encore acceptée
    // accepted = amis
    // blocked  = requester a bloqué addressee
    @Column({ type: 'enum', enum: ['pending', 'accepted', 'blocked'], default: 'pending' })
    status!: 'pending' | 'accepted' | 'blocked';

    @CreateDateColumn()
    createdAt!: Date;

    // Celui qui envoie la demande / qui bloque
    @ManyToOne(() => User, { onDelete: 'CASCADE', eager: true })
    requester!: User;

    // Celui qui reçoit la demande / qui est bloqué
    @ManyToOne(() => User, { onDelete: 'CASCADE', eager: true })
    addressee!: User;
}
