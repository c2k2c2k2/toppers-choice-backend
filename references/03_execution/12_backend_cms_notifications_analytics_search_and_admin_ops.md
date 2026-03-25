# Backend Prompt 12: CMS, Notifications, Analytics, Search, and Admin Ops

## Depends On
- `references/03_execution/11_backend_plans_entitlements_and_payment_adapter.md`

## Prompt
```text
We are implementing Topper's Choice backend step B12: CMS, notifications, analytics, search, admin ops, and release hardening.

Read these references first:
- references/02_architecture/01_backend_kickoff_plan.md
- references/03_execution/00_master_index.md
- /Users/raje/projects/Dhurandhar/dhurandhar-web-app-backend/references/codex_15_cms_dynamic_content.md
- /Users/raje/projects/Dhurandhar/dhurandhar-web-app-backend/references/codex_16_analytics.md
- /Users/raje/projects/Dhurandhar/dhurandhar-web-app-backend/references/codex_18_admin_ops_and_hardening.md
- /Users/raje/projects/Dhurandhar/dhurandhar-web-app-backend/references/codex_19_notifications.md
- /Users/raje/projects/Dhurandhar/dhurandhar-web-app-backend/references/codex_20_search_v1.md

Task:
- Complete the dynamic and operational backend surface needed for launch.
- Implement landing/student CMS, pages, banners, announcements, site-managed sections, notifications, analytics summaries, search endpoints, admin exports, and operational hardening.
- Finish with contract cleanup, docs alignment, and test coverage for critical flows.

Must include:
- CMS entities and public/student/admin resolver APIs
- notification templates/messages/broadcast foundation
- analytics endpoints needed for student and admin dashboards
- search endpoints for public and admin discovery where needed
- admin ops/export/support actions
- contract verification and docs updates for any architecture drift
- hardening around throttling, idempotency, and audit visibility

Constraints:
- Do not bury core configuration in hardcoded frontend content
- Keep launch scope focused on the endpoints actually needed by the planned frontend

Done when:
- Backend supports landing, student, and admin surfaces end to end
- High-risk flows have tests and operational visibility
- Tracker is updated with all backend steps complete
```

## Out Of Scope
- Frontend implementation
