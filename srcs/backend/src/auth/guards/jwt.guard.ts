import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { UserService } from '../../user/user.service';

export interface JwtPayload {
    sub: string;
    pending2fa?: boolean;
}

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
