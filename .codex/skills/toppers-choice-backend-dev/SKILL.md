---
name: toppers-choice-backend-dev
description: Execution workflow and project conventions for the Topper's Choice NestJS backend repo. Use when working in this backend on platform setup, Prisma schema, site config, auth, authorization, taxonomy, files, notes, content, question bank, practice, tests, payments, CMS, analytics, notifications, search, admin ops, or tracker/doc updates.
---

# Toppers Choice Backend Dev

## Overview
Use the backend execution pack and repo conventions before changing code. Keep implementation aligned with the staged prompt sequence, the DB-first config model, and the modular backend architecture already documented for this repo.

## Quick Start
- Read `../../../references/00_master_index.md`.
- Read `../../../references/01_product/01_toppers_choice_product_understanding.md`.
- Read `../../../references/02_architecture/01_backend_kickoff_plan.md`.
- Read `../../../references/03_execution/00_master_index.md`.
- Open the current prompt file from `../../../references/03_execution/`.
- Reuse Dhurandhar backend patterns only after checking that they still fit Topper's Choice.

## Workflow
1. Identify the active backend step in `../../../references/03_execution/00_master_index.md`.
2. Open the matching prompt file and treat its scope as the current boundary.
3. Inspect the live code before editing; do not assume the scaffold still matches the prompt.
4. Implement the step end to end, including tests or verification commands that materially prove it works.
5. Update the backend execution tracker:
   - mark the current item `[~]` when starting real implementation
   - mark it `[x]` only after code, verification, and required doc updates are complete
6. If implementation changes architecture, update `../../../references/02_architecture/01_backend_kickoff_plan.md` in the same round.

## Backend Guardrails
- Preserve the modular monolith shape; avoid feature code in bootstrap files.
- Keep business and runtime configuration in database-backed settings, not env, unless it is a true secret or infrastructure primitive.
- Separate auth, authorization, and entitlements.
- Maintain public, student, and admin API boundaries explicitly.
- Keep storage private and serve files through controlled backend endpoints.
- Keep payment integrations provider-agnostic and config-driven.
- Add auditability for important admin actions.

## Verification
- Run the narrowest meaningful checks for the step you touched, then broaden only if needed.
- Prefer repo scripts such as `pnpm test`, `pnpm lint`, `pnpm build`, Prisma commands, or targeted e2e checks when they exist.
- Report what you verified, what you did not verify, and any assumptions that remain.

## Key References
- Execution tracker: `../../../references/03_execution/00_master_index.md`
- Step prompts: `../../../references/03_execution/*.md`
- Product context: `../../../references/01_product/01_toppers_choice_product_understanding.md`
- Backend architecture: `../../../references/02_architecture/01_backend_kickoff_plan.md`
- Dhurandhar backend reference repo: `/Users/raje/projects/Dhurandhar/dhurandhar-web-app-backend`
