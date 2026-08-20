import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('verification_codes')
export class VerificationCode {
    @PrimaryGeneratedColumn()
    id!: number;

    // Plain column, not a @ManyToOne: this table is a short-lived one-time-code
    // store, not a relation the rest of the domain should ever join against.
    @Column({ name: 'user_id' })
    userId!: number;

    @Column({ name: 'code_hash' })
    codeHash!: string;

    @Column({ name: 'expires_at', type: 'datetime' })
    expiresAt!: Date;

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;
}
