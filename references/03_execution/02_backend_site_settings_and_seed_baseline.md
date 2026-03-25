# Backend Prompt 02: Site Settings and Seed Baseline

## Depends On
- `references/03_execution/01_backend_platform_foundation_and_conventions.md`

## Prompt
```text
We are implementing Topper's Choice backend step B02: site settings, site-aware configuration, and seed baseline.

Read these references first:
- references/02_architecture/01_backend_kickoff_plan.md
- references/03_execution/00_master_index.md
- /Users/raje/projects/Dhurandhar/dhurandhar-web-app-backend/src/modules/site-settings/site-settings.service.ts
- /Users/raje/projects/Dhurandhar/dhurandhar-web-app-backend/references/codex_15_cms_dynamic_content.md

Task:
- Create the site-aware runtime configuration foundation for a SaaS-ready but single-site V1.
- Add core models and services for `Site`, versioned site config/app config, and publishable runtime settings.
- Seed one default Topper's Choice site and the minimum foundational settings needed by later modules.
- Make business config database-driven wherever possible, with env fallback only for true infrastructure or secret values.

Must include:
- `Site` model and default site seeding
- versioned config model(s) for publishable runtime settings
- cache-aware settings service for safe runtime reads
- initial public bootstrap endpoint for site identity and non-sensitive site metadata
- seed path for default site, initial roles placeholder, and baseline config records
- clear boundary between env secrets and DB-managed settings

Constraints:
- Build for future multi-site seams without implementing full tenant routing
- Keep the default site explicit and queryable
- Do not overload this step with CMS content entities yet

Done when:
- Later modules can read site-aware runtime config through a single service
- A seeded default site exists
- Public bootstrap metadata can be resolved without hardcoded constants
- Tracker is updated
```

## Out Of Scope
- Full CMS entities
- Auth or permissions logic
- Payment provider integration
