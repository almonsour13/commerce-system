import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    Query,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthUser } from '../../common/types/auth-user.type';
import { Role } from '../../generated/prisma/client';
import { CreateProductDto } from './dto/create-product.dto';
import { QueryProductsDto } from './dto/query-products.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
    constructor(private readonly productsService: ProductsService) {}

    @Get()
    findAll(@Query() query: QueryProductsDto) {
        return this.productsService.findAll(query);
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.productsService.findOne(id);
    }

    @Roles(Role.ADMIN, Role.MANAGER)
    @Post()
    create(@Body() dto: CreateProductDto, @CurrentUser() user: AuthUser) {
        return this.productsService.create(dto, user.id);
    }

    @Roles(Role.ADMIN, Role.MANAGER)
    @Patch(':id')
    update(
        @Param('id') id: string,
        @Body() dto: UpdateProductDto,
        @CurrentUser() user: AuthUser,
    ) {
        return this.productsService.update(id, dto, user.id);
    }

    @Roles(Role.ADMIN, Role.MANAGER)
    @Delete(':id')
    remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
        return this.productsService.remove(id, user.id);
    }
}
