import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import type { AuthUser } from '../../common/types/auth-user.type';
import { PrismaService } from '../../database/prisma.service';
import { AuditAction, Prisma } from '../../generated/prisma/client';
import { Role, UserStatus } from '../../generated/prisma/enums';
import { AuditService } from '../audit/audit.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const BCRYPT_ROUNDS = 12;

const safeUser = {
    id: true,
    email: true,
    name: true,
    role: true,
    status: true,
    createdById: true,
    createdAt: true,
    updatedAt: true,
} satisfies Prisma.UserSelect;

// Roles a manager is allowed to create
const MANAGER_CAN_CREATE: Role[] = [Role.CASHIER, Role.INVENTORY_STAFF];

@Injectable()
export class UsersService {
    private readonly logger = new Logger(UsersService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
    ) {}

    findAll() {
        return this.prisma.user.findMany({
            select: safeUser,
            orderBy: { createdAt: 'desc' },
        });
    }

    async findOne(id: string) {
        const user = await this.prisma.user.findUnique({
            where: { id },
            select: safeUser,
        });
        if (!user) throw new NotFoundException('User not found');
        return user;
    }

    // For the auth module: includes passwordHash, never expose this over HTTP.
    // Auth must also reject users whose status is not ACTIVE.
    findByEmail(email: string) {
        return this.prisma.user.findUnique({
            where: { email: email.toLowerCase().trim() },
        });
    }

    // Used by the controller: enforces who may create which role
    createByStaff(dto: CreateUserDto, actor: AuthUser) {
        if (actor.role === Role.MANAGER) {
            const requested = dto.role ?? Role.CASHIER;
            if (!MANAGER_CAN_CREATE.includes(requested)) {
                throw new ForbiddenException(
                    'Managers can only create cashier or inventory staff accounts',
                );
            }
        }
        return this.create(dto, actor.id);
    }

    // No permission check here: used by the admin bootstrap and createByStaff
    async create(dto: CreateUserDto, actorId?: string) {
        const { password, email, ...rest } = dto;
        const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
        try {
            const created = await this.prisma.user.create({
                data: {
                    ...rest,
                    email: email.toLowerCase().trim(),
                    passwordHash,
                    createdById: actorId,
                },
                select: safeUser,
            });

            await this.audit.log({
                action: AuditAction.CREATE,
                userId: actorId,
                entity: 'User',
                entityId: created.id,
                changes: { email: created.email, role: created.role },
            });

            return created;
        } catch (e) {
            this.handleKnownErrors(e);
            throw e;
        }
    }

    async update(id: string, dto: UpdateUserDto, actorId: string) {
        const { password, email, ...rest } = dto;

        // An admin must not lock themselves out or demote themselves
        if (id === actorId) {
            if (dto.status === UserStatus.INACTIVE) {
                throw new BadRequestException(
                    'You cannot deactivate your own account',
                );
            }
            if (dto.role && dto.role !== Role.ADMIN) {
                throw new BadRequestException(
                    'You cannot change your own role',
                );
            }
        }

        const data: Prisma.UserUpdateInput = { ...rest };
        if (email) data.email = email.toLowerCase().trim();

        // End existing sessions when credentials, role, or status change
        if (password) {
            data.passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
        }
        if (password || dto.role || dto.status === UserStatus.INACTIVE) {
            data.tokenVersion = { increment: 1 };
        }

        try {
            const updated = await this.prisma.user.update({
                where: { id },
                data,
                select: safeUser,
            });

            await this.audit.log({
                action: AuditAction.UPDATE,
                userId: actorId,
                entity: 'User',
                entityId: id,
                changes: {
                    ...rest,
                    ...(email && { email: data.email as string }),
                    passwordChanged: !!password,
                } as Prisma.InputJsonObject,
            });

            return updated;
        } catch (e) {
            this.handleKnownErrors(e);
            throw e;
        }
    }

    // Deactivate instead of delete: sales will reference the cashier who made them
    async deactivate(id: string, actorId: string) {
        if (id === actorId) {
            throw new BadRequestException(
                'You cannot deactivate your own account',
            );
        }
        try {
            const user = await this.prisma.user.update({
                where: { id },
                data: {
                    status: UserStatus.INACTIVE,
                    tokenVersion: { increment: 1 },
                },
                select: safeUser,
            });

            await this.audit.log({
                action: AuditAction.UPDATE,
                userId: actorId,
                entity: 'User',
                entityId: id,
                changes: { status: UserStatus.INACTIVE },
            });

            return user;
        } catch (e) {
            this.handleKnownErrors(e);
            throw e;
        }
    }

    private handleKnownErrors(e: unknown) {
        if (e instanceof Prisma.PrismaClientKnownRequestError) {
            if (e.code === 'P2002')
                throw new ConflictException('Email already exists');
            if (e.code === 'P2025')
                throw new NotFoundException('User not found');
        }
    }
}
