import {
    ConflictException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditAction, Prisma } from '../../generated/prisma/client';
import { AuditService } from '../audit/audit.service';
import { CreateProductDto } from './dto/create-product.dto';
import { QueryProductsDto } from './dto/query-products.dto';
import { UpdateProductDto } from './dto/update-product.dto';

const slugify = (text: string) =>
    text
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

const withCreator = {
    createdBy: { select: { id: true, name: true, email: true } },
} satisfies Prisma.ProductInclude;

@Injectable()
export class ProductsService {
    private readonly logger = new Logger(ProductsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
    ) {}

    async findAll(query: QueryProductsDto) {
        const { page = 1, limit = 20, search, status } = query;

        const where: Prisma.ProductWhereInput = {
            ...(status && { status }),
            ...(search && {
                OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { sku: { contains: search, mode: 'insensitive' } },
                    { barcode: { contains: search } },
                ],
            }),
        };

        const [items, total] = await this.prisma.$transaction([
            this.prisma.product.findMany({
                where,
                include: withCreator,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.product.count({ where }),
        ]);

        return {
            items,
            meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
    }

    async findOne(id: string) {
        const product = await this.prisma.product.findUnique({
            where: { id },
            include: withCreator,
        });
        if (!product) throw new NotFoundException('Product not found');
        return product;
    }

    async create(dto: CreateProductDto, userId: string) {
        try {
            const product = await this.prisma.product.create({
                data: {
                    ...dto,
                    slug: dto.slug ?? slugify(dto.name),
                    createdById: userId,
                },
                include: withCreator,
            });

            await this.audit.log({
                action: AuditAction.CREATE,
                userId,
                entity: 'Product',
                entityId: product.id,
                changes: {
                    sku: product.sku,
                    name: product.name,
                    price: product.price.toString(),
                },
            });

            return product;
        } catch (e) {
            this.handleKnownErrors(e);
            throw e;
        }
    }

    async update(id: string, dto: UpdateProductDto, userId: string) {
        const before = await this.findOne(id);

        try {
            const updated = await this.prisma.product.update({
                where: { id },
                data: dto,
                include: withCreator,
            });

            await this.audit.log({
                action: AuditAction.UPDATE,
                userId,
                entity: 'Product',
                entityId: id,
                changes: {
                    before: {
                        sku: before.sku,
                        name: before.name,
                        price: before.price.toString(),
                        status: before.status,
                    },
                    after: { ...dto },
                } as Prisma.InputJsonObject,
            });

            return updated;
        } catch (e) {
            this.handleKnownErrors(e);
            throw e;
        }
    }

    async remove(id: string, userId: string) {
        const product = await this.findOne(id);

        try {
            await this.prisma.product.delete({ where: { id } });

            await this.audit.log({
                action: AuditAction.DELETE,
                userId,
                entity: 'Product',
                entityId: id,
                changes: {
                    sku: product.sku,
                    name: product.name,
                    price: product.price.toString(),
                },
            });

            return product;
        } catch (e) {
            this.handleKnownErrors(e);
            throw e;
        }
    }

    private handleKnownErrors(e: unknown) {
        if (e instanceof Prisma.PrismaClientKnownRequestError) {
            if (e.code === 'P2002') {
                throw new ConflictException(
                    'SKU, barcode, or slug already exists',
                );
            }
            if (e.code === 'P2025') {
                throw new NotFoundException('Product not found');
            }
        }
    }
}
