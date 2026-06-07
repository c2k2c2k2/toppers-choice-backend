import {
  PaymentEventSource,
  PaymentOrderStatus,
  PaymentProvider,
  PaymentTransactionStatus,
} from '@prisma/client';
import { PaymentsService } from './payments.service';

describe('PaymentsService reconciliation', () => {
  it('checks provider status before expiring an old order during forced reconciliation', async () => {
    const expiredOrder = {
      id: 'order-id',
      siteId: 'site-id',
      merchantOrderCode: 'merchant-order-code',
      provider: PaymentProvider.HDFC_SMARTGATEWAY,
      amountPaise: 10000,
      currencyCode: 'INR',
      status: PaymentOrderStatus.PENDING,
      expiresAt: new Date(Date.now() - 60_000),
      subscription: null,
    };
    const updatedOrder = {
      ...expiredOrder,
      status: PaymentOrderStatus.SUCCEEDED,
      subscription: null,
    };
    const tx = {
      paymentEvent: {
        create: jest.fn(),
        update: jest.fn(),
      },
      paymentOrder: {
        update: jest.fn().mockResolvedValue(updatedOrder),
      },
      paymentTransaction: {
        upsert: jest.fn(),
      },
    };
    const prisma = {
      paymentOrder: {
        update: jest.fn(),
      },
      paymentEvent: {
        update: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const paymentGatewayService = {
      checkStatus: jest.fn().mockResolvedValue({
        status: PaymentOrderStatus.SUCCEEDED,
        transactionStatus: PaymentTransactionStatus.SUCCEEDED,
        providerTransactionId: 'provider-txn-id',
        providerReferenceId: 'provider-reference-id',
        providerStatus: 'CHARGED',
        occurredAt: new Date('2026-06-07T04:09:09Z'),
        responseJson: {},
      }),
    };
    const service = new PaymentsService(
      prisma as never,
      {} as never,
      {} as never,
      paymentGatewayService as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const activateSuccessfulOrder = jest
      .spyOn(service as any, 'activateSuccessfulOrder')
      .mockResolvedValue(updatedOrder);

    await (service as any).reconcileIfNeeded(
      expiredOrder,
      PaymentEventSource.CALLBACK,
      true,
      'callback-event-id',
    );

    expect(prisma.paymentOrder.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: PaymentOrderStatus.EXPIRED }),
      }),
    );
    expect(paymentGatewayService.checkStatus).toHaveBeenCalledWith(
      PaymentProvider.HDFC_SMARTGATEWAY,
      {
        merchantOrderCode: 'merchant-order-code',
        amountPaise: 10000,
      },
    );
    expect(tx.paymentOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: PaymentOrderStatus.SUCCEEDED,
          providerStatus: 'CHARGED',
        }),
      }),
    );
    expect(activateSuccessfulOrder).toHaveBeenCalledWith('order-id');
  });
});
