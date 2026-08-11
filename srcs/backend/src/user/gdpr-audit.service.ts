import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditAction, AuditLog } from './audit-log.entity';

@Injectable()
export class GdprAuditService {
    constructor(
        @InjectRepository(AuditLog)
        private readonly auditLogRepo: Repository<AuditLog>,
    ) {}

    logDataChanged(userId: number, ip: string | null = null) {
        return this.record(userId, 'data_changed', ip);
    }

    logDataExported(userId: number, ip: string | null = null) {
        return this.record(userId, 'data_exported', ip);
    }

    logAccountDeleted(userId: number, ip: string | null = null) {
        return this.record(userId, 'account_deleted', ip);
    }

    private async record(userId: number, action: AuditAction, ip: string | null): Promise<void> {
        await this.auditLogRepo.insert({ userId, action, ip });
    }
}
