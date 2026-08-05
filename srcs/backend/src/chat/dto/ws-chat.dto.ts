import { IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class JoinChannelDto {
    @IsInt()
    channelId!: number;

    @IsString()
    @IsOptional()
    password?: string;
}

export class ChannelIdDto {
    @IsInt()
    channelId!: number;
}

export class SendMessageDto {
    @IsInt()
    channelId!: number;

    @IsString()
    @MinLength(1)
    @MaxLength(2000)
    content!: string;
}

export class SendDmDto {
    @IsInt()
    targetUserId!: number;

    @IsString()
    @MinLength(1)
    @MaxLength(2000)
    content!: string;
}
