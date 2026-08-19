import { IsInt, Min } from 'class-validator';

export class MuteMemberDto {
    @IsInt()
    channelId!: number;

    @IsInt()
    targetUserId!: number;

    @IsInt()
    @Min(0)
    minutes!: number;
}
