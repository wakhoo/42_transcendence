import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import * as nodemailer from 'nodemailer';

const LOGO_CID = 'drawdraw-logo';

@Injectable()
export class MailService {
    private readonly logger = new Logger(MailService.name);
    private readonly transporter: nodemailer.Transporter;
    private readonly from: string;
    private readonly logo: Buffer;

    constructor(private readonly config: ConfigService) {
        const user = this.config.getOrThrow<string>('GMAIL_USER');
        const pass = this.config.getOrThrow<string>('GMAIL_APP_PASSWORD');

        this.from = `DrawDraw <${user}>`;
        this.transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user, pass },
        });
        this.logo = readFileSync(join(__dirname, 'assets', 'logo.png'));
    }

    private async send(to: string, subject: string, title: string, body: string): Promise<void> {
        try {
            await this.transporter.sendMail({
                from: this.from,
                to,
                subject: `[DrawDraw] ${subject}`,
                text: `${title}\n\n${body.replace(/<br\s*\/?>/gi, '\n')}`,
                html: this.renderTemplate(title, body),
                attachments: [
                    {
                        filename: 'logo.png',
                        content: this.logo,
                        cid: LOGO_CID,
                    },
                ],
            });
        } catch (err) {
            // Never let a mail-delivery failure block the GDPR action itself
            // (data change/export/erasure must still succeed even if the
            // notification email bounces or Gmail rejects the connection).
            this.logger.error(`Failed to send mail to ${to}: ${(err as Error).message}`);
        }
    }

    private renderTemplate(title: string, body: string): string {
        return `
<body style="margin:0;padding:32px 16px;background:#111827;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#1f2937;border:1px solid #374151;border-radius:16px;overflow:hidden;">
    <tr>
      <td style="padding:32px 32px 20px;text-align:center;">
        <img src="cid:${LOGO_CID}" width="56" height="68" alt="DrawDraw" style="display:block;margin:0 auto 10px;" />
        <div style="font-family:'Comic Sans MS','Chalkboard SE',cursive;font-size:26px;font-weight:900;color:#ffffff;">DrawDraw</div>
      </td>
    </tr>
    <tr>
      <td style="padding:0 32px;">
        <hr style="border:none;border-top:1px solid #374151;margin:0;" />
      </td>
    </tr>
    <tr>
      <td style="padding:24px 32px 8px;">
        <h1 style="margin:0 0 12px;color:#ffffff;font-size:18px;">${title}</h1>
        <p style="margin:0;color:#d1d5db;font-size:15px;line-height:1.6;">${body}</p>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 32px;background:#111827;color:#6b7280;font-size:12px;text-align:center;">
        This is an automated message from DrawDraw.<br>
        If you didn't request this, please contact support immediately.
      </td>
    </tr>
  </table>
</body>`;
    }

    sendProfileChangedEmail(to: string): Promise<void> {
        return this.send(
            to,
            'Your account information was changed',
            'Your account information was changed',
            'Your DrawDraw account information (email, username, or password) was just changed.<br><br>If this wasn\'t you, please reset your password and contact us immediately.',
        );
    }

    sendDataExportedEmail(to: string): Promise<void> {
        return this.send(
            to,
            'Your data export is ready',
            'Your data export is ready',
            'A copy of your DrawDraw account data was just exported, as requested under GDPR Article 20 (Right to Data Portability).<br><br>If you didn\'t request this, please contact us immediately.',
        );
    }

    sendAccountDeletedEmail(to: string): Promise<void> {
        return this.send(
            to,
            'Your account has been deleted',
            'Your account has been deleted',
            'Your DrawDraw account and associated data have been permanently deleted, in accordance with GDPR Article 17 (Right to Erasure).<br><br>If you didn\'t request this, please contact us immediately.',
        );
    }

    sendVerificationCodeEmail(to: string, code: string): Promise<void> {
        return this.send(
            to,
            'Your verification code',
            'Your verification code',
            `Use this code to confirm the change to your account:<br><br><b style="font-size:24px;letter-spacing:4px;">${code}</b><br><br>This code expires in 10 minutes. If you didn't request this, you can safely ignore this email.`,
        );
    }
}
