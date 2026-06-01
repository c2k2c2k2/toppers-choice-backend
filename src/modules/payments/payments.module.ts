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
import { PublicTrialPolicyController } from './public-trial-policy.controller';
import { HdfcSmartGatewayPaymentProviderService } from './providers/hdfc-smartgateway-payment-provider.service';
import { PhonePePaymentProviderService } from './providers/phonepe-payment-provider.service';
import { TrialAccessController } from './trial-access.controller';
import { TrialAccessService } from './trial-access.service';

@Module({
  imports: [AuthorizationModule, SiteSettingsModule, IdempotencyModule],
  controllers: [
    PublicPlansController,
    PublicTrialPolicyController,
    AdminPlansController,
    EntitlementsController,
    AdminEntitlementsController,
    PaymentsController,
    AdminPaymentsController,
    TrialAccessController,
  ],
  providers: [
    PlansService,
    TrialAccessService,
    EntitlementsService,
    PaymentSettingsService,
    PaymentGatewayService,
    HdfcSmartGatewayPaymentProviderService,
    PhonePePaymentProviderService,
    PaymentsService,
  ],
  exports: [EntitlementsService, PlansService, PaymentsService, TrialAccessService],
})
export class PaymentsModule {}
