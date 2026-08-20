import { ArgumentsHost, Catch, ConflictException, ExceptionFilter } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

const ER_DUP_ENTRY = 1062;

@Catch(QueryFailedError)
export class QueryFailedFilter implements ExceptionFilter {
    catch(exception: QueryFailedError, host: ArgumentsHost) {
        const driverError = exception.driverError as { errno?: number };

        if (driverError?.errno === ER_DUP_ENTRY) {
            const conflict = new ConflictException('Resource already exists');
            const response = host.switchToHttp().getResponse();
            response.status(conflict.getStatus()).json(conflict.getResponse());
            return;
        }

        throw exception;
    }
}
