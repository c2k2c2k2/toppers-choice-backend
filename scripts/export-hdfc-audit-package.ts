import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  ConfigStatus,
  PaymentEventSource,
  PaymentProvider,
  PaymentOrderStatus,
  PrismaClient,
} from '@prisma/client';
import { loadEnvironmentFile } from '../src/common/test/load-env-file';

type CliOptions = {
  count: number;
  outputDir: string;
};

type JsonRecord = Record<string, unknown>;

const HDFC_AUDIT_WEBSITE_URL = 'https://topperschoice.app';
const HDFC_AUDIT_API_BASE_URL = 'https://api.topperschoice.app';

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  let count = 2;
  let outputDir = resolve(process.cwd(), 'artifacts', 'hdfc-audit', 'latest');

  for (const arg of args) {
    if (arg.startsWith('--count=')) {
      const value = Number.parseInt(arg.slice('--count='.length), 10);
      if (Number.isInteger(value) && value > 0) {
        count = value;
      }
    }

    if (arg.startsWith('--output=')) {
      const value = arg.slice('--output='.length).trim();
      if (value.length > 0) {
        outputDir = resolve(process.cwd(), value);
      }
    }
  }

  return {
    count,
    outputDir,
  };
}

function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as JsonRecord;
}

function readPath(
  value: unknown,
  path: string[],
): string | number | boolean | null | undefined {
  let current: unknown = value;

  for (const segment of path) {
    const record = asRecord(current);
    if (!record || !(segment in record)) {
      return undefined;
    }

    current = record[segment];
  }

  if (
    current === null ||
    typeof current === 'string' ||
    typeof current === 'number' ||
    typeof current === 'boolean'
  ) {
    return current;
  }

  return undefined;
}

function readString(value: unknown, path: string[]) {
  const result = readPath(value, path);
  return typeof result === 'string' && result.trim().length > 0
    ? result.trim()
    : null;
}

function readNumber(value: unknown, path: string[]) {
  const result = readPath(value, path);
  return typeof result === 'number' && Number.isFinite(result) ? result : null;
}

function toDisplayBaseUrl(value: string | null | undefined) {
  if (!value) {
    return HDFC_AUDIT_WEBSITE_URL;
  }

  if (/localhost|127\.0\.0\.1/i.test(value)) {
    return HDFC_AUDIT_WEBSITE_URL;
  }

  return value.replace(/\/+$/, '');
}

function formatAmount(amountPaise: number, currencyCode: string) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(amountPaise / 100);
}

function sanitizeStatusPayload(value: unknown) {
  const record = asRecord(value);

  if (!record) {
    return {};
  }

  const cardRecord = asRecord(record.card);
  const txnDetail = asRecord(record.txn_detail);
  const gatewayResponse = asRecord(record.payment_gateway_response);
  const paymentLinks = asRecord(record.payment_links);

  return {
    providerReferenceId:
      readString(record, ['id']) ??
      readString(record, ['payment_id']) ??
      readString(record, ['paymentId']),
    orderNumber:
      readString(record, ['order_id']) ?? readString(record, ['orderId']),
    status: readString(record, ['status']),
    amount: readNumber(record, ['amount']),
    currency: readString(record, ['currency']),
    providerTransactionId:
      readString(record, ['txn_id']) ?? readString(record, ['txnId']),
    merchantId: readString(record, ['merchant_id']),
    returnUrl: readString(record, ['return_url']),
    dateCreated: readString(record, ['date_created']),
    lastUpdated: readString(record, ['last_updated']),
    orderExpiry: readString(record, ['order_expiry']),
    paymentMethod: readString(record, ['payment_method']),
    paymentMethodType: readString(record, ['payment_method_type']),
    bankErrorCode: readString(record, ['bank_error_code']),
    bankErrorMessage: readString(record, ['bank_error_message']),
    cardSummary: cardRecord
      ? {
          issuer: readString(cardRecord, ['card_issuer']),
          brand: readString(cardRecord, ['card_brand']),
          type: readString(cardRecord, ['card_type']),
          lastFourDigits: readString(cardRecord, ['last_four_digits']),
        }
      : null,
    transactionDetail: txnDetail
      ? {
          status: readString(txnDetail, ['status']),
          created: readString(txnDetail, ['created']),
          lastUpdated: readString(txnDetail, ['last_updated']),
          transactionAmount: readNumber(txnDetail, ['txn_amount']),
          gateway: readString(txnDetail, ['gateway']),
          errorCode: readString(txnDetail, ['error_code']),
          errorMessage: readString(txnDetail, ['error_message']),
        }
      : null,
    gatewayResponse: gatewayResponse
      ? {
          rrn: readString(gatewayResponse, ['rrn']),
          epgTransactionId: readString(gatewayResponse, ['epg_txn_id']),
          created: readString(gatewayResponse, ['created']),
        }
      : null,
    paymentLinks: paymentLinks
      ? {
          web: readString(paymentLinks, ['web']),
          mobile: readString(paymentLinks, ['mobile']),
        }
      : null,
  };
}

function sanitizeEventPayload(value: unknown) {
  const record = asRecord(value);

  if (!record) {
    return {};
  }

  const requestPayload = asRecord(record.requestPayload);
  const responsePayload = asRecord(record.response);

  if (requestPayload || responsePayload) {
    return {
      requestPayload: requestPayload
        ? {
            orderNumber: readString(requestPayload, ['order_id']),
            amount: readNumber(requestPayload, ['amount']),
            currency: readString(requestPayload, ['currency']),
            returnUrl: readString(requestPayload, ['return_url']),
            merchantId: readString(requestPayload, ['merchant_id']),
          }
        : null,
      response: responsePayload ? sanitizeStatusPayload(responsePayload) : null,
    };
  }

  return sanitizeStatusPayload(record);
}

function escapeCsv(value: string | number | null) {
  if (value === null) {
    return '';
  }

  const normalized = String(value);
  if (/[",\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }

  return normalized;
}

async function main() {
  loadEnvironmentFile();

  const options = parseArgs();
  const prisma = new PrismaClient();

  try {
    const requestedSiteCode =
      process.env.DEFAULT_SITE_CODE?.trim() || 'toppers-choice';
    const site =
      (await prisma.site.findFirst({
        where: {
          code: requestedSiteCode,
        },
        select: {
          code: true,
          id: true,
          name: true,
        },
      })) ??
      (await prisma.site.findFirst({
        where: {
          isDefault: true,
        },
        select: {
          code: true,
          id: true,
          name: true,
        },
      }));

    if (!site) {
      throw new Error('No default site was found for HDFC audit export.');
    }

    const [orders, configVersions] = await Promise.all([
      prisma.paymentOrder.findMany({
        where: {
          siteId: site.id,
          provider: PaymentProvider.HDFC_SMARTGATEWAY,
          status: PaymentOrderStatus.SUCCEEDED,
        },
        orderBy: [{ confirmedAt: 'desc' }, { createdAt: 'desc' }],
        take: options.count,
        include: {
          user: {
            select: {
              email: true,
              fullName: true,
            },
          },
          plan: {
            select: {
              code: true,
              currencyCode: true,
              durationDays: true,
              name: true,
              pricePaise: true,
            },
          },
          subscription: {
            select: {
              id: true,
              status: true,
              startsAt: true,
              endsAt: true,
            },
          },
          transactions: {
            orderBy: [{ createdAt: 'desc' }],
          },
          events: {
            where: {
              source: {
                in: [
                  PaymentEventSource.CHECKOUT_RESPONSE,
                  PaymentEventSource.STATUS_POLL,
                  PaymentEventSource.CALLBACK,
                  PaymentEventSource.RECONCILIATION,
                ],
              },
            },
            orderBy: [{ receivedAt: 'asc' }],
          },
        },
      }),
      prisma.siteConfigVersion.findMany({
        where: {
          siteId: site.id,
          status: ConfigStatus.PUBLISHED,
          configKey: {
            in: ['payments.runtime', 'platform.public_runtime', 'site.public'],
          },
        },
        orderBy: [{ configKey: 'asc' }, { version: 'desc' }],
        select: {
          configJson: true,
          configKey: true,
          publishedAt: true,
          version: true,
        },
      }),
    ]);

    const latestConfigByKey = new Map<
      string,
      {
        version: number;
        publishedAt: Date | null;
        configJson: unknown;
      }
    >();

    for (const item of configVersions) {
      if (!latestConfigByKey.has(item.configKey)) {
        latestConfigByKey.set(item.configKey, item);
      }
    }

    const paymentsRuntime =
      asRecord(latestConfigByKey.get('payments.runtime')?.configJson) ?? {};
    const platformRuntime =
      asRecord(latestConfigByKey.get('platform.public_runtime')?.configJson) ??
      {};
    const sitePublic =
      asRecord(latestConfigByKey.get('site.public')?.configJson) ?? {};
    const generatedAt = new Date().toISOString();
    const appBaseUrl = toDisplayBaseUrl(
      readString(platformRuntime, ['origins', 'appBaseUrl']) ??
        process.env.APP_BASE_URL,
    );

    mkdirSync(options.outputDir, {
      recursive: true,
    });

    const sanitizedOrders = orders.map((order) => {
      const transaction = order.transactions[0] ?? null;

      return {
        order: {
          id: order.id,
          orderNumber: order.merchantOrderCode,
          provider: order.provider,
          amountPaise: order.amountPaise,
          amount: formatAmount(order.amountPaise, order.currencyCode),
          currencyCode: order.currencyCode,
          status: order.status,
          providerStatus: order.providerStatus,
          providerReferenceId: order.providerReferenceId,
          providerOrderId: order.providerOrderId,
          confirmedAt: order.confirmedAt?.toISOString() ?? null,
          callbackConfirmedAt: order.callbackConfirmedAt?.toISOString() ?? null,
          createdAt: order.createdAt.toISOString(),
          user: order.user,
          plan: {
            code: order.plan.code,
            name: order.plan.name,
            durationDays: order.plan.durationDays,
            configuredPrice: formatAmount(
              order.plan.pricePaise,
              order.plan.currencyCode,
            ),
          },
          subscription: order.subscription
            ? {
                id: order.subscription.id,
                status: order.subscription.status,
                startsAt: order.subscription.startsAt.toISOString(),
                endsAt: order.subscription.endsAt.toISOString(),
              }
            : null,
        },
        transactionLog: transaction
          ? {
              id: transaction.id,
              status: transaction.status,
              occurredAt: transaction.occurredAt?.toISOString() ?? null,
              providerReferenceId: transaction.providerReferenceId,
              providerTransactionId: transaction.providerTransactionId,
              response: sanitizeStatusPayload(transaction.responseJson),
            }
          : null,
        eventLogs: order.events.map((event) => ({
          id: event.id,
          source: event.source,
          eventType: event.eventType,
          status: event.status,
          receivedAt: event.receivedAt.toISOString(),
          processedAt: event.processedAt?.toISOString() ?? null,
          payload: sanitizeEventPayload(event.payloadJson),
        })),
      };
    });

    const orderCsvRows = [
      [
        'orderId',
        'orderNumber',
        'amount',
        'status',
        'providerReferenceId',
        'providerTransactionId',
        'planName',
        'userEmail',
        'confirmedAt',
      ],
      ...sanitizedOrders.map((item) => [
        item.order.id,
        item.order.orderNumber,
        item.order.amount,
        item.order.status,
        item.order.providerReferenceId ?? '',
        item.transactionLog?.providerTransactionId ?? '',
        item.order.plan.name,
        item.order.user.email,
        item.order.confirmedAt ?? '',
      ]),
    ];

    const auditSummary = `# HDFC Audit Package

Generated at: ${generatedAt}

## Merchant
- Merchant name: MADHURI ANIL DEULKAR (WEB)
- Account id: SG4798
- Site: ${site.name} (${site.code})
- Payment provider: HDFC SmartGateway
- Website URL: ${appBaseUrl}
- Backend API URL: ${HDFC_AUDIT_API_BASE_URL}
- Response URL: ${appBaseUrl}/payments/result
- Active provider config: ${
      readString(paymentsRuntime, ['providerSelection', 'activeProvider']) ??
      'HDFC_SMARTGATEWAY'
    }

## Included Files
- \`README.md\`
- \`orders.csv\`
- \`order-status-logs.json\`
- \`SCREENSHOT_CHECKLIST.md\`

## Exported Successful Orders
${sanitizedOrders
  .map(
    (item, index) =>
      `${index + 1}. ${item.order.orderNumber} | ${item.order.amount} | ${
        item.order.plan.name
      } | ${item.order.user.email} | ${item.order.confirmedAt ?? item.order.createdAt}`,
  )
  .join('\n')}

## Submission Notes
- Use the order numbers above in the final screenshot pack and attached logs.
- Keep the browser URL visible in every screenshot.
- Capture the final response page only after it shows Order Number, Amount, and Success Message together.
- Use [HDFC_AUDIT_REPLY.md](./../../HDFC_AUDIT_REPLY.md) as the mail draft source.
`;

    const screenshotChecklist = `# HDFC Screenshot Checklist

Use a successful HDFC UAT transaction and capture the following screens in sequence with the browser URL visible:

1. Home page or public landing page
   URL to capture: ${appBaseUrl}/

2. Pricing page or student plans entry page
   URL to capture: ${appBaseUrl}/pricing or ${appBaseUrl}/student/plans

3. Student plans page with selected plan
   Ensure the selected plan and amount are visible.

4. Redirected HDFC payment page
   Capture the HDFC payment page before payment confirmation.

5. Final success response page
   URL to capture: ${appBaseUrl}/payments/result?... 
   Ensure the page visibly shows:
   - Order Number
   - Amount
   - Success Message

6. Optional support screenshot
   Capture the student plans tracker or receipt block again after success for cross-reference.

## Screenshot Naming
- 01-home-page.png
- 02-pricing-or-student-plans.png
- 03-selected-plan.png
- 04-hdfc-payment-page.png
- 05-payment-success-page.png
- 06-optional-receipt-view.png

## Audit Notes
- Use ${HDFC_AUDIT_API_BASE_URL} as the backend API base when sharing order status API references with HDFC.
`;

    const jsonPayload = {
      generatedAt,
      merchant: {
        accountId: 'SG4798',
        merchantName: 'MADHURI ANIL DEULKAR (WEB)',
        apiBaseUrl: HDFC_AUDIT_API_BASE_URL,
        responseUrl: `${appBaseUrl}/payments/result`,
        websiteUrl: appBaseUrl,
      },
      site: {
        code: site.code,
        name: site.name,
      },
      runtimeConfig: {
        appBaseUrl,
        activeProvider:
          readString(paymentsRuntime, ['providerSelection', 'activeProvider']) ??
          'HDFC_SMARTGATEWAY',
      },
      orders: sanitizedOrders,
    };

    writeFileSync(
      join(options.outputDir, 'README.md'),
      auditSummary,
      'utf8',
    );
    writeFileSync(
      join(options.outputDir, 'SCREENSHOT_CHECKLIST.md'),
      screenshotChecklist,
      'utf8',
    );
    writeFileSync(
      join(options.outputDir, 'order-status-logs.json'),
      JSON.stringify(jsonPayload, null, 2),
      'utf8',
    );
    writeFileSync(
      join(options.outputDir, 'orders.csv'),
      `${orderCsvRows
        .map((row) => row.map((cell) => escapeCsv(cell)).join(','))
        .join('\n')}\n`,
      'utf8',
    );

    console.log(`HDFC audit package exported to ${options.outputDir}`);
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
