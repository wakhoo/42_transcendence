import { IsEmail, IsIn, IsOptional, IsString, Length, MaxLength, MinLength } from 'class-validator';
import { IsNoInvisibleChars } from '../../common/validators/no-invisible-chars.validator';

const AVATAR_PATHS = Array.from({ length: 20 }, (_, i) => `/avatars/avatar${i + 1}.png`);

export class UpdateUserDto {
    @IsOptional()
    @IsEmail()
    @IsNoInvisibleChars()
    email?: string;

    @IsOptional()
    @IsString()
    @MinLength(3)
    @MaxLength(20)
    @IsNoInvisibleChars()
    username?: string;

    @IsOptional()
    @IsIn(AVATAR_PATHS)
    avatarUrl?: string;

    @IsOptional()
    @IsString()
    @Length(6, 6)
    code?: string;

    @IsOptional()
    @IsString()
    @MaxLength(128)
    currentPassword?: string;

}
