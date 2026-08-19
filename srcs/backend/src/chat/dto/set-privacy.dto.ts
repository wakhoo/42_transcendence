import { IsBoolean } from 'class-validator';

export class SetPrivacyDto {
    @IsBoolean()
    isPrivate!: boolean;
}
