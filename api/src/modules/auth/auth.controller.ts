import {
    Body,
    Controller,
    Get,
    HttpCode,
    Patch,
    Post,
    Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import type { AuthUser } from '../../common/types/auth-user.type';
import { getRequestMeta } from '../../common/utils/request-meta.util';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Public()
    @Post('login')
    @HttpCode(200)
    login(@Body() dto: LoginDto, @Req() req: Request) {
        return this.authService.login(dto, getRequestMeta(req));
    }

    @Post('logout')
    @HttpCode(200)
    logout(@CurrentUser('id') userId: string) {
        return this.authService.logout(userId);
    }

    @Get('me')
    me(@CurrentUser() user: AuthUser) {
        return user;
    }

    @Patch('change-password')
    changePassword(
        @CurrentUser() user: AuthUser,
        @Body() dto: ChangePasswordDto,
    ) {
        return this.authService.changePassword(user.id, dto);
    }
}
