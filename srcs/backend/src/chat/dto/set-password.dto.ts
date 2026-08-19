import { IsInt, IsOptional, IsString } from 'class-validator';

export class SetPasswordDto {
    @IsInt()
    channelId!: number;

    @IsString()
    @IsOptional()
    password!: string | null;
}
