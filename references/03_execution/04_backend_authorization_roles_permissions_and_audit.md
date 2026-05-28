# Backend Prompt 04: Authorization, Roles, Permissions, and Audit

## Depends On
- `references/03_execution/03_backend_auth_students_admins_and_sessions.md`

## Prompt
```text
We are implementing Toppers' Choice backend step B04: authorization, audit, and admin access control.

Read these references first:
- references/02_architecture/01_backend_kickoff_plan.md
- references/03_execution/00_master_index.md
- /Users/raje/projects/Dhurandhar/dhurandhar-web-app-backend/references/codex_04_authorization_rbac_ubac.md
- /Users/raje/projects/Dhurandhar/dhurandhar-web-app-backend/references/codex_05_users_admin_audit.md

Task:
- Build the RBAC + UBAC layer for the whole backend.
- Add roles, permissions, user-role assignment, optional user overrides, audit logging, admin-only route protection, and policy-based route guards.
- Seed initial admin roles aligned to Toppers' Choice operations.

Must include:
- `Role`, `Permission`, `UserRole`, and optional direct user permission overrides
- central policy guard/decorator pattern
- admin-only access gate by user type plus permission
- audit log model and reusable audit metadata capture
- seeded roles such as super admin, content admin, academic admin, finance admin, support admin

Constraints:
- Keep entitlement checks separate but compatible with the policy engine
- Avoid ad-hoc permission checks inside controllers

Done when:
- Admin routes can be protected consistently
- Audit logging exists for important admin actions
- Seeded roles and permission keys are available for later frontend gating
- Tracker is updated
```

## Out Of Scope
- Content modules themselves
- Student commerce entitlements
