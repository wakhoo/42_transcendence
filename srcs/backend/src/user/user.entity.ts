import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from "typeorm";

@Entity("users")
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  email!: string;

  @Column({ length: 20, unique: true })
  username!: string;

  @Column({
    name: "password_hash",
    type: "varchar",
    length: 60,
    nullable: true,
  })
  passwordHash: string | null = null;

<<<<<<< HEAD
  @CreateDateColumn()
  createdAt!: Date;
=======
    @CreateDateColumn()
    createdAt!: Date;
>>>>>>> dancel
}
