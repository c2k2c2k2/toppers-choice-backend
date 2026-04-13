# Backend Kickoff Plan

## Summary
The backend will be a NestJS modular monolith with PostgreSQL and Prisma. It must support public landing content, student learning workflows, admin operations, dynamic configuration, and provider-agnostic payments while keeping secrets in env and runtime business settings in the database.

## Core Backend Modules
- Site and site settings
- Auth
- Authorization
- Users
- Taxonomy
- Content
- Notes
- Question bank
- Practice
- Test engine
- Payments
- CMS
- Analytics
- Notifications
- Admin operations
- Health and infrastructure

## Data Model Groups
- Master data: site, site config versions, exam track, medium, subject, topic, tag, roles, permissions, plans, payment gateway
- Content data: notes, content pieces, banners, announcements, pages, home sections
- Assessment data: questions, options, tests, attempts, practice sessions, progress aggregates
- Access and commerce data: users, refresh sessions, entitlements, subscriptions, payment orders, transactions, events, audit logs

## API And Contract Strategy
- REST-first under `/api/v1`
- Swagger or OpenAPI as the source of truth for frontend contracts
- Separate public, student, and admin endpoints by access pattern
- Use versioned config and publish workflows for dynamic site and CMS content
- Expose a public bootstrap endpoint for non-sensitive site identity and published runtime metadata
- Resolve dynamic home and landing sections server-side

## Env Versus Database Rule
Keep in env or secret manager only:
- database connection
- JWT secrets
- Redis connection
- storage credentials
- payment credentials
- SMTP credentials

Move to database-driven configuration:
- branding and support details
- site identity and public bootstrap metadata
- payment provider selection
- pricing presentation and preview rules
- auth token lifetimes and password reset throttles
- throttles and business settings where safe
- landing and student-home section configuration
- feature flags and publishable runtime settings

## Foundation Baseline Notes
- `Site` plus versioned `SiteConfigVersion` records provide the first DB-backed runtime config seam for future multi-site support while keeping V1 on one explicit default site.
- Health uses separate liveness and readiness checks, where readiness reflects database availability instead of assuming the app is fully ready when Nest boots.
- Request IDs, global validation, consistent API errors, and Swagger are treated as platform infrastructure rather than feature-module concerns.
- Auth token lifetimes and password-reset challenge limits are runtime config data in internal site config, while JWT signing secrets remain environment-managed secrets.
- Authorization is DB-backed through site-scoped roles, global permission keys, role assignments, and direct user permission overrides, so admin types remain dynamic instead of code-enum locked.
- Admin write routes should use policy metadata plus audit metadata rather than controller-local permission branches, keeping access control and audit capture reusable across modules.
- Taxonomy is modeled as site-scoped master data with explicit ordering, slugs, visibility, and active state so landing, student, CMS, and assessment modules can reuse the same catalog foundation.
- Private file assets use database metadata plus MinIO-backed object storage, with upload initialization and all read delivery flowing through backend APIs so raw bucket URLs never become product contracts.
- Generic file assets intentionally separate upload metadata from future content-reference authorization, allowing later modules to decide whether an asset is public, authenticated, or entitlement-protected without changing the storage provider seam.
- Notes use dedicated preview PDF assets, short-lived note view sessions, and signed watermark payloads so premium preview rules stay explicit in data and raw source PDFs never become publicly addressable.
- Structured non-note reading content uses one reusable `ContentEntry` foundation with family, format, schedule-aware publishing, featured ordering, exam-track/medium classification, and file attachments so guidance, interview guidance, and current-affairs content do not fork into ad hoc tables, while English speaking lives in its own topic, sentence, and generated-audio models because preview, regeneration, and finalize-to-storage are the primary authoring workflow.
- The question bank keeps prompts, options, explanations, and import-friendly metadata reusable in one authoring model, with explicit media-reference rows and student-safe response shaping so future practice and test engines can share content without exposing answer keys.
- Practice uses explicit student-owned sessions, per-session served-question state, append-only interaction events, and per-question/per-subject/per-topic aggregates so dashboards and future analytics can reuse progress data without mixing practice flow into the test engine.
- Tests use authored fixed question sets plus immutable per-attempt question snapshots, so timed submissions, score breakdowns, and later analytics stay stable even if the source question bank is edited after an attempt begins.
- Plans and premium access use site-scoped `Plan` plus `PlanEntitlement` templates, explicit `Subscription` and `Entitlement` grant rows, and normalized `PaymentOrder`/`PaymentTransaction`/`PaymentEvent` records behind a provider adapter so notes, structured content, English speaking, practice, and tests all resolve access through one entitlement service while checkout remains swappable across providers.
- CMS uses site-scoped `CmsPage`, `CmsBanner`, `CmsAnnouncement`, and `CmsSection` records with publish-state and surface/placement metadata, so landing and student home resolvers stay DB-managed instead of drifting into hardcoded frontend content.
- Notifications use `NotificationTemplate`, `NotificationBroadcast`, `NotificationMessage`, and `NotificationPreference` rows so in-app delivery works immediately while email/SMS remain future provider seams rather than controller rewrites.
- Dashboard analytics, grouped search, and admin ops intentionally read from the normalized transactional tables first instead of waiting for a separate warehouse layer, keeping launch reporting and operational support available without a second data pipeline.
- High-risk launch flows use lightweight hardening primitives: DB-backed idempotency records for retry-safe checkout and broadcast dispatch, route-level throttling on search endpoints, CSV export limits from runtime config, and admin visibility into note security signals.

## Backend Development Order
1. Foundation, Prisma, site config, health, request context, Swagger
2. Auth, sessions, OTP, password reset, mixed student and admin access
3. RBAC and UBAC policy system with audit logging
4. Taxonomy, exam tracks, mediums, and catalog foundations
5. Notes with preview, watermarking, and secure streaming
6. Structured guidance content modules
7. Question bank
8. Practice engine and progress
9. Test engine and attempts
10. Plans, entitlements, payment adapter, and checkout flow
11. CMS, landing resolver, student-home resolver
12. Notifications, analytics, search, admin ops, and hardening

## Backend Acceptance Focus
- Dynamic settings work without redeploy
- Public, student, and admin APIs are clearly separated
- Premium preview rules are enforced safely
- Payment provider can be swapped behind an adapter
- Admin can grant or revoke access manually even with payment flow enabled
- Core learning content and assessment engines remain reusable for future SaaS evolution
