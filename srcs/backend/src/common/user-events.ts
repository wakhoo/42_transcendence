import { EventEmitter } from 'events';

export type PublicUserProfile = {
    publicId: string;
    username: string;
    avatarUrl: string | null;
    profileColor: string;
};

export const userEvents = new EventEmitter();

export function emitUserCreated(profile: PublicUserProfile): void {
    userEvents.emit('userCreated', profile);
}

export function onUserCreated(handler: (profile: PublicUserProfile) => void): void {
    userEvents.on('userCreated', handler);
}

export function emitUserUpdated(profile: PublicUserProfile): void {
    userEvents.emit('userUpdated', profile);
}

export function onUserUpdated(handler: (profile: PublicUserProfile) => void): void {
    userEvents.on('userUpdated', handler);
}

export function emitUserDeleted(userId: number): void {
    userEvents.emit('userDeleted', userId);
}

export function onUserDeleted(handler: (userId: number) => void): void {
    userEvents.on('userDeleted', handler);
}
