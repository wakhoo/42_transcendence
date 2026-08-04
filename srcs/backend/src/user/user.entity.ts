import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Exclude } from "class-transformer";

@Entity("users")
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  email!: string;

  @Column({ length: 20, unique: true })
  username!: string;

  @Exclude()
  @Column({
    name: "password_hash",
    type: "varchar",
    length: 60,
    nullable: true,
  })
  passwordHash: string | null = null;

  @Column({ name: 'avatar_url', type: 'varchar', length: 500, nullable: true })
  avatarUrl: string | null = null;

  @Column({ name: 'profile_color', type: 'varchar', length: 7, default: '#6366f1' })
  profileColor: string = '#6366f1';

  @Column({ name: 'oauth_provider', type: 'varchar', length: 20, nullable: true })
  oauthProvider: string | null = null;

  @Column({ name: 'oauth_id', type: 'varchar', length: 255, nullable: true })
  oauthId: string | null = null;

  @Exclude()
  @Column({ name: 'totp_secret', type: 'varchar', length: 255, nullable: true })
  totpSecret: string | null = null;

  @Column({ name: 'totp_enabled', type: 'boolean', default: false })
  totpEnabled: boolean = false;

  @CreateDateColumn()
  createdAt!: Date;
}
