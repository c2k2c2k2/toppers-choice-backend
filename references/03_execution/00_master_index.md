# Backend Execution Master Index

**Legend**
- [ ] Not started
- [~] In progress
- [x] Done

## Context Already Completed
- [x] `references/01_product/01_toppers_choice_product_understanding.md`
- [x] `references/02_architecture/01_backend_kickoff_plan.md`

## Recommended Cross-Repo Run Order
1. `B01` Backend platform foundation and conventions
2. `B02` Backend site settings, seeds, and runtime config
3. `F01` Frontend foundation, routing, query, and Zustand
4. `F02` Frontend design system, PWA, and legacy Marathi fonts
5. `F03` Frontend public landing and CMS surface
6. `B03` Backend auth, students, admins, and sessions
7. `B04` Backend authorization, roles, permissions, and audit
8. `F04` Frontend auth session bootstrap and guards
9. `B05` Backend taxonomy, catalog, files, and asset delivery
10. `F05` Frontend student shell, dashboard, and catalog
11. `B06` Backend notes, preview, and secure streaming
12. `F06` Frontend notes library, preview, and secure reader
13. `B07` Backend structured content modules
14. `F07` Frontend guidance, English speaking, and current affairs
15. `B08` Backend question bank and media
16. `B09` Backend practice engine and progress
17. `B10` Backend test engine and attempts
18. `F08` Frontend practice and tests student experience
19. `B11` Backend plans, entitlements, and payment adapter
20. `F09` Frontend plans, payments, entitlements, and preview UX
21. `B12` Backend CMS, notifications, analytics, search, and admin ops
22. `F10` Frontend admin shell, shared CRUD, and CMS
23. `F11` Frontend admin content, assessments, users, and ops
24. `F12` Frontend gap analysis, QA, and release hardening

## Backend Prompt Sequence
- [x] `references/03_execution/01_backend_platform_foundation_and_conventions.md`
- [x] `references/03_execution/02_backend_site_settings_and_seed_baseline.md`
- [x] `references/03_execution/03_backend_auth_students_admins_and_sessions.md`
- [x] `references/03_execution/04_backend_authorization_roles_permissions_and_audit.md`
- [x] `references/03_execution/05_backend_taxonomy_catalog_files_and_asset_delivery.md`
- [x] `references/03_execution/06_backend_notes_preview_and_secure_streaming.md`
- [ ] `references/03_execution/07_backend_structured_content_modules.md`
- [ ] `references/03_execution/08_backend_question_bank_and_media.md`
- [ ] `references/03_execution/09_backend_practice_engine_and_progress.md`
- [ ] `references/03_execution/10_backend_test_engine_and_attempts.md`
- [ ] `references/03_execution/11_backend_plans_entitlements_and_payment_adapter.md`
- [ ] `references/03_execution/12_backend_cms_notifications_analytics_search_and_admin_ops.md`

## Tracker Rules
- Mark a prompt `[~]` when work starts and `[x]` only when implementation, verification, and any required reference updates are finished.
- Keep only one backend prompt `[~]` at a time.
- If a prompt is blocked, add a short note under the prompt file instead of silently skipping it.
- When a step materially changes architecture, update `references/02_architecture/01_backend_kickoff_plan.md` in the same implementation round.
