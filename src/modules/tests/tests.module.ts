import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { PaymentsModule } from '../payments/payments.module';
import { AdminTestsController } from './admin-tests.controller';
import { TestsController } from './tests.controller';
import { TestsEntitlementService } from './tests.entitlement.service';
import { TestsService } from './tests.service';

@Module({
  imports: [AuthorizationModule, PaymentsModule],
  controllers: [AdminTestsController, TestsController],
  providers: [TestsEntitlementService, TestsService],
  exports: [TestsService],
})
export class TestsModule {}
