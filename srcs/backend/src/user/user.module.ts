import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { TypeOrmModule } from "@nestjs/typeorm";
import { JwtGuard } from "../auth/guards/jwt.guard";
import { SessionModule } from "../auth/session.module";
import { User } from "./user.entity";
import { Message } from "../chat/entities/message.entity";
import { AuditLog } from "./audit-log.entity";
import { UserController } from "./user.controller";
import { UserService } from "./user.service";
import { GdprAuditService } from "./gdpr-audit.service";
import { MailModule } from "../mail/mail.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Message, AuditLog]),
    MailModule,
    SessionModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>("JWT_SECRET"),
      }),
    }),
  ],
  controllers: [UserController],
  providers: [UserService, JwtGuard, GdprAuditService],
  exports: [UserService],
})
export class UserModule {}
