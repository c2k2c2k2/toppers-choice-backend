# Backend Prompt 08: Question Bank and Media

## Depends On
- `references/03_execution/07_backend_structured_content_modules.md`

## Prompt
```text
We are implementing Topper's Choice backend step B08: question bank authoring and media support.

Read these references first:
- references/02_architecture/01_backend_kickoff_plan.md
- references/03_execution/00_master_index.md
- /Users/raje/projects/Dhurandhar/dhurandhar-web-app-backend/references/codex_10_question_bank_and_media.md

Task:
- Build the reusable question bank used by practice papers and tests.
- Support multiple question types, localized content blocks, media attachments, explanations, publish workflows, and taxonomy links.
- Keep the data model ready for legacy Marathi content handling on the frontend without baking frontend rendering logic into the backend.

Must include:
- question entities, options, explanation, metadata, and media references
- admin CRUD and publish/unpublish endpoints
- import-friendly DTO design for future bulk upload
- support for localized or multilingual content payloads
- question filtering by track, medium, subject, topic, difficulty, and publication state

Constraints:
- Correct answers must not leak in student-facing APIs
- Keep authoring and student delivery shapes intentionally separated if needed

Done when:
- Questions are reusable across practice and tests
- Admin authoring endpoints are ready for frontend integration
- Tracker is updated
```

## Out Of Scope
- Practice session algorithms
- Timed test attempt lifecycle
