import { Injectable } from '@nestjs/common';
import { ConfigVisibility, PaymentProvider } from '@prisma/client';
import { PLATFORM_PUBLIC_RUNTIME_CONFIG_KEY } from '../site-settings/site-settings.constants';
import { SiteSettingsService } from '../site-settings/site-settings.service';
import {
  DEFAULT_PAYMENT_ORDER_EXPIRY_MINUTES,
  PAYMENT_SUBSCRIPTION_MODE_VALUES,
  PAYMENTS_ACTIVE_PROVIDER_PATH,
  PAYMENTS_DEFAULT_CURRENCY_CODE_PATH,
  PAYMENTS_ORDER_EXPIRY_MINUTES_PATH,
  PAYMENTS_PRACTICE_PREMIUM_REQUIRED_PATH,
  PAYMENTS_RUNTIME_CONFIG_KEY,
  PAYMENTS_SUBSCRIPTION_MODE_PATH,
  PHONEPE_CALLBACK_PATH,
  PHONEPE_PAY_PATH,
  PHONEPE_REDIRECT_MODE_PATH,
  PHONEPE_RETURN_PATH,
  PHONEPE_STATUS_PATH_TEMPLATE,
  type PaymentSubscriptionMode,
} from './payments.constants';

type PhonePeRuntimeConfig = {
  payPath: string;
  statusPathTemplate: string;
  callbackUrl: string | null;
  returnUrl: string | null;
  redirectMode: string;
};

@Injectable()
export class PaymentSettingsService {
  constructor(private readonly siteSettingsService: SiteSettingsService) {}

  async getActiveProvider() {
    const provider = await this.siteSettingsService.getStringSetting(
      PAYMENTS_RUNTIME_CONFIG_KEY,
      PAYMENTS_ACTIVE_PROVIDER_PATH,
      {
        fallback: PaymentProvider.PHONEPE_STANDARD,
      },
    );

    if (provider === PaymentProvider.PHONEPE_STANDARD) {
      return provider;
    }

    return PaymentProvider.PHONEPE_STANDARD;
  }

  async getDefaultCurrencyCode() {
    const currencyCode = await this.siteSettingsService.getStringSetting(
      PAYMENTS_RUNTIME_CONFIG_KEY,
      PAYMENTS_DEFAULT_CURRENCY_CODE_PATH,
      {
        fallback: 'INR',
      },
    );

    return currencyCode.trim().toUpperCase() || 'INR';
  }

  async getOrderExpiryMinutes() {
    return this.siteSettingsService.getNumberSetting(
      PAYMENTS_RUNTIME_CONFIG_KEY,
      PAYMENTS_ORDER_EXPIRY_MINUTES_PATH,
      {
        fallback: DEFAULT_PAYMENT_ORDER_EXPIRY_MINUTES,
        min: 5,
        max: 24 * 60,
        integer: true,
      },
    );
  }

  async getSubscriptionMode(): Promise<PaymentSubscriptionMode> {
    const mode = await this.siteSettingsService.getStringSetting(
      PAYMENTS_RUNTIME_CONFIG_KEY,
      PAYMENTS_SUBSCRIPTION_MODE_PATH,
      {
        fallback: 'EXTEND_ACTIVE',
      },
    );

    if (
      PAYMENT_SUBSCRIPTION_MODE_VALUES.includes(mode as PaymentSubscriptionMode)
    ) {
      return mode as PaymentSubscriptionMode;
    }

    return 'EXTEND_ACTIVE';
  }

  async isPracticePremiumRequired() {
    return this.siteSettingsService.getBooleanSetting(
      PAYMENTS_RUNTIME_CONFIG_KEY,
      PAYMENTS_PRACTICE_PREMIUM_REQUIRED_PATH,
      {
        fallback: false,
      },
    );
  }

  async getPhonePeRuntimeConfig(): Promise<PhonePeRuntimeConfig> {
    const [
      payPath,
      statusPathTemplate,
      callbackPath,
      returnPath,
      redirectMode,
    ] = await Promise.all([
      this.siteSettingsService.getStringSetting(
        PAYMENTS_RUNTIME_CONFIG_KEY,
        PHONEPE_PAY_PATH,
        {
          fallback: '/pg/v1/pay',
        },
      ),
      this.siteSettingsService.getStringSetting(
        PAYMENTS_RUNTIME_CONFIG_KEY,
        PHONEPE_STATUS_PATH_TEMPLATE,
        {
          fallback: '/pg/v1/status/{merchantId}/{merchantOrderCode}',
        },
      ),
      this.siteSettingsService.getStringSetting(
        PAYMENTS_RUNTIME_CONFIG_KEY,
        PHONEPE_CALLBACK_PATH,
        {
          fallback: '/api/v1/payments/providers/phonepe/callback',
        },
      ),
      this.siteSettingsService.getStringSetting(
        PAYMENTS_RUNTIME_CONFIG_KEY,
        PHONEPE_RETURN_PATH,
        {
          fallback: '/payments/result',
        },
      ),
      this.siteSettingsService.getStringSetting(
        PAYMENTS_RUNTIME_CONFIG_KEY,
        PHONEPE_REDIRECT_MODE_PATH,
        {
          fallback: 'REDIRECT',
        },
      ),
    ]);
    const appBaseUrl = await this.siteSettingsService.getStringSetting(
      PLATFORM_PUBLIC_RUNTIME_CONFIG_KEY,
      'origins.appBaseUrl',
      {
        visibility: ConfigVisibility.PUBLIC,
        fallback: '',
        envFallbackKey: 'APP_BASE_URL',
      },
    );

    return {
      payPath,
      statusPathTemplate,
      callbackUrl: this.resolveUrl(appBaseUrl, callbackPath),
      returnUrl: this.resolveUrl(appBaseUrl, returnPath),
      redirectMode: redirectMode || 'REDIRECT',
    };
  }

  private resolveUrl(baseUrl: string, value: string) {
    if (!value) {
      return null;
    }

    if (/^https?:\/\//i.test(value)) {
      return value;
    }

    if (!baseUrl) {
      return null;
    }

    return new URL(value.replace(/^\/+/, ''), `${baseUrl.replace(/\/+$/, '')}/`)
      .toString()
      .replace(/\/$/, '');
  }
}
