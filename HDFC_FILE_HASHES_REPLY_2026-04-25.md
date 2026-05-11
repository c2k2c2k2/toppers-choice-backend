Subject: Re: SHA-256 Hash Values for Request and Response Payment Files

Dear Sir,

Greetings from Topper's Choice.

Please find below the SHA-256 hash values for the code files used in our HDFC payment flow for the requested request and response URLs.

We generated the hash values using the SHA-256 algorithm as requested.

## 1. Request Web URL
URL: `https://topperschoice.app/api/v1/payments/checkout`

These backend files handle checkout request creation and include the order id, amount, and customer details passed in the request/payment initiation flow.

| Filename | File Type | Purpose | SHA-256 Hash |
| --- | --- | --- | --- |
| `payments.controller.ts` | Backend controller | Handles `POST /api/v1/payments/checkout` request routing | `22e8c91ceb539ce4b113a21b3130fc955d913c9c377aa06bc3dc51d61b69f10e` |
| `payments.service.ts` | Backend service | Creates payment order, generates order id, resolves amount, and prepares checkout | `63dfdc6c898cd78fa502f90e94daefedaaf224be39debc2c553220fd8ed50e01` |
| `hdfc-smartgateway-payment-provider.service.ts` | Backend payment provider service | Builds HDFC request payload including `order_id`, `amount`, `customer_id`, and `customer_email` | `aa17e325880652429d7b30f852a92a4d1613e59132693a1028e12e152d26033e` |

## 2. Response Web URL
URL: `https://topperschoice.app/payments/result`

This response URL is implemented as a frontend result page, and its success/failed payment logic is backed by protected backend order-status and callback handling.

| Filename | File Type | Purpose | SHA-256 Hash |
| --- | --- | --- | --- |
| `page.tsx` | Frontend route file | Next.js route file for `/payments/result` | `c8e03d17980024ee2d55d7702f3b54d183ba982ca0e524e0174090a00cf7d63d` |
| `payment-result-screen.tsx` | Frontend screen/component | Handles result page UI and success/failed display logic | `d4cdd576703d853ae3f0500b6340bc51113709aab28bb154a2a72b0c94dacbb0` |
| `payments-api.ts` | Frontend API integration file | Calls protected backend order-status API used by the result page | `2f52896c638de70a1cda0b8f0647058e6331bd7a1248194e474ed017b96574fe` |
| `payments.controller.ts` | Backend controller | Handles payment status route and HDFC callback route used by response processing | `22e8c91ceb539ce4b113a21b3130fc955d913c9c377aa06bc3dc51d61b69f10e` |
| `payments.service.ts` | Backend service | Handles success/failed reconciliation, order status, and callback processing | `63dfdc6c898cd78fa502f90e94daefedaaf224be39debc2c553220fd8ed50e01` |

Additional note:

- The checkout request handling is implemented in the backend payment module.
- The `/payments/result` URL is a frontend page, while the final success/failed payment verification is handled through backend payment status and callback logic.
- All above hash values were generated using SHA-256 from the current deployed codebase used for the HDFC payment integration flow.

Please let us know if you need the same hash values in Excel/CSV format as well.

Thanks & Regards,  
Topper's Choice
