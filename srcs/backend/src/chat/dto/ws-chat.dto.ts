import { IsInt, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';

export class JoinChannelDto {
    @IsInt()
    channelId!: number;

    @IsString()
    @MaxLength(128)
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
    @Matches(/\S/)
    content!: string;
}

export class SendDmDto {
    @IsUUID()
    targetUserId!: string;

    @IsString()
    @MinLength(1)
    @MaxLength(2000)
    @Matches(/\S/)
    content!: string;
}
