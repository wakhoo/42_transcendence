import { IsInt, Min } from 'class-validator';

export class MuteMemberDto {
    @IsInt()
    @Min(0)
    minutes!: number;
}
