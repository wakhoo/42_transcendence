import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../user/user.entity';

@Entity('sessions')
export class Session {
    @PrimaryGeneratedColumn()
    id!: number;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user!: User;

    @Column({ name: 'user_id' })
    userId!: number;

    @Column({ name: 'token_hash' })
    tokenHash!: string;

    @Column({ name: 'expires_at' })
    expiresAt!: Date;

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;
}
