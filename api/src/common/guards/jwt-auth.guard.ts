import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { PrismaService } from '../../database/prisma.service';
import { UserStatus } from '../../generated/prisma/enums';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { AuthUser } from '../types/auth-user.type';

@Injectable()
export class JwtAuthGuard implements CanActivate {
    constructor(
        private readonly jwt: JwtService,
        private readonly reflector: Reflector,
        private readonly prisma: PrismaService,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const isPublic = this.reflector.getAllAndOverride<boolean>(
            IS_PUBLIC_KEY,
            [context.getHandler(), context.getClass()],
        );
        if (isPublic) return true;

        const req = context
            .switchToHttp()
            .getRequest<Request & { user?: AuthUser }>();
        const [type, token] = req.headers.authorization?.split(' ') ?? [];
        if (type?.toLowerCase() !== 'bearer' || !token) {
            throw new UnauthorizedException('Missing token');
        }

        let payload: { sub: string; tv?: number };
        try {
            payload = await this.jwt.verifyAsync<{ sub: string; tv?: number }>(
                token,
            );
        } catch {
            throw new UnauthorizedException('Invalid or expired token');
        }

        // Look the user up on every request so deactivated staff lose access immediately
        const user = await this.prisma.user.findUnique({
            where: { id: payload.sub },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                status: true,
                tokenVersion: true, // new
            },
        });
        if (
            !user ||
            user.status !== UserStatus.ACTIVE ||
            payload.tv !== user.tokenVersion // new
        ) {
            throw new UnauthorizedException('Account is not active');
        }

        req.user = {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
        };
        return true;
    }
}
