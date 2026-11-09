import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { type AuthUser } from '../../common/types/auth-user.type';
import { Role } from '../../generated/prisma/enums';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@Roles(Role.ADMIN)
@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) {}

    @Get()
    findAll() {
        return this.usersService.findAll();
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.usersService.findOne(id);
    }

    @Roles(Role.ADMIN, Role.MANAGER)
    @Post()
    create(@Body() dto: CreateUserDto, @CurrentUser() actor: AuthUser) {
        return this.usersService.createByStaff(dto, actor);
    }

    @Roles(Role.ADMIN)
    @Patch(':id')
    update(
        @Param('id') id: string,
        @Body() dto: UpdateUserDto,
        @CurrentUser() actor: AuthUser,
    ) {
        return this.usersService.update(id, dto, actor.id);
    }

    @Roles(Role.ADMIN)
    @Delete(':id')
    deactivate(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
        return this.usersService.deactivate(id, actor.id);
    }
}
