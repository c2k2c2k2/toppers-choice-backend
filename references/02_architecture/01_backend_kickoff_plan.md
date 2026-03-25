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
