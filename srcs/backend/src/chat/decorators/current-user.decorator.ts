import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUser } from '../../auth/guards/jwt.guard';

export type { AuthenticatedUser };

export const CurrentUser = createParamDecorator(
    (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
        const request = ctx.switchToHttp().getRequest();
        return request.user as AuthenticatedUser;
    },
);
