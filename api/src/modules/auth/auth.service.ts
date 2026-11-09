import {
    BadRequestException,
    Injectable,
    Logger,
    OnModuleInit,
    UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import type { RequestMeta } from '../../common/utils/request-meta.util';
import { PrismaService } from '../../database/prisma.service';
import { AuditAction, Role, UserStatus } from '../../generated/prisma/client';
import { AuditService } from '../audit/audit.service';
import { UsersService } from '../users/users.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService implements OnModuleInit {
    private readonly logger = new Logger(AuthService.name);

    // Compared against when the email doesn't exist, so response time doesn't reveal it
    private readonly dummyHash = bcrypt.hashSync(
        'not-a-real-password',
        BCRYPT_ROUNDS,
    );

    constructor(
        private readonly users: UsersService,
        private readonly jwt: JwtService,
        private readonly prisma: PrismaService,
        private readonly config: ConfigService,
        private readonly audit: AuditService,
    ) {}

    async onModuleInit() {
        const email = this.config.get<string>('ADMIN_EMAIL');
        const password = this.config.get<string>('ADMIN_PASSWORD');
        if (!email || !password) return;
        if ((await this.prisma.user.count()) > 0) return;

        if (password.length < 8 || password.length > 72) {
            this.logger.error(
                'ADMIN_PASSWORD must be 8-72 characters; admin not created',
            );
            return;
        }

        await this.users.create({
            email,
            password,
            name: 'Admin',
            role: Role.ADMIN,
        });
        this.logger.log(`Created initial admin: ${email}`);
    }

    async login(dto: LoginDto, meta: RequestMeta = {}) {
        const user = await this.users.findByEmail(dto.email);

        // Always run one bcrypt comparison, whether or not the user exists
        const passwordOk = await bcrypt.compare(
            dto.password,
            user?.passwordHash ?? this.dummyHash,
        );

        if (!user || !passwordOk || user.status !== UserStatus.ACTIVE) {
            await this.audit.log({
                action: AuditAction.LOGIN_FAILED,
                userId: user?.id,
                entity: 'User',
                entityId: user?.id,
                changes: { email: dto.email },
                ...meta,
            });
            throw new UnauthorizedException('Invalid email or password');
        }

        await this.audit.log({
            action: AuditAction.LOGIN,
            userId: user.id,
            entity: 'User',
            entityId: user.id,
            ...meta,
        });

        const accessToken = await this.jwt.signAsync({
            sub: user.id,
            email: user.email,
            role: user.role,
            tv: user.tokenVersion,
        });

        return {
            accessToken,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
            },
        };
    }

    // Bumping tokenVersion invalidates every token this user has, on all devices
    async logout(userId: string) {
        await this.prisma.user.update({
            where: { id: userId },
            data: { tokenVersion: { increment: 1 } },
        });
        return { message: 'Logged out' };
    }

    async changePassword(userId: string, dto: ChangePasswordDto) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });
        if (!user || user.status !== UserStatus.ACTIVE) {
            throw new UnauthorizedException();
        }

        const valid = await bcrypt.compare(
            dto.currentPassword,
            user.passwordHash,
        );
        if (!valid)
            throw new BadRequestException('Current password is incorrect');

        if (dto.currentPassword === dto.newPassword) {
            throw new BadRequestException('New password must be different');
        }

        await this.prisma.user.update({
            where: { id: userId },
            data: {
                passwordHash: await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS),
                tokenVersion: { increment: 1 },
            },
        });

        await this.audit.log({
            action: AuditAction.PASSWORD_CHANGE,
            userId,
            entity: 'User',
            entityId: userId,
        });

        return { message: 'Password updated. Please log in again.' };
    }
}
