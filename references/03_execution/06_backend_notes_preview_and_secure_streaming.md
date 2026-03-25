# Backend Prompt 06: Notes, Preview, and Secure Streaming

## Depends On
- `references/03_execution/05_backend_taxonomy_catalog_files_and_asset_delivery.md`

## Prompt
```text
We are implementing Topper's Choice backend step B06: notes, preview rules, and secure note delivery.

Read these references first:
- references/01_product/01_toppers_choice_product_understanding.md
- references/02_architecture/01_backend_kickoff_plan.md
- references/03_execution/00_master_index.md
- /Users/raje/projects/Dhurandhar/dhurandhar-web-app-backend/references/codex_08_notes_module_and_anti_piracy.md
- /Users/raje/projects/Dhurandhar/dhurandhar-web-app-backend/references/codex_09_entitlements_subscriptions.md

Task:
- Build the PDF-first notes module with free, preview, and premium access behavior.
- Add note-topic mapping, admin CRUD/publish workflows, student listing/tree endpoints, secure view sessions, watermark metadata, PDF range streaming, and progress tracking.
- Enforce preview rules without leaking premium access.

Must include:
- note entities plus note-topic mapping
- note publish/unpublish flows
- note tree/list/detail endpoints
- short-lived note view sessions and watermark payload endpoint
- secure content streaming with range support
- note progress tracking
- logging/security signals needed for later anti-piracy hardening

Constraints:
- Raw PDFs must never be publicly addressable
- Preview behavior must be explicit in data and policy, not scattered in controllers
- Keep entitlement hooks pluggable for the payment step

Done when:
- Students can browse free and previewable notes correctly
- Premium notes require entitlement or preview policy
- Tracker is updated
```

## Out Of Scope
- Full payment checkout
- Structured article-style content modules
