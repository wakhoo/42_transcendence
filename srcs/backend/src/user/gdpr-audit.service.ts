import { Injectable } from '@nestjs/common';

@Injectable()
export class GdprAuditService {
    logDataChanged(userId: number) {
        console.log(`[GDPR] Personal data update executed for user #${userId}`);
    }

    logDataExported(userId: number) {
        console.log(`[GDPR] Personal data export executed for user #${userId}`);
    }

    logAccountDeleted(userId: number) {
        console.log(`[GDPR] Account deletion executed for user #${userId}`);
    }
}
