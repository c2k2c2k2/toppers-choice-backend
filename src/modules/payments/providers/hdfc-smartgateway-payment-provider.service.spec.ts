import { HdfcSmartGatewayPaymentProviderService } from './hdfc-smartgateway-payment-provider.service';

describe('HdfcSmartGatewayPaymentProviderService', () => {
  const service = new HdfcSmartGatewayPaymentProviderService(
    {} as never,
    {} as never,
  );

  it('extracts the order id from ORDER_SUCCEEDED callbacks', () => {
    const callback = service.extractCallback(
      {
        event_name: 'ORDER_SUCCEEDED',
        id: 'evt_order_succeeded',
        content: {
          order: {
            order_id: 'tcmq0ujlipda9a9ac3',
            status: 'CHARGED',
          },
        },
      },
      {},
    );

    expect(callback.merchantOrderCode).toBe('tcmq0ujlipda9a9ac3');
    expect(callback.providerEventId).toBe('evt_order_succeeded');
    expect(callback.eventType).toBe('ORDER_SUCCEEDED');
    expect(callback.dedupeKey).toBe(
      'hdfc:tcmq0ujlipda9a9ac3:evt_order_succeeded',
    );
  });

  it('extracts the order id from TXN_CHARGED callbacks', () => {
    const callback = service.extractCallback(
      {
        event_name: 'TXN_CHARGED',
        id: 'evt_txn_charged',
        content: {
          txn: {
            order_id: 'tcmq0ujlipda9a9ac3',
            status: 'CHARGED',
          },
        },
      },
      {
        'x-request-id': 'request-1',
        'x-tenant-host': 'smartgateway.hdfc.bank.in',
      },
    );

    expect(callback.merchantOrderCode).toBe('tcmq0ujlipda9a9ac3');
    expect(callback.providerEventId).toBe('evt_txn_charged');
    expect(callback.eventType).toBe('TXN_CHARGED');
    expect(callback.headersJson).toMatchObject({
      'x-request-id': 'request-1',
      'x-tenant-host': 'smartgateway.hdfc.bank.in',
    });
  });
});
