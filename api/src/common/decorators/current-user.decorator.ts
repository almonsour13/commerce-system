// common/decorators/current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthUser } from '../types/auth-user.type';

export const CurrentUser = createParamDecorator(
    (field: keyof AuthUser | undefined, ctx: ExecutionContext) => {
        const user = ctx.switchToHttp().getRequest().user as
            AuthUser | undefined;
        return field ? user?.[field] : user;
    },
);
