# Backend Prompt 09: Practice Engine and Progress

## Depends On
- `references/03_execution/08_backend_question_bank_and_media.md`

## Prompt
```text
We are implementing Toppers' Choice backend step B09: practice engine and student progress.

Read these references first:
- references/02_architecture/01_backend_kickoff_plan.md
- references/03_execution/00_master_index.md
- /Users/raje/projects/Dhurandhar/dhurandhar-web-app-backend/references/codex_12_practice_engine_and_progress.md

Task:
- Build the topic-wise and mixed practice engine using the reusable question bank.
- Add practice session lifecycle, selection logic, answer events, progress aggregates, weak-area reporting, and entitlement-aware access control.

Must include:
- practice session model and APIs
- question selection rules with scope filters
- answer/save/reveal event logging
- per-topic/per-subject progress summaries
- weak questions and trend endpoints
- privacy-safe student ownership checks

Constraints:
- Practice and test logic must stay separate
- Avoid premature over-optimization; correctness and clean data flow first

Done when:
- Students can start practice, answer, progress, and review summaries
- Progress data is reusable for dashboard and analytics
- Tracker is updated
```

## Out Of Scope
- Timed fixed tests
- Payments
