import { IsInt } from 'class-validator';

export class ChannelUserDto {
    @IsInt()
    channelId!: number;

    @IsInt()
    userId!: number;
}
