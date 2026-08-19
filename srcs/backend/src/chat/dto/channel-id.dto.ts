import { IsInt } from 'class-validator';

export class ChannelIdDto {
    @IsInt()
    channelId!: number;
}
