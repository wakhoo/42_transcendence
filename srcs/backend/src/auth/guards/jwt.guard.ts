import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { UserService } from '../../user/user.service';

// The token subject is the user's public UUID, not the internal numeric id or
// email — the JWT itself should carry no more identity than necessary.
export interface JwtPayload {
    sub: string;
    pending2fa?: boolean;
}

// What guards attach to the request after resolving the token subject against the DB.
export interface AuthenticatedUser {
    id: number;
    publicId: string;
}

@Injectable()
export class JwtGuard implements CanActivate {
    constructor(
        private readonly jwtService: JwtService,
        private readonly userService: UserService,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<Request>();
        const token = this.extractToken(request);
        if (!token) throw new UnauthorizedException('Missing token');

        let payload: JwtPayload;
        try {
            payload = this.jwtService.verify<JwtPayload>(token);
        } catch {
            throw new UnauthorizedException('Invalid or expired token');
        }
        if (payload.pending2fa) throw new UnauthorizedException('2FA verification required');

        // A signature check alone accepts tokens for users deleted after the token was
        // issued (e.g. DB reset while the access token is still within its TTL), so the
        // subject must still exist.
        const user = await this.userService.findByPublicId(payload.sub);
        if (!user) throw new UnauthorizedException('User no longer exists');

        request.user = { id: user.id, publicId: user.publicId } satisfies AuthenticatedUser;
        return true;
    }

    private extractToken(request: Request): string | null {
        const [type, token] = request.headers.authorization?.split(' ') ?? [];
        return type === 'Bearer' ? token : null;
    }
}
