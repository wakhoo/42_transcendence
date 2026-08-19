import { IsBoolean, IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class DeleteAccountDto {
    @IsBoolean()
    confirm!: boolean;

    @IsOptional()
    @IsString()
    @MaxLength(128)
    password?: string;

    @IsOptional()
    @IsString()
    @Length(6, 6)
    code?: string;
}
