import { IsOptional, IsString, Length } from 'class-validator';

export class SetupTotpDto {
    @IsOptional()
    @IsString()
    @Length(6, 6)
    code?: string;
}
