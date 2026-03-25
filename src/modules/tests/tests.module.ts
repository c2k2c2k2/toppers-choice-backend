import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { AdminTestsController } from './admin-tests.controller';
import { TestsController } from './tests.controller';
import { TestsEntitlementService } from './tests.entitlement.service';
import { TestsService } from './tests.service';

@Module({
  imports: [AuthorizationModule],
  controllers: [AdminTestsController, TestsController],
  providers: [TestsEntitlementService, TestsService],
  exports: [TestsService],
})
export class TestsModule {}
