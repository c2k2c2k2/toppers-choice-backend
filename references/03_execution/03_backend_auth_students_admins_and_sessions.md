# Backend Prompt 03: Auth, Students, Admins, and Sessions

## Depends On
- `references/03_execution/02_backend_site_settings_and_seed_baseline.md`

## Prompt
```text
We are implementing Toppers' Choice backend step B03: authentication and user identity lifecycle.

Read these references first:
- references/01_product/01_toppers_choice_product_understanding.md
- references/02_architecture/01_backend_kickoff_plan.md
- references/03_execution/00_master_index.md
- /Users/raje/projects/Dhurandhar/dhurandhar-web-app-backend/references/codex_03_authentication.md
- /Users/raje/projects/Dhurandhar/dhurandhar-web-app-backend/references/codex_05_users_admin_audit.md

Task:
- Implement the shared identity model for students and admins.
- Support both self-signup students and admin-created student accounts.
- Add JWT access and refresh token flow, refresh rotation, logout, `me`, session listing, OTP/password reset foundation, and basic profile endpoints.

Must include:
- `User`, `StudentProfile` if needed, `RefreshSession`, OTP/reset support models
- self-signup route and admin-created user path
- login, refresh, logout, me, current sessions
- password hashing and refresh token hashing
- user type separation for STUDENT and ADMIN
- baseline user profile endpoints for current user

Constraints:
- Keep auth provider-agnostic for later replacement
- Do not mix role/permission rules into auth logic
- Do not implement frontend-specific behavior in the API

Done when:
- Student self-signup works
- Admin and student login both work against the same auth subsystem
- Refresh rotation and logout are safe and test-covered
- Tracker is updated
```

## Out Of Scope
- Fine-grained authorization
- Admin user management workflows beyond what auth requires
