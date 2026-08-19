import { IsInt, IsOptional, IsString } from 'class-validator';

export class JoinChannelDto {
    @IsInt()
    channelId!: number;

    @IsString()
    @IsOptional()
    password?: string;
}
