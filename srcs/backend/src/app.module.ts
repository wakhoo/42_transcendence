import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { HealthController } from "./health/health.controller";
import { AuthModule } from "./auth/auth.module";
import { UserModule } from "./user/user.module";
import { User } from "./user/user.entity";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({ //ouvre connexion MariaDB et sync les tables
      inject: [ConfigService], //lire le .env
      useFactory: (config: ConfigService) => ({ //construction de la config
        type: "mysql",
        host: config.getOrThrow("MARIADB_HOST"),
        port: config.get<number>("MARIADB_PORT", 3306),
        username: config.getOrThrow("MARIADB_USER"),
        password: config.getOrThrow("MARIADB_PASSWORD"),
        database: config.getOrThrow("MARIADB_DATABASE"),
        entities: [User],
        synchronize: true,
      }),
    }),
    AuthModule, 
    UserModule,
  ],
  controllers: [HealthController],//GET /api/health dans le routeur HTTP
  providers: [],
})
export class AppModule {}
