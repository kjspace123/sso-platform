import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@sso-platform/types';
import { paginationSchema, type PaginationInput } from '@sso-platform/validation';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import { AuditService } from '../audit/audit.service';

@ApiTags('admin/audit-logs')
@Controller('admin/audit-logs')
export class AdminAuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @RequirePermission(PERMISSIONS.AUDIT_READ)
  list(@Query(new ZodValidationPipe(paginationSchema)) query: PaginationInput) {
    return this.audit.list(query);
  }
}
