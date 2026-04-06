import { Injectable } from '@nestjs/common';
import { PaymentProvider } from '@prisma/client';
import type {
  PaymentProviderCheckoutInput,
  ProviderCallbackPayload,
  ProviderCheckoutResult,
  ProviderStatusResult,
} from './payments.types';
import { HdfcSmartGatewayPaymentProviderService } from './providers/hdfc-smartgateway-payment-provider.service';
import { PhonePePaymentProviderService } from './providers/phonepe-payment-provider.service';

@Injectable()
export class PaymentGatewayService {
  constructor(
    private readonly hdfcSmartGatewayPaymentProviderService: HdfcSmartGatewayPaymentProviderService,
    private readonly phonePePaymentProviderService: PhonePePaymentProviderService,
  ) {}

  async initiateCheckout(
    provider: PaymentProvider,
    input: PaymentProviderCheckoutInput,
  ): Promise<ProviderCheckoutResult> {
    return this.getAdapter(provider).initiateCheckout(input);
  }

  async checkStatus(
    provider: PaymentProvider,
    order: {
      merchantOrderCode: string;
      amountPaise?: number;
    },
  ): Promise<ProviderStatusResult> {
    return this.getAdapter(provider).checkStatus(order);
  }

  extractCallback(
    provider: PaymentProvider,
    payload: unknown,
    headers: Record<string, string | string[] | undefined>,
  ): ProviderCallbackPayload {
    return this.getAdapter(provider).extractCallback(payload, headers);
  }

  private getAdapter(provider: PaymentProvider) {
    switch (provider) {
      case PaymentProvider.HDFC_SMARTGATEWAY:
        return this.hdfcSmartGatewayPaymentProviderService;
      case PaymentProvider.PHONEPE_STANDARD:
        return this.phonePePaymentProviderService;
      default:
        return this.phonePePaymentProviderService;
    }
  }
}
