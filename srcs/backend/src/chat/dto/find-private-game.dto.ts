import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class FindPrivateGameDto {
    @IsString()
    @MinLength(1)
    @MaxLength(20)
    @Matches(/\S/)
    code!: string;
}
