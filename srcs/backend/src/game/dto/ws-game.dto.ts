import { IsInt, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateRoomDto {
    @IsString()
    @MinLength(2)
    @MaxLength(50)
    name!: string;
}

export class ChannelIdDto {
    @IsInt()
    channelId!: number;
}

export class DrawDto {
    @IsInt()
    channelId!: number;

    drawData: any;
}
