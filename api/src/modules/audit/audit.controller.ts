import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../generated/prisma/client';
import { AuditService } from './audit.service';
import { QueryAuditDto } from './dto/query-audit.dto';

@Roles(Role.ADMIN)
@Controller('audit-logs')
export class AuditController {
    constructor(private readonly auditService: AuditService) {}

    @Get()
    findAll(@Query() query: QueryAuditDto) {
        return this.auditService.findAll(query);
    }
}
