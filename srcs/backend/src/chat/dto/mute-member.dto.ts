import { IsInt, IsUUID, Max, Min } from 'class-validator';

export class MuteMemberDto {
    @IsInt()
    channelId!: number;

    @IsUUID()
    targetUserId!: string;

    @IsInt()
    @Min(1)
    @Max(60)
    minutes!: number;
}
