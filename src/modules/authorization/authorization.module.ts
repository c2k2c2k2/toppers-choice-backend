import { Module } from '@nestjs/common';
import { AdminAccessController } from './admin-access.controller';
import { AdminAuditLogsController } from './admin-audit-logs.controller';
import { AuditService } from './audit.service';
import { AuthorizationService } from './authorization.service';
import { PolicyGuard } from './policy.guard';
import { AuditInterceptor } from './interceptors/audit.interceptor';

@Module({
  controllers: [AdminAccessController, AdminAuditLogsController],
  providers: [
    AuthorizationService,
    AuditService,
    PolicyGuard,
    AuditInterceptor,
  ],
  exports: [AuthorizationService, AuditService, PolicyGuard, AuditInterceptor],
})
export class AuthorizationModule {}
