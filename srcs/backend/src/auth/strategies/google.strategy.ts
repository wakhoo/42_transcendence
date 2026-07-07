import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-google-oauth20';

export interface GoogleProfile {
    oauthId: string;
    email: string;
    displayName: string;
    avatarUrl: string | null;
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
    constructor(config: ConfigService) {
        super({
            clientID: config.getOrThrow('OAUTH_GOOGLE_CLIENT_ID'),
            clientSecret: config.getOrThrow('OAUTH_GOOGLE_CLIENT_SECRET'),
            callbackURL: `${config.getOrThrow('NESTAUTH_URL')}/api/auth/callback/google`,
            scope: ['email', 'profile'],
        });
    }

    validate(_accessToken: string, _refreshToken: string, profile: Profile): GoogleProfile {
        return {
            oauthId: profile.id,
            email: profile.emails?.[0]?.value ?? '',
            displayName: profile.displayName,
            avatarUrl: profile.photos?.[0]?.value ?? null,
        };
    }
}
