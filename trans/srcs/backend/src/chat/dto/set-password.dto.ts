import { IsOptional, IsString } from 'class-validator';

export class SetPasswordDto {
    @IsString()
    @IsOptional()
    password!: string | null;
}
