import { IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class EnableTotpDto {
    @IsString()
    @Length(6, 6)
    code!: string;

    @IsOptional()
    @IsString()
    @MaxLength(128)
    currentPassword?: string;

    @IsOptional()
    @IsString()
    @Length(6, 6)
    emailCode?: string;
}
