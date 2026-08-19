import { IsOptional, IsString, Length, MaxLength, MinLength } from 'class-validator';
import { IsNoInvisibleChars } from '../../common/validators/no-invisible-chars.validator';

export class ChangePasswordDto {
    @IsOptional()
    @IsString()
    @MaxLength(128)
    currentPassword?: string;

    @IsString()
    @MinLength(8)
    @MaxLength(128)
    @IsNoInvisibleChars()
    newPassword!: string;

    @IsOptional()
    @IsString()
    @Length(6, 6)
    code?: string;
}
