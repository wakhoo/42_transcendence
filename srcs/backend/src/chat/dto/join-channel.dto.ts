import { IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class JoinChannelDto {
    @IsInt()
    channelId!: number;

    @IsString()
    @MaxLength(128)
    @IsOptional()
    password?: string;
}
