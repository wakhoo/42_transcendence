import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('words')
export class Word {

	@PrimaryGeneratedColumn()
	id!: number;

	@Column({ unique: true })
	content!: string;
}