Subject: Re: Order ID / Database Details for HDFC Security Audit

Dear Sir,

Greetings from Topper's Choice.

Please find below the requested transaction and database details for the shared order IDs.

We confirm that each order ID is generated uniquely and is stored once in our `payment_orders` table. Each listed order ID also has one linked transaction record in our `payment_transactions` table. The transaction status below is the current status stored in our database, and the timestamp column shows the transaction timestamp stored against the payment transaction.

| Order-ID | Transaction status | Transaction amounts | Number of times each order ID is stored in databased for each transaction | Timestamp of each transaction | Details of products associated with each order id (Product Name, Product Type etc.) |
| --- | --- | --- | --- | --- | --- |
| tcmoa461wv629432cd | SUCCEEDED (Provider status: CHARGED) | INR 4.99 | 1 | 2026-04-22 13:54:42 UTC | Product Name: Practice Premium 30 Days; Product Type: Subscription / VAS Plan; Duration: 30 days; Entitlement: Practice Premium; Plan Code: practice-premium-30d |
| tcmoa47cwcb97e857a | FAILED (Provider status: AUTHORIZATION_FAILED) | INR 7.99 | 1 | 2026-04-22 13:55:37 UTC | Product Name: Notes + Guidance 60 Days; Product Type: Subscription / VAS Plan; Duration: 60 days; Entitlements: Notes Premium, Content Premium; Plan Code: notes-content-premium-60d |
| tcmoa48zje033518c5 | FAILED (Provider status: AUTHORIZATION_FAILED) | INR 9.99 | 1 | 2026-04-22 13:56:51 UTC | Product Name: All Premium 90 Days; Product Type: Subscription / VAS Plan; Duration: 90 days; Entitlement: All Premium; Plan Code: all-premium-90d |
| tcmoa4alm183990588 | FAILED (Provider status: AUTHORIZATION_FAILED) | INR 7.99 | 1 | 2026-04-22 13:58:08 UTC | Product Name: Notes + Guidance 60 Days; Product Type: Subscription / VAS Plan; Duration: 60 days; Entitlements: Notes Premium, Content Premium; Plan Code: notes-content-premium-60d |
| tcmoa4cc432b6818d0 | FAILED (Provider status: AUTHORIZATION_FAILED) | INR 7.99 | 1 | 2026-04-22 13:59:33 UTC | Product Name: Notes + Guidance 60 Days; Product Type: Subscription / VAS Plan; Duration: 60 days; Entitlements: Notes Premium, Content Premium; Plan Code: notes-content-premium-60d |
| tcmoa4eftf63f966dc | SUCCEEDED (Provider status: CHARGED) | INR 7.99 | 1 | 2026-04-22 14:01:12 UTC | Product Name: Notes + Guidance 60 Days; Product Type: Subscription / VAS Plan; Duration: 60 days; Entitlements: Notes Premium, Content Premium; Plan Code: notes-content-premium-60d |
| tcmoa4fogq85a4c9ad | PENDING (Provider status: NEW) | INR 9.99 | 1 | 2026-04-22 14:01:38 UTC | Product Name: All Premium 90 Days; Product Type: Subscription / VAS Plan; Duration: 90 days; Entitlement: All Premium; Plan Code: all-premium-90d |
| tcmoa4jgbudf06e88e | PENDING (Provider status: NEW) | INR 7.99 | 1 | 2026-04-22 14:04:34 UTC | Product Name: Notes + Guidance 60 Days; Product Type: Subscription / VAS Plan; Duration: 60 days; Entitlements: Notes Premium, Content Premium; Plan Code: notes-content-premium-60d |

Additional confirmation:

- Duplicate order ID validation is implemented. Each merchant order ID is unique in the database.
- Amounts are stored in paise and displayed/sent as the exact INR transaction amount.
- Product/plan details are linked with each order ID through the subscribed plan record.
- Status inquiry records and transaction logs are retained for audit verification.

Please let us know if any additional database extract or transaction log is required.

Thanks & Regards,  
Topper's Choice
