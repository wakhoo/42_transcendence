import { IsInt, Max, Min } from 'class-validator';

export class SetMaxMembersDto {
    @IsInt()
    channelId!: number;

    @IsInt()
    @Min(2)
    @Max(8)
    maxMembers!: number;
}
