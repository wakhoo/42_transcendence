import { IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class ExportDataDto {
    @IsOptional()
    @IsString()
    @MaxLength(128)
    password?: string;

    @IsOptional()
    @IsString()
    @Length(6, 6)
    code?: string;
}
