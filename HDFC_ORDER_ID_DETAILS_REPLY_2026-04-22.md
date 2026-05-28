Subject: Re: Order ID / Database Details for HDFC Security Audit

Dear Sir,

Greetings from Toppers' Choice.

Please find below the requested transaction and database details for the shared order IDs.

We confirm that each order ID is generated uniquely and is stored once in our `payment_orders` table. Each listed order ID also has one linked transaction record in our `payment_transactions` table. The transaction status below is the current status stored in our database, and the timestamp column shows the transaction timestamp stored against the payment transaction.

| Order-ID | Transaction status | Transaction amounts | Number of times each order ID is stored in databased for each transaction | Timestamp of each transaction | Details of products associated with each order id (Product Name, Product Type etc.) |
| --- | --- | --- | --- | --- | --- |
| tcmo8dfztx1f985729 | PENDING (Provider status: NEW) | INR 4.99 | 1 | 2026-04-21 08:38:17 UTC | Product Name: Practice Premium 30 Days; Product Type: Subscription / VAS Plan; Duration: 30 days; Entitlement: Practice Premium; Plan Code: practice-premium-30d |
| tcmo9l2mjh78b43a10 | SUCCEEDED (Provider status: CHARGED) | INR 4.99 | 1 | 2026-04-22 05:00:56 UTC | Product Name: Practice Premium 30 Days; Product Type: Subscription / VAS Plan; Duration: 30 days; Entitlement: Practice Premium; Plan Code: practice-premium-30d |
| tcmo9l6t2j931218ca | FAILED (Provider status: AUTHORIZATION_FAILED) | INR 7.99 | 1 | 2026-04-22 05:03:26 UTC | Product Name: Notes + Guidance 60 Days; Product Type: Subscription / VAS Plan; Duration: 60 days; Entitlements: Notes Premium, Content Premium; Plan Code: notes-content-premium-60d |
| tcmo9l8wewb43ef73d | PENDING (Provider status: NEW) | INR 7.99 | 1 | 2026-04-22 05:04:29 UTC | Product Name: Notes + Guidance 60 Days; Product Type: Subscription / VAS Plan; Duration: 60 days; Entitlements: Notes Premium, Content Premium; Plan Code: notes-content-premium-60d |
| tcmo9l9umn57a3a2e3 | SUCCEEDED (Provider status: CHARGED) | INR 9.99 | 1 | 2026-04-22 05:05:54 UTC | Product Name: All Premium 90 Days; Product Type: Subscription / VAS Plan; Duration: 90 days; Entitlement: All Premium; Plan Code: all-premium-90d |
| tcmo9le8hz248848c4 | PENDING (Provider status: NEW) | INR 4.99 | 1 | 2026-04-22 05:08:38 UTC | Product Name: Practice Premium 30 Days; Product Type: Subscription / VAS Plan; Duration: 30 days; Entitlement: Practice Premium; Plan Code: practice-premium-30d |
| tcmo9lle2i33bfa48e | SUCCEEDED (Provider status: CHARGED) | INR 7.99 | 1 | 2026-04-22 05:15:32 UTC | Product Name: Notes + Guidance 60 Days; Product Type: Subscription / VAS Plan; Duration: 60 days; Entitlements: Notes Premium, Content Premium; Plan Code: notes-content-premium-60d |
| tcmo9lqvq67fcb1544 | SUCCEEDED (Provider status: CHARGED) | INR 4.99 | 1 | 2026-04-22 05:19:26 UTC | Product Name: Practice Premium 30 Days; Product Type: Subscription / VAS Plan; Duration: 30 days; Entitlement: Practice Premium; Plan Code: practice-premium-30d |

Additional confirmation:

- Duplicate order ID validation is implemented. Each merchant order ID is unique in the database.
- Amounts are stored in paise and displayed/sent as the exact INR transaction amount.
- Product/plan details are linked with each order ID through the subscribed plan record.
- Status inquiry records and transaction logs are retained for audit verification.

Please let us know if any additional database extract or transaction log is required.

Thanks & Regards,  
Toppers' Choice
