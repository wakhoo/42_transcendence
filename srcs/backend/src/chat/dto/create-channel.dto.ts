import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class CreateChannelDto {
    @IsString()
    @MinLength(2)
    @MaxLength(50)
    name!: string;

    @IsEnum(['general', 'game', 'dm'])
    @IsOptional()
    type?: 'general' | 'game' | 'dm';

    @IsBoolean()
    @IsOptional()
    isPrivate?: boolean;

    @IsString()
    @IsOptional()
    password?: string;

    @IsInt()
    @Min(2)
    @IsOptional()
    maxMembers?: number;
}
