import { IsInt } from 'class-validator';

export class FriendshipIdDto {
    @IsInt()
    friendshipId!: number;
}
