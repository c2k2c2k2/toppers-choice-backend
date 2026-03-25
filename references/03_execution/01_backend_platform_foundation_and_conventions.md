# Backend Prompt 01: Platform Foundation and Conventions

## Depends On
- `references/01_product/01_toppers_choice_product_understanding.md`
- `references/02_architecture/01_backend_kickoff_plan.md`

## Prompt
```text
We are implementing Topper's Choice backend step B01: platform foundation and conventions.

Read these references first:
- references/01_product/01_toppers_choice_product_understanding.md
- references/02_architecture/01_backend_kickoff_plan.md
- references/03_execution/00_master_index.md
- /Users/raje/projects/Dhurandhar/dhurandhar-web-app-backend/references/codex_01_project_decisions_and_architecture.md
- /Users/raje/projects/Dhurandhar/dhurandhar-web-app-backend/references/codex_02_foundation_bootstrap.md

Task:
- Upgrade the NestJS scaffold into a production-ready modular backend foundation.
- Add the shared backend structure for common, infra, and modules without implementing domain-heavy features yet.
- Add PostgreSQL + Prisma baseline, config bootstrap, env validation for only true infrastructure secrets, request ID propagation, global validation, consistent error shape, and Swagger/OpenAPI bootstrap.
- Add a health endpoint and a basic readiness check.
- Keep environment variable usage minimal and aligned with the architecture docs.

Must include:
- Folder structure for `common`, `infra`, and initial `modules`
- Prisma setup and starter schema scaffold
- ConfigModule bootstrap with validation
- global `ValidationPipe` and error handling
- request ID middleware/interceptor
- Swagger available for contract work
- health controller/service
- basic test/bootstrap sanity so future modules have a clean base

Constraints:
- Do not hardcode business config in env
- Do not copy Dhurandhar blindly; adapt only the patterns
- Keep the work focused on foundation, not domain modules

Done when:
- The backend boots cleanly with health and Swagger
- Prisma is integrated and ready for later schema expansion
- Shared module structure exists for future steps
- references/03_execution/00_master_index.md is updated from `[ ]` to `[x]` for B01 and B02 is marked `[~]` only if you immediately continue
```

## Out Of Scope
- Auth flows
- Business entities beyond the minimum Prisma baseline
- Storage, payments, CMS, or content logic
