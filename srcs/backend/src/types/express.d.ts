import { JwtPayload } from '../auth/guards/jwt.guard';

declare global {
    namespace Express {
        interface Request {
            user?: JwtPayload;
        }
    }
}
