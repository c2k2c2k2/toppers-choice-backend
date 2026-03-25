# Backend Prompt 11: Plans, Entitlements, and Payment Adapter

## Depends On
- `references/03_execution/10_backend_test_engine_and_attempts.md`

## Prompt
```text
We are implementing Topper's Choice backend step B11: plans, entitlements, and provider-agnostic payment integration.

Read these references first:
- references/01_product/01_toppers_choice_product_understanding.md
- references/02_architecture/01_backend_kickoff_plan.md
- references/03_execution/00_master_index.md
- /Users/raje/projects/Dhurandhar/dhurandhar-web-app-backend/references/codex_09_entitlements_subscriptions.md
- /Users/raje/projects/Dhurandhar/dhurandhar-web-app-backend/references/codex_13_payments_phonepe_v1.md

Task:
- Implement plans, subscriptions, entitlements, manual admin overrides, and a provider-agnostic payment adapter.
- Start with one provider implementation pattern, but make gateway selection and non-secret provider behavior dynamic for future HDFC or other providers.
- Support free, preview, and premium access decisions across notes, practice, tests, and structured content.

Must include:
- plan, subscription, entitlement, payment order, payment transaction, payment event models
- admin grant/revoke path independent of checkout
- generic payment provider adapter interface
- one real provider integration path scaffolded cleanly
- checkout creation, status polling, callback handling, and reconciliation basics
- entitlement resolution service used by policies

Constraints:
- Frontend should not depend on provider-specific response shapes
- Secrets stay in env or secret manager; provider selection and business rules stay in DB-driven config

Done when:
- Paid access can be granted through checkout or manual admin action
- Payment provider swapping is architecturally prepared
- Tracker is updated
```

## Out Of Scope
- Full analytics dashboards
- Notification and CMS resolver details
