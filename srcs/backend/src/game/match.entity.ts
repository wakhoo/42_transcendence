import { Entity, PrimaryGeneratedColumn, Column , CreateDateColumn } from 'typeorm';

@Entity('match')
export class Match {

	@PrimaryGeneratedColumn()
	id!: number;

	@Column()
	channelId!: number;

	@Column('simple-json')
	scores!: Record<number, number>;

	@CreateDateColumn()
	createdAt!: Date;

}
