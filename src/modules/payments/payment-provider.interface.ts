import { PaymentProvider } from '@prisma/client';
import type {
  PaymentProviderCheckoutInput,
  ProviderCallbackPayload,
  ProviderCheckoutResult,
  ProviderStatusResult,
} from './payments.types';

export type PaymentProviderAdapter = {
  readonly provider: PaymentProvider;
  initiateCheckout(
    input: PaymentProviderCheckoutInput,
  ): Promise<ProviderCheckoutResult>;
  checkStatus(order: {
    merchantOrderCode: string;
    amountPaise?: number;
  }): Promise<ProviderStatusResult>;
  extractCallback(
    payload: unknown,
    headers: Record<string, string | string[] | undefined>,
  ): ProviderCallbackPayload;
};
