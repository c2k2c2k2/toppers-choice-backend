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

## Implementation Notes
- Question rich-content payloads now preserve the Dhurandhar editor contract on the backend by sanitizing nested `html` fields with an allowlist that keeps legacy Marathi font spans, table markup, and `data-question-math-*` attributes intact.
- Question search indexing now extracts human-readable text from rich question HTML, including LaTeX stored inside inline and block math nodes, so admin search remains useful for mathematical questions and legacy Marathi authoring payloads.
- Admin question summaries now expose a clean statement preview text for list-first CRUD screens, question deletion is supported with safety checks for already-used practice/test records, and student/practice visibility now treats `mediumId = null` questions as shared across mediums instead of hiding them behind a selected medium.
- Question publish validation now enforces question code presence, active taxonomy links, and complete active-language statement/option content before a record can move to `PUBLISHED`, so admin-side checklists and backend rules stay aligned.
- Question create/update conflict handling now returns a question-specific code conflict instead of a generic unique-constraint error when duplicate question codes are submitted.

## Verification Notes
- Re-verified with `pnpm build` and focused question-module eslint after adding question rich-content sanitization plus search-fragment extraction parity with the Dhurandhar backend flow.
- Re-verified with `pnpm build` after adding question statement preview summaries, guarded admin delete support, and shared-medium practice question visibility.
- Re-verified with `pnpm build` after tightening publish validation for question codes, active taxonomy, and active-language completeness.
