import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { UserService } from '../../user/user.service';
import { AuthenticatedUser, JwtPayload } from './jwt.guard';

@Injectable()
export class Pending2faGuard implements CanActivate {
    constructor(
        private readonly jwtService: JwtService,
        private readonly userService: UserService,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<Request>();
        const token = this.extractToken(request);
        if (!token) throw new UnauthorizedException('Missing token');

        try {
            const payload = this.jwtService.verify<JwtPayload>(token);
            if (!payload.pending2fa) throw new UnauthorizedException('Invalid token type');

            const user = await this.userService.findByPublicId(payload.sub);
            if (!user) throw new UnauthorizedException('User no longer exists');

            request.user = { id: user.id, publicId: user.publicId } satisfies AuthenticatedUser;
            return true;
        } catch {
            throw new UnauthorizedException('Invalid or expired token');
        }
    }

    private extractToken(request: Request): string | null {
        const [type, token] = request.headers.authorization?.split(' ') ?? [];
        return type === 'Bearer' ? token : null;
    }
}
