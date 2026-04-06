import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, PaymentOrderStatus, PaymentProvider } from '@prisma/client';
import { createHash } from 'node:crypto';
import type { PaymentProviderAdapter } from '../payment-provider.interface';
import { PaymentSettingsService } from '../payment-settings.service';
import {
  mapPhonePeStateToOrderStatus,
  mapPhonePeStateToTransactionStatus,
  type PaymentProviderCheckoutInput,
  type ProviderCallbackPayload,
  type ProviderCheckoutResult,
  type ProviderStatusResult,
} from '../payments.types';

type JsonRecord = Prisma.JsonObject;

@Injectable()
export class PhonePePaymentProviderService implements PaymentProviderAdapter {
  readonly provider = PaymentProvider.PHONEPE_STANDARD;

  constructor(
    private readonly configService: ConfigService,
    private readonly paymentSettingsService: PaymentSettingsService,
  ) {}

  async initiateCheckout(
    input: PaymentProviderCheckoutInput,
  ): Promise<ProviderCheckoutResult> {
    const config = await this.getRequiredConfig();
    const runtimeConfig =
      await this.paymentSettingsService.getPhonePeRuntimeConfig();

    if (!runtimeConfig.callbackUrl || !runtimeConfig.returnUrl) {
      throw new ServiceUnavailableException({
        code: 'PAYMENT_PROVIDER_MISCONFIGURED',
        message:
          'PhonePe callback and return URLs require APP_BASE_URL or a published site app base URL.',
      });
    }

    const redirectUrl = new URL(runtimeConfig.returnUrl);
    redirectUrl.searchParams.set('orderId', input.order.id);
    redirectUrl.searchParams.set(
      'merchantOrderCode',
      input.order.merchantOrderCode,
    );

    const payload = {
      merchantId: config.merchantId,
      merchantTransactionId: input.order.merchantOrderCode,
      merchantUserId: input.purchaser.id,
      amount: input.order.amountPaise,
      redirectUrl: redirectUrl.toString(),
      redirectMode: runtimeConfig.redirectMode,
      callbackUrl: runtimeConfig.callbackUrl,
      paymentInstrument: {
        type: 'PAY_PAGE',
      },
    } satisfies JsonRecord;
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
      'base64',
    );
    const xVerify = this.computePayXVerify(
      encodedPayload,
      runtimeConfig.payPath,
      config.saltKey,
      config.saltIndex,
    );
    const response = await fetch(
      `${config.apiBaseUrl}${runtimeConfig.payPath}`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-VERIFY': xVerify,
        },
        body: JSON.stringify({
          request: encodedPayload,
        }),
      },
    );
    const responseJson = await this.readResponseJson(response);

    if (!response.ok) {
      throw new BadGatewayException({
        code: 'PAYMENT_PROVIDER_REQUEST_FAILED',
        message: 'PhonePe checkout initiation failed.',
        details: responseJson,
      });
    }

    const data = this.pickObject(responseJson, ['data']);
    const instrumentResponse = this.pickObject(data, ['instrumentResponse']);
    const redirectInfo = this.pickObject(instrumentResponse, ['redirectInfo']);
    const providerRedirectUrl = this.pickString(redirectInfo, ['url']);

    return {
      status: PaymentOrderStatus.PENDING,
      redirectUrl: providerRedirectUrl,
      providerOrderId: this.pickString(data, ['merchantTransactionId']),
      providerReferenceId: this.pickString(data, ['providerReferenceId']),
      providerStatus:
        this.pickString(data, ['state']) ??
        this.pickString(responseJson, ['code']) ??
        'PENDING',
      metadataJson: {
        requestPayload: payload,
        response: responseJson,
      },
    };
  }

  async checkStatus(order: {
    merchantOrderCode: string;
    amountPaise?: number;
  }): Promise<ProviderStatusResult> {
    const config = await this.getRequiredConfig();
    const runtimeConfig =
      await this.paymentSettingsService.getPhonePeRuntimeConfig();
    const statusPath = runtimeConfig.statusPathTemplate
      .replaceAll('{merchantId}', config.merchantId)
      .replaceAll('{merchantOrderCode}', order.merchantOrderCode);
    const xVerify = this.computeStatusXVerify(
      statusPath,
      config.saltKey,
      config.saltIndex,
    );
    const response = await fetch(`${config.apiBaseUrl}${statusPath}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'X-VERIFY': xVerify,
        'X-MERCHANT-ID': config.merchantId,
      },
    });
    const responseJson = await this.readResponseJson(response);

    if (!response.ok) {
      throw new BadGatewayException({
        code: 'PAYMENT_STATUS_CHECK_FAILED',
        message: 'PhonePe status check failed.',
        details: responseJson,
      });
    }

    const data = this.pickObject(responseJson, ['data']);
    const state =
      this.pickString(data, ['state']) ??
      this.pickString(responseJson, ['code']) ??
      'PENDING';

    return {
      status: mapPhonePeStateToOrderStatus(state),
      transactionStatus: mapPhonePeStateToTransactionStatus(state),
      providerTransactionId:
        this.pickString(data, ['transactionId']) ??
        this.pickString(data, ['providerTransactionId']),
      providerReferenceId: this.pickString(data, ['providerReferenceId']),
      providerStatus: state,
      occurredAt: new Date(),
      responseJson,
    };
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
    const payloadObject = this.asPayloadObject(payload);
    const decodedResponse =
      typeof payloadObject.response === 'string'
        ? this.decodeBase64Json(payloadObject.response)
        : null;
    const normalizedPayload = decodedResponse ?? payloadObject;
    const data = this.pickObject(normalizedPayload, ['data']);
    const merchantOrderCode =
      this.pickString(data, ['merchantTransactionId']) ??
      this.pickString(normalizedPayload, ['merchantTransactionId']);
    const providerEventId =
      this.pickString(data, ['transactionId']) ??
      this.pickString(data, ['providerReferenceId']) ??
      this.pickString(normalizedPayload, ['transactionId']);
    const eventType =
      this.pickString(data, ['state']) ??
      this.pickString(normalizedPayload, ['code']) ??
      'PHONEPE_CALLBACK';
    const xVerifyHeader = normalizedHeaders['x-verify'];
    const dedupeSeed =
      typeof xVerifyHeader === 'string' && xVerifyHeader.length > 0
        ? xVerifyHeader
        : JSON.stringify(normalizedPayload);

    return {
      merchantOrderCode,
      providerEventId,
      eventType,
      dedupeKey: `phonepe:${merchantOrderCode ?? 'unknown'}:${
        providerEventId ?? createHash('sha256').update(dedupeSeed).digest('hex')
      }`,
      payloadJson: normalizedPayload,
      headersJson: normalizedHeaders,
    };
  }

  private async getRequiredConfig() {
    const apiBaseUrl = this.configService.get<string>('PHONEPE_API_BASE_URL');
    const merchantId = this.configService.get<string>('PHONEPE_MERCHANT_ID');
    const saltKey = this.configService.get<string>('PHONEPE_SALT_KEY');
    const saltIndex = this.configService.get<string>('PHONEPE_SALT_INDEX');

    if (!apiBaseUrl || !merchantId || !saltKey || !saltIndex) {
      throw new ServiceUnavailableException({
        code: 'PAYMENT_PROVIDER_NOT_CONFIGURED',
        message: 'PhonePe checkout is not configured for this environment.',
      });
    }

    return {
      apiBaseUrl: apiBaseUrl.replace(/\/+$/, ''),
      merchantId,
      saltKey,
      saltIndex,
    };
  }

  private computePayXVerify(
    encodedPayload: string,
    payPath: string,
    saltKey: string,
    saltIndex: string,
  ) {
    const value = `${encodedPayload}${payPath}${saltKey}`;
    return `${createHash('sha256').update(value).digest('hex')}###${saltIndex}`;
  }

  private computeStatusXVerify(
    statusPath: string,
    saltKey: string,
    saltIndex: string,
  ) {
    return `${createHash('sha256').update(`${statusPath}${saltKey}`).digest('hex')}###${saltIndex}`;
  }

  private decodeBase64Json(value: string): JsonRecord | null {
    try {
      const decoded = Buffer.from(value, 'base64').toString('utf8');
      const parsed = JSON.parse(decoded);
      return this.asPayloadObject(parsed);
    } catch {
      return null;
    }
  }

  private async readResponseJson(response: Response): Promise<JsonRecord> {
    const rawText = await response.text();

    if (!rawText) {
      return {};
    }

    try {
      return this.asPayloadObject(JSON.parse(rawText));
    } catch {
      return {
        rawText,
      };
    }
  }

  private asPayloadObject(value: unknown): JsonRecord {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return this.toJsonValue(value) as JsonRecord;
    }

    return {
      value: this.toJsonValue(value),
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
}
