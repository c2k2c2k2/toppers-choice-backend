import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, PaymentOrderStatus, PaymentProvider } from '@prisma/client';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { APIError, Juspay } from 'expresscheckout-nodejs';
import type { PaymentProviderAdapter } from '../payment-provider.interface';
import { PaymentSettingsService } from '../payment-settings.service';
import {
  mapHdfcStatusToOrderStatus,
  mapHdfcStatusToTransactionStatus,
  type PaymentProviderCheckoutInput,
  type ProviderCallbackPayload,
  type ProviderCheckoutResult,
  type ProviderStatusResult,
} from '../payments.types';

type JsonRecord = Prisma.JsonObject;

@Injectable()
export class HdfcSmartGatewayPaymentProviderService
  implements PaymentProviderAdapter
{
  readonly provider = PaymentProvider.HDFC_SMARTGATEWAY;

  constructor(
    private readonly configService: ConfigService,
    private readonly paymentSettingsService: PaymentSettingsService,
  ) {}

  async initiateCheckout(
    input: PaymentProviderCheckoutInput,
  ): Promise<ProviderCheckoutResult> {
    const [config, runtimeConfig] = await Promise.all([
      this.getRequiredConfig(),
      this.paymentSettingsService.getHdfcRuntimeConfig(),
    ]);

    if (!runtimeConfig.returnUrl) {
      throw new ServiceUnavailableException({
        code: 'PAYMENT_PROVIDER_MISCONFIGURED',
        message:
          'HDFC SmartGateway return URL requires APP_BASE_URL or a published site app base URL.',
      });
    }

    const juspay = new Juspay({
      merchantId: config.merchantId,
      baseUrl: config.apiBaseUrl,
      jweAuth: {
        keyId: config.keyUuid,
        publicKey: config.publicKey,
        privateKey: config.privateKey,
      },
    });

    const { firstName, lastName } = this.splitName(input.purchaser.fullName);
    const payload = {
      order_id: input.order.merchantOrderCode,
      amount: this.toProviderAmount(input.order.amountPaise),
      customer_id: input.purchaser.id,
      customer_email: input.purchaser.email,
      payment_page_client_id: config.paymentPageClientId,
      action: 'paymentPage',
      return_url: runtimeConfig.returnUrl,
      first_name: firstName,
      last_name: lastName,
      currency: input.order.currencyCode,
      merchant_id: config.merchantId,
      udf1: input.order.id,
    } satisfies Record<string, string | number | undefined>;

    try {
      const response = this.asPayloadObject(await juspay.orderSession.create(payload));
      const paymentLinks = this.pickObject(response, ['payment_links']);
      const sdkPayload = this.pickObject(response, ['sdk_payload']);
      const redirectUrl = this.validatePaymentPageUrl(
        this.pickString(paymentLinks, ['web']) ??
          this.pickString(paymentLinks, ['mobile']) ??
          null,
        config.apiBaseUrl,
      );

      return {
        status: mapHdfcStatusToOrderStatus(
          this.pickString(response, ['status']) ?? 'NEW',
        ),
        redirectUrl,
        providerOrderId: this.pickString(response, ['id']),
        providerReferenceId:
          this.pickString(sdkPayload, ['requestId']) ??
          this.pickString(response, ['id']),
        providerStatus: this.pickString(response, ['status']) ?? 'NEW',
        metadataJson: {
          requestPayload: this.toJsonValue(payload) as JsonRecord,
          response,
        },
      };
    } catch (error) {
      throw this.asProviderError(
        error,
        'PAYMENT_PROVIDER_REQUEST_FAILED',
        'HDFC SmartGateway checkout initiation failed.',
      );
    }
  }

  async checkStatus(order: {
    merchantOrderCode: string;
    amountPaise?: number;
  }): Promise<ProviderStatusResult> {
    const config = await this.getRequiredConfig();
    const juspay = new Juspay({
      merchantId: config.merchantId,
      baseUrl: config.apiBaseUrl,
      jweAuth: {
        keyId: config.keyUuid,
        publicKey: config.publicKey,
        privateKey: config.privateKey,
      },
    });

    try {
      const response = this.asPayloadObject(
        await juspay.order.status(order.merchantOrderCode),
      );
      const providerStatus = this.pickString(response, ['status']) ?? 'PENDING';
      const resolvedMerchantOrderCode =
        this.pickString(response, ['order_id']) ??
        this.pickString(response, ['orderId']);

      if (
        resolvedMerchantOrderCode &&
        resolvedMerchantOrderCode !== order.merchantOrderCode
      ) {
        throw new BadGatewayException({
          code: 'PAYMENT_STATUS_MISMATCH',
          message:
            'HDFC SmartGateway status response returned a mismatched order id.',
        });
      }

      const resolvedAmountPaise = this.pickAmountPaise(response, [
        ['amount'],
        ['amount_paid'],
        ['payment_gateway_response', 'amount'],
        ['sdk_payload', 'payload', 'amount'],
      ]);

      if (
        typeof order.amountPaise === 'number' &&
        resolvedAmountPaise !== null &&
        resolvedAmountPaise !== order.amountPaise
      ) {
        throw new BadGatewayException({
          code: 'PAYMENT_AMOUNT_MISMATCH',
          message:
            'HDFC SmartGateway status response returned a mismatched amount.',
        });
      }

      return {
        status: mapHdfcStatusToOrderStatus(providerStatus),
        transactionStatus: mapHdfcStatusToTransactionStatus(providerStatus),
        providerTransactionId:
          this.pickString(response, ['txn_id']) ??
          this.pickString(response, ['txnId']) ??
          this.pickString(response, ['payment_method_response', 'txn_id']) ??
          this.pickString(response, ['payment_gateway_response', 'txn_id']),
        providerReferenceId:
          this.pickString(response, ['id']) ??
          this.pickString(response, ['payment_id']) ??
          this.pickString(response, ['paymentId']),
        providerStatus,
        occurredAt: this.pickDate(response, [
          ['last_updated'],
          ['date_created'],
          ['txn_date'],
          ['created'],
        ]),
        responseJson: response,
      };
    } catch (error) {
      throw this.asProviderError(
        error,
        'PAYMENT_STATUS_CHECK_FAILED',
        'HDFC SmartGateway status check failed.',
      );
    }
  }

  extractCallback(
    payload: unknown,
    headers: Record<string, string | string[] | undefined>,
  ): ProviderCallbackPayload {
    const normalizedHeaders = this.asPayloadObject(
      Object.fromEntries(
        Object.entries(headers).map(([key, value]) => [
          key,
          Array.isArray(value) ? value.join(',') : (value ?? ''),
        ]),
      ),
    );
    const normalizedPayload = this.asPayloadObject(payload);
    const merchantOrderCode =
      this.pickString(normalizedPayload, ['order_id']) ??
      this.pickString(normalizedPayload, ['content', 'order', 'order_id']) ??
      this.pickString(normalizedPayload, ['orderId']);
    const providerEventId =
      this.pickString(normalizedPayload, ['event_name']) ??
      this.pickString(normalizedPayload, ['id']);
    const eventType =
      this.pickString(normalizedPayload, ['event_name']) ??
      this.pickString(normalizedPayload, ['status']) ??
      'HDFC_CALLBACK';

    return {
      merchantOrderCode,
      providerEventId,
      eventType,
      dedupeKey: `hdfc:${merchantOrderCode ?? 'unknown'}:${
        providerEventId ??
        createHash('sha256')
          .update(JSON.stringify(normalizedPayload))
          .digest('hex')
      }`,
      payloadJson: normalizedPayload,
      headersJson: normalizedHeaders,
    };
  }

  private async getRequiredConfig() {
    const apiBaseUrl =
      this.configService.get<string>('HDFC_SMARTGATEWAY_API_BASE_URL') ??
      'https://smartgateway.hdfcuat.bank.in';
    const merchantId = this.configService.get<string>(
      'HDFC_SMARTGATEWAY_MERCHANT_ID',
    );
    const keyUuid = this.configService.get<string>(
      'HDFC_SMARTGATEWAY_KEY_UUID',
    );
    const paymentPageClientId = this.configService.get<string>(
      'HDFC_SMARTGATEWAY_PAYMENT_PAGE_CLIENT_ID',
    );
    const publicKey = await this.resolvePem(
      this.configService.get<string>('HDFC_SMARTGATEWAY_PUBLIC_KEY'),
      this.configService.get<string>('HDFC_SMARTGATEWAY_PUBLIC_KEY_PATH'),
    );
    const privateKey = await this.resolvePem(
      this.configService.get<string>('HDFC_SMARTGATEWAY_PRIVATE_KEY'),
      this.configService.get<string>('HDFC_SMARTGATEWAY_PRIVATE_KEY_PATH'),
    );

    if (
      !merchantId ||
      !keyUuid ||
      !paymentPageClientId ||
      !publicKey ||
      !privateKey
    ) {
      throw new ServiceUnavailableException({
        code: 'PAYMENT_PROVIDER_NOT_CONFIGURED',
        message:
          'HDFC SmartGateway checkout is not configured for this environment.',
      });
    }

    return {
      apiBaseUrl: apiBaseUrl.replace(/\/+$/, ''),
      merchantId,
      keyUuid,
      paymentPageClientId,
      publicKey,
      privateKey,
    };
  }

  private async resolvePem(value?: string | null, filePath?: string | null) {
    const inlineValue = this.normalizePem(value);
    if (inlineValue) {
      return inlineValue;
    }

    if (!filePath) {
      return null;
    }

    const contents = await readFile(filePath, 'utf8');
    return this.normalizePem(contents);
  }

  private normalizePem(value?: string | null) {
    if (!value) {
      return null;
    }

    return value.replace(/\\n/g, '\n').trim();
  }

  private validatePaymentPageUrl(value: string | null, apiBaseUrl: string) {
    if (!value) {
      return null;
    }

    let parsedUrl: URL;
    let configuredBaseUrl: URL;

    try {
      parsedUrl = new URL(value);
      configuredBaseUrl = new URL(apiBaseUrl);
    } catch {
      throw new BadGatewayException({
        code: 'PAYMENT_REDIRECT_INVALID',
        message:
          'HDFC SmartGateway returned an invalid payment page redirect URL.',
      });
    }

    if (parsedUrl.protocol !== 'https:') {
      throw new BadGatewayException({
        code: 'PAYMENT_REDIRECT_INVALID',
        message:
          'HDFC SmartGateway returned a non-HTTPS payment page redirect URL.',
      });
    }

    if (parsedUrl.host !== configuredBaseUrl.host) {
      throw new BadGatewayException({
        code: 'PAYMENT_REDIRECT_INVALID',
        message:
          'HDFC SmartGateway returned a payment page redirect URL for an unexpected host.',
      });
    }

    return parsedUrl.toString();
  }

  private toProviderAmount(amountPaise: number) {
    return Number((amountPaise / 100).toFixed(2));
  }

  private splitName(fullName: string) {
    const segments = fullName
      .trim()
      .split(/\s+/)
      .filter((segment) => segment.length > 0);

    return {
      firstName: segments[0] ?? 'Student',
      lastName: segments.slice(1).join(' ') || undefined,
    };
  }

  private asProviderError(
    error: unknown,
    code: string,
    message: string,
  ): BadGatewayException {
    if (error instanceof BadGatewayException) {
      return error;
    }

    if (error instanceof APIError) {
      return new BadGatewayException({
        code,
        message,
        details: {
          errorCode: error.error_code,
          httpStatusCode: error.httpInfo?.statusCode,
          message: error.message,
          type: error.name,
          userMessage: error.user_message,
        },
      });
    }

    return new BadGatewayException({
      code,
      message,
      details: {
        message: error instanceof Error ? error.message : String(error),
      },
    });
  }

  private asPayloadObject(value: unknown): JsonRecord {
    const responseValue =
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      'http' in (value as Record<string, unknown>)
        ? Object.fromEntries(
            Object.entries(value as Record<string, unknown>).filter(
              ([key]) => key !== 'http',
            ),
          )
        : value;

    if (
      responseValue &&
      typeof responseValue === 'object' &&
      !Array.isArray(responseValue)
    ) {
      return this.toJsonValue(responseValue) as JsonRecord;
    }

    return {
      value: this.toJsonValue(responseValue),
    };
  }

  private toJsonValue(value: unknown): Prisma.JsonValue {
    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.toJsonValue(item));
    }

    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [
          key,
          this.toJsonValue(item),
        ]),
      ) as Prisma.JsonObject;
    }

    return String(value);
  }

  private pickObject(
    value: JsonRecord | null | undefined,
    path: string[],
  ): JsonRecord | null {
    const candidate = path.reduce<unknown>((currentValue, segment) => {
      if (
        !currentValue ||
        typeof currentValue !== 'object' ||
        Array.isArray(currentValue)
      ) {
        return undefined;
      }

      return (currentValue as JsonRecord)[segment];
    }, value);

    if (
      candidate &&
      typeof candidate === 'object' &&
      !Array.isArray(candidate)
    ) {
      return candidate as JsonRecord;
    }

    return null;
  }

  private pickString(
    value: JsonRecord | null | undefined,
    path: string[],
  ): string | null {
    const candidate = path.reduce<unknown>((currentValue, segment) => {
      if (
        !currentValue ||
        typeof currentValue !== 'object' ||
        Array.isArray(currentValue)
      ) {
        return undefined;
      }

      return (currentValue as JsonRecord)[segment];
    }, value);

    return typeof candidate === 'string' && candidate.trim().length > 0
      ? candidate
      : null;
  }

  private pickAmountPaise(
    value: JsonRecord | null | undefined,
    paths: string[][],
  ) {
    for (const path of paths) {
      const candidate = path.reduce<unknown>((currentValue, segment) => {
        if (
          !currentValue ||
          typeof currentValue !== 'object' ||
          Array.isArray(currentValue)
        ) {
          return undefined;
        }

        return (currentValue as JsonRecord)[segment];
      }, value);

      if (typeof candidate === 'number' && Number.isFinite(candidate)) {
        return Math.round(candidate * 100);
      }

      if (typeof candidate === 'string' && candidate.trim().length > 0) {
        const parsed = Number(candidate);
        if (Number.isFinite(parsed)) {
          return Math.round(parsed * 100);
        }
      }
    }

    return null;
  }

  private pickDate(value: JsonRecord | null | undefined, paths: string[][]) {
    for (const path of paths) {
      const candidate = this.pickString(value, path);
      if (!candidate) {
        continue;
      }

      const parsed = new Date(candidate);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }

    return null;
  }
}
