import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('bad_words')
export class BadWord {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ unique: true })
    word!: string;
}
