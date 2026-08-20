import { IsInt, IsNotEmpty, IsString, Matches, MaxLength, MinLength, IsNumber, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

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

export class DrawDataPlayloadDto {

    @IsNumber()
    prevX!: number;

    @IsNumber()
    prevY!: number;

    @IsNumber()
    currentX!: number;

    @IsNumber()
    currentY!: number;

    @IsString()
    @MaxLength(30)
    color!: string;

    @IsNumber()
    lineWidth!: number;

}

export class DrawDto {
    @IsInt()
    channelId!: number;

    @IsNotEmpty()
    @ValidateNested()
    @Type(() => DrawDataPlayloadDto)
    drawData!: DrawDataPlayloadDto;
}
