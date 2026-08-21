import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type AuditAction = 'data_changed' | 'data_exported' | 'account_deleted';

@Entity('audit_logs')
export class AuditLog {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ name: 'user_id' })
    userId!: number;

    @Column({ type: 'enum', enum: ['data_changed', 'data_exported', 'account_deleted'] })
    action!: AuditAction;

    @Column({ type: 'varchar', length: 45, nullable: true })
    ip: string | null = null;

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;
}
