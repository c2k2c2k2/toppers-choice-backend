Subject: Re: Order ID / Database Details for HDFC Security Audit

Dear Sir,

Greetings from Toppers' Choice.

Please find below the requested transaction and database details for the shared order IDs.

We confirm that each order ID is generated uniquely and is stored once in our `payment_orders` table. Each listed order ID also has one linked transaction record in our `payment_transactions` table. The transaction status below is the current status stored in our database, and the timestamp column shows the transaction timestamp stored against the payment transaction.

| Order-ID | Transaction status | Transaction amounts | Number of times each order ID is stored in databased for each transaction | Timestamp of each transaction | Details of products associated with each order id (Product Name, Product Type etc.) |
| --- | --- | --- | --- | --- | --- |
| tcmocf2rw0989095da | SUCCEEDED (Provider status: CHARGED) | INR 4.99 | 1 | 2026-04-24 04:36:27 UTC | Product Name: Practice Premium 30 Days; Product Type: Subscription / VAS Plan; Duration: 30 days; Entitlement: Practice Premium; Plan Code: practice-premium-30d |
| tcmocf5pi761167d17 | PENDING (Provider status: NEW) | INR 7.99 | 1 | 2026-04-24 04:37:21 UTC | Product Name: Notes + Guidance 60 Days; Product Type: Subscription / VAS Plan; Duration: 60 days; Entitlements: Notes Premium, Content Premium; Plan Code: notes-content-premium-60d |
| tcmocf8o67144a10d9 | PENDING (Provider status: NEW) | INR 4.99 | 1 | 2026-04-24 04:39:39 UTC | Product Name: Practice Premium 30 Days; Product Type: Subscription / VAS Plan; Duration: 30 days; Entitlement: Practice Premium; Plan Code: practice-premium-30d |
| tcmocfaq2nf34a758c | FAILED (Provider status: AUTHORIZATION_FAILED) | INR 7.99 | 1 | 2026-04-24 04:41:47 UTC | Product Name: Notes + Guidance 60 Days; Product Type: Subscription / VAS Plan; Duration: 60 days; Entitlements: Notes Premium, Content Premium; Plan Code: notes-content-premium-60d |
| tcmocfcevqbecf9a6c | FAILED (Provider status: AUTHORIZATION_FAILED) | INR 9.99 | 1 | 2026-04-24 04:42:59 UTC | Product Name: All Premium 90 Days; Product Type: Subscription / VAS Plan; Duration: 90 days; Entitlement: All Premium; Plan Code: all-premium-90d |
| tcmocfdp524142aa79 | SUCCEEDED (Provider status: CHARGED) | INR 4.99 | 1 | 2026-04-24 04:44:06 UTC | Product Name: Practice Premium 30 Days; Product Type: Subscription / VAS Plan; Duration: 30 days; Entitlement: Practice Premium; Plan Code: practice-premium-30d |
| tcmocfhcdq736e5bbd | PENDING (Provider status: NEW) | INR 9.99 | 1 | 2026-04-24 04:46:24 UTC | Product Name: All Premium 90 Days; Product Type: Subscription / VAS Plan; Duration: 90 days; Entitlement: All Premium; Plan Code: all-premium-90d |
| tcmocfiaffc8e452a1 | SUCCEEDED (Provider status: CHARGED) | INR 7.99 | 1 | 2026-04-24 04:48:24 UTC | Product Name: Notes + Guidance 60 Days; Product Type: Subscription / VAS Plan; Duration: 60 days; Entitlements: Notes Premium, Content Premium; Plan Code: notes-content-premium-60d |

Additional confirmation:

- Duplicate order ID validation is implemented. Each merchant order ID is unique in the database.
- Amounts are stored in paise and displayed/sent as the exact INR transaction amount.
- Product/plan details are linked with each order ID through the subscribed plan record.
- Status inquiry records and transaction logs are retained for audit verification.

Please let us know if any additional database extract or transaction log is required.

Thanks & Regards,  
Toppers' Choice
