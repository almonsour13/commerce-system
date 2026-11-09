import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditAction, Prisma } from '../../generated/prisma/client';
import { QueryAuditDto } from './dto/query-audit.dto';

export interface AuditEntry {
    action: AuditAction;
    userId?: string | null;
    entity?: string;
    entityId?: string;
    changes?: Prisma.InputJsonValue;
    ipAddress?: string;
    userAgent?: string;
}

@Injectable()
export class AuditService {
    private readonly logger = new Logger(AuditService.name);

    constructor(private readonly prisma: PrismaService) {}

    // Never throws: a failed audit write must not break the real request
    async log(entry: AuditEntry): Promise<void> {
        try {
            await this.prisma.auditLog.create({
                data: {
                    action: entry.action,
                    userId: entry.userId ?? null,
                    entity: entry.entity,
                    entityId: entry.entityId,
                    changes: entry.changes,
                    ipAddress: entry.ipAddress,
                    userAgent: entry.userAgent,
                },
            });
        } catch (e) {
            this.logger.error(`Failed to write audit log: ${String(e)}`);
        }
    }

    async findAll(query: QueryAuditDto) {
        const {
            page = 1,
            limit = 20,
            userId,
            action,
            entity,
            entityId,
        } = query;

        const where: Prisma.AuditLogWhereInput = {
            ...(userId && { userId }),
            ...(action && { action }),
            ...(entity && { entity }),
            ...(entityId && { entityId }),
        };

        const [items, total] = await this.prisma.$transaction([
            this.prisma.auditLog.findMany({
                where,
                include: {
                    user: { select: { id: true, name: true, email: true } },
                },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.auditLog.count({ where }),
        ]);

        return {
            items,
            meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
    }
}
