import { Module } from '@nestjs/common';
import { IdempotencyModule } from '../../infra/idempotency/idempotency.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { SiteSettingsModule } from '../site-settings/site-settings.module';
import { AdminEntitlementsController } from './admin-entitlements.controller';
import { AdminPaymentsController } from './admin-payments.controller';
import { AdminPlansController } from './admin-plans.controller';
import { EntitlementsController } from './entitlements.controller';
import { EntitlementsService } from './entitlements.service';
import { PaymentGatewayService } from './payment-gateway.service';
import { PaymentSettingsService } from './payment-settings.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PlansService } from './plans.service';
import { PublicPlansController } from './public-plans.controller';
import { PhonePePaymentProviderService } from './providers/phonepe-payment-provider.service';

@Module({
  imports: [AuthorizationModule, SiteSettingsModule, IdempotencyModule],
  controllers: [
    PublicPlansController,
    AdminPlansController,
    EntitlementsController,
    AdminEntitlementsController,
    PaymentsController,
    AdminPaymentsController,
  ],
  providers: [
    PlansService,
    EntitlementsService,
    PaymentSettingsService,
    PaymentGatewayService,
    PhonePePaymentProviderService,
    PaymentsService,
  ],
  exports: [EntitlementsService, PlansService, PaymentsService],
})
export class PaymentsModule {}
