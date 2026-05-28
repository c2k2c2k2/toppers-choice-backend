Subject: Re: Security Audit Details for HDFC Payment Gateway Integration

Dear Sir,

Greetings from Toppers' Choice.

Please find below our confirmation and implementation status for the HDFC payment gateway security audit.

We confirm that the payment integration checklist has been implemented and the UAT setup is ready for audit execution.

1. Successful payment process flow screenshots

We will share step-by-step screenshots of the successful payment flow from the home page to the final success response page.

The final response page displays the following details to the end user in real-time:
- Order Number
- Amount
- Success Message

The screenshots will include the visible website URL.

2. Order status API response logs

We will share the order status API response logs as requested for verification.

Please find our confirmation against the below audit prerequisites:

1) Maintain database to store the transaction details / status: YES
2) Services / payment confirmation to customer / user will be provided on basis of database status: YES
3) Multiple test transactions can be performed during security audit: YES
4) Login credentials will be kept active till audit completion: YES
5) Database records will not be cleared till audit completion: YES
6) Provided UAT setup is identical to production setup from integration and flow perspective: YES
7) Implementation of dual inquiry, i.e. Status API in response: YES
8) Attached audit checklist for integration process as well as security audit process has been implemented: YES

Please find our confirmation against the key audit points:

| Sr No | Key Point | Status |
| --- | --- | --- |
| 1 | Unique order ID generation - Order ID is generated uniquely | YES |
| 2 | Request tampering protection - amount and required transaction parameters are validated server-side and database-driven | YES |
| 3 | Response tampering protection - response and status validation are linked with current session / order reference | YES |
| 4 | URL redirection validation | YES |
| 5 | Duplicate entry validation | YES |
| 6 | Receipt / response generation | YES |
| 7 | Valid and secure SSL implementation | YES |

Website details:

| Field | Value |
| --- | --- |
| MERCHANT NAME | MADHURI ANIL DEULKAR (WEB) |
| Account Id | SG4798 |
| WEBSITE URL | `https://topperschoice.app` |
| Website URL is publicly accessible | YES |
| LOGIN ID | `<AUDIT LOGIN ID>` |
| LOGIN PWD | `<AUDIT LOGIN PASSWORD>` |
| RESPONSE URL | `https://topperschoice.app/payments/result` |
| ORDER STATUS API BASE URL | `https://api.topperschoice.app` |
| DEVELOPER CONTACT NO | `<DEVELOPER CONTACT NUMBER>` |
| DEVELOPER EMAIL ID | `<DEVELOPER EMAIL ID>` |
| TYPE | VAS |
| Programming Language | TypeScript / NestJS / Next.js |
| Plugin Name and Version (If Any) | Custom HDFC SmartGateway integration |
| Transaction Flow verified | YES |
| Multiple Amount Values (If Applicable) | YES |
| Transactions response is being stored in the database (including Failed) | YES |

Additional confirmation:

- Only test credentials will be used during audit.
- Test transactions created during UAT audit will not be honored as live orders.
- Transaction records, order status logs, and response records are being stored for audit validation.
- Status inquiry is implemented and used for payment reconciliation.
- Order status API logs are served from our backend deployment at https://api.topperschoice.app.

We will share the following along with this response:
- Step-by-step successful payment flow screenshots
- Order status API response logs
- Audit login credentials

Please let us know if you need any additional details from our side to proceed with the security audit.

Thanks & Regards,  
`<YOUR NAME>`  
Toppers' Choice  
Developer Contact: `<DEVELOPER CONTACT NUMBER>`  
Developer Email: `<DEVELOPER EMAIL ID>`
