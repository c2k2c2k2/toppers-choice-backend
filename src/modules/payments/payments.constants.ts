export const PAYMENTS_RUNTIME_CONFIG_KEY = 'payments.runtime';
export const PAYMENTS_ACTIVE_PROVIDER_PATH = 'providerSelection.activeProvider';
export const PAYMENTS_DEFAULT_CURRENCY_CODE_PATH =
  'currency.defaultCurrencyCode';
export const PAYMENTS_ORDER_EXPIRY_MINUTES_PATH =
  'checkout.orderExpiryMinutes';
export const PAYMENTS_SUBSCRIPTION_MODE_PATH =
  'checkout.subscriptionMode';
export const PAYMENTS_PRACTICE_PREMIUM_REQUIRED_PATH =
  'practice.premiumRequired';
export const PHONEPE_PAY_PATH = 'providers.phonepe.payPath';
export const PHONEPE_STATUS_PATH_TEMPLATE =
  'providers.phonepe.statusPathTemplate';
export const PHONEPE_CALLBACK_PATH = 'providers.phonepe.callbackPath';
export const PHONEPE_RETURN_PATH = 'providers.phonepe.returnPath';
export const PHONEPE_REDIRECT_MODE_PATH = 'providers.phonepe.redirectMode';

export const DEFAULT_PAYMENT_ORDER_EXPIRY_MINUTES = 30;
export const PAYMENT_SUBSCRIPTION_MODE_VALUES = [
  'EXTEND_ACTIVE',
  'REPLACE_ACTIVE',
] as const;

export type PaymentSubscriptionMode =
  (typeof PAYMENT_SUBSCRIPTION_MODE_VALUES)[number];
