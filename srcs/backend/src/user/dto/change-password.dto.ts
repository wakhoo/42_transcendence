import { IsOptional, IsString, Length, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
    @IsOptional()
    @IsString()
    currentPassword?: string;

    @IsString()
    @MinLength(8)
    @MaxLength(128)
    newPassword!: string;

    @IsOptional()
    @IsString()
    @Length(6, 6)
    code?: string;
}
