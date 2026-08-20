import { IsOptional, IsString, Length } from 'class-validator';

export class ExportDataDto {
    @IsOptional()
    @IsString()
    @Length(6, 6)
    code?: string;
}
