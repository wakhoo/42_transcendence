import { IsInt, Max, Min } from 'class-validator';

export class MuteMemberDto {
    @IsInt()
    channelId!: number;

    @IsInt()
    targetUserId!: number;

    @IsInt()
    @Min(1)
    @Max(60)
    minutes!: number;
}
