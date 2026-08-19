import { IsInt, IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateRoomDto {
    @IsString()
    @MinLength(2)
    @MaxLength(50)
    @Matches(/\S/)
    name!: string;
}

export class ChannelIdDto {
    @IsInt()
    channelId!: number;
}

export class DrawDto {
    @IsInt()
    channelId!: number;

    @IsNotEmpty()
    drawData: any;
}
