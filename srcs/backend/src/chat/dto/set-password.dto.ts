import { IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class SetPasswordDto {
    @IsInt()
    channelId!: number;

    @IsString()
    @MaxLength(128)
    @IsOptional()
    oldPassword?: string;

    @IsString()
    @MaxLength(128)
    @IsOptional()
    password?: string;
}
