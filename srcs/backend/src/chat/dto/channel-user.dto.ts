import { IsInt, IsUUID } from 'class-validator';

export class ChannelUserDto {
    @IsInt()
    channelId!: number;

    @IsUUID()
    userId!: string;
}
