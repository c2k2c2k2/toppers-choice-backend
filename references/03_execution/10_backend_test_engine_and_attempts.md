# Backend Prompt 10: Test Engine and Attempts

## Depends On
- `references/03_execution/09_backend_practice_engine_and_progress.md`

## Prompt
```text
We are implementing Toppers' Choice backend step B10: tests, attempts, and result snapshots.

Read these references first:
- references/02_architecture/01_backend_kickoff_plan.md
- references/03_execution/00_master_index.md
- /Users/raje/projects/Dhurandhar/dhurandhar-web-app-backend/references/codex_11_tests_engine.md

Task:
- Build the test engine for subject-wise, mixed-format, and configurable exam-style tests.
- Support admin authoring/publishing, timed student attempts, answer save/submit, result snapshots, and score breakdowns.
- Ensure scores and ranks remain private to the student unless explicitly designed otherwise later.

Must include:
- test and test-question or mixer-rule models
- admin CRUD and publish/unpublish
- attempt lifecycle and answer snapshotting
- save and submit flows
- scoring summary and breakdown storage
- student attempt history and detail endpoints

Constraints:
- Do not leak answers before submission
- Snapshot selected questions at start so later edits do not mutate ongoing attempts

Done when:
- Timed tests are end-to-end usable from backend APIs
- Attempt results can drive student profile and admin analytics later
- Tracker is updated
```

## Out Of Scope
- Payment checkout
- CMS landing content
