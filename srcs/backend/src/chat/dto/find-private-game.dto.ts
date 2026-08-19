import { IsString, MaxLength, MinLength } from 'class-validator';

export class FindPrivateGameDto {
    @IsString()
    @MinLength(1)
    @MaxLength(20)
    code!: string;
}
