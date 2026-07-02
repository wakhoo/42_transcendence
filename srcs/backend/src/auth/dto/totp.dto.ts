import { IsString, Length } from 'class-validator';

export class TotpDto {
    @IsString()
    @Length(6, 6)
    code!: string;
}
