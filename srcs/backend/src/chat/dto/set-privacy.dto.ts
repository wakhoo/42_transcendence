import { IsBoolean, IsInt } from 'class-validator';

export class SetPrivacyDto {
    @IsInt()
    channelId!: number;

    @IsBoolean()
    isPrivate!: boolean;
}
