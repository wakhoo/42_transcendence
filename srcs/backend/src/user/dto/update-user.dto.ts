import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const AVATAR_PATHS = Array.from({ length: 20 }, (_, i) => `/avatars/avatar${i + 1}.png`);

export class UpdateUserDto {
    @IsOptional()
    @IsEmail()
    email?: string;

    @IsOptional()
    @IsString()
    @MinLength(3)
    @MaxLength(20)
    username?: string;

    @IsOptional()
    @IsIn(AVATAR_PATHS)
    avatarUrl?: string;

}
