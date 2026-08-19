import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateGameRoomDto {
    @IsOptional()
    @IsString()
    @MinLength(2)
    @MaxLength(50)
    name?: string;

    @IsOptional()
    @IsBoolean()
    isPrivate?: boolean;

    @IsOptional()
    @IsInt()
    @Min(2)
    @Max(8)
    maxMembers?: number;

    @IsOptional()
    @IsString()
    @MaxLength(50)
    password?: string;

    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(10)
    rounds?: number;
}
