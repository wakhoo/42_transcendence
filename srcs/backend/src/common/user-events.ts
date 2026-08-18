import { EventEmitter } from 'events';

export type PublicUserProfile = {
    id: number;
    username: string;
    avatarUrl: string | null;
    profileColor: string;
};

// A lightweight in-process bus so UserService can announce new users without
// UserModule depending on ChatModule (which already depends on UserModule).
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
