# Backend Prompt 05: Taxonomy, Catalog, Files, and Asset Delivery

## Depends On
- `references/03_execution/04_backend_authorization_roles_permissions_and_audit.md`

## Prompt
```text
We are implementing Toppers' Choice backend step B05: taxonomy foundation, file assets, and secure asset delivery.

Read these references first:
- references/02_architecture/01_backend_kickoff_plan.md
- references/03_execution/00_master_index.md
- /Users/raje/projects/Dhurandhar/dhurandhar-web-app-backend/references/codex_06_taxonomy_subjects_topics.md
- /Users/raje/projects/Dhurandhar/dhurandhar-web-app-backend/references/codex_07_files_minio_assets.md

Task:
- Implement the catalog foundation used by the entire product: exam tracks, mediums, subjects, topics, tags, visibility, and ordering.
- Implement private object-storage file asset handling with metadata in the database.
- Add secure asset delivery APIs so raw bucket URLs are never exposed.

Must include:
- taxonomy models and admin/public APIs
- ordering, slugs, visibility, and active/inactive handling
- file asset model with purpose classification
- init-upload, confirm-upload, and secure asset delivery endpoints
- site-aware object key strategy and purpose-based validation
- support for PDFs and images needed by notes, CMS, questions, and profile assets

Constraints:
- Bucket/object store must stay private
- Keep files generic so multiple modules can reuse the same asset system
- Build asset authorization for future published/public vs protected content checks

Done when:
- Admins can create taxonomy and upload assets through a reusable file system
- Public and protected assets can be resolved through backend endpoints
- Tracker is updated
```

## Out Of Scope
- Notes logic
- Question bank authoring
