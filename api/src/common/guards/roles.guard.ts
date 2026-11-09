import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '../../generated/prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { AuthUser } from '../types/auth-user.type';

@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private readonly reflector: Reflector) {}

    canActivate(context: ExecutionContext): boolean {
        const roles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (!roles?.length) return true; // no @Roles(): any logged-in user

        const { user } = context
            .switchToHttp()
            .getRequest<{ user?: AuthUser }>();
        if (!user || !roles.includes(user.role)) {
            throw new ForbiddenException(
                'You do not have permission to do this',
            );
        }
        return true;
    }
}
