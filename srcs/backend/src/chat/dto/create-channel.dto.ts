import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Matches, MaxLength, Min, Max, MinLength } from 'class-validator';

export class CreateChannelDto {
    @IsString()
    @MinLength(2)
    @MaxLength(50)
    @Matches(/\S/)
    name!: string;

    @IsEnum(['general', 'game', 'dm'])
    @IsOptional()
    type?: 'general' | 'game' | 'dm';

    @IsBoolean()
    @IsOptional()
    isPrivate?: boolean;

    @IsString()
    @MaxLength(128)
    @IsOptional()
    password?: string;

    @IsInt()
    @Min(2)
    @Max(8)
    @IsOptional()
    maxMembers?: number;
}
