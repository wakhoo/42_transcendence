import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

@Injectable()
export class JwtAuthGuard implements CanActivate {
    constructor(private readonly jwtService: JwtService) {}

    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest<Request>();
        const token = this.extractToken(request);
        if (!token) throw new UnauthorizedException('Missing token');
        try {
            const payload = this.jwtService.verify<{ sub: number; email: string }>(token);
            (request as Request & { user: unknown }).user = payload;
            return true;
        } catch {
            throw new UnauthorizedException('Invalid token');
        }
    }

    private extractToken(request: Request): string | null {
        const [type, token] = request.headers.authorization?.split(' ') ?? [];
        return type === 'Bearer' ? (token ?? null) : null;
    }
}
