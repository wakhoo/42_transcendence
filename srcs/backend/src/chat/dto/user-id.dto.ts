import { IsInt } from 'class-validator';

export class UserIdDto {
    @IsInt()
    userId!: number;
}
