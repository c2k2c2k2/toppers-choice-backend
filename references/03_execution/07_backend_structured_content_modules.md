# Backend Prompt 07: Structured Content Modules

## Depends On
- `references/03_execution/06_backend_notes_preview_and_secure_streaming.md`

## Prompt
```text
We are implementing Toppers' Choice backend step B07: structured content modules for non-note learning content.

Read these references first:
- references/01_product/01_toppers_choice_product_understanding.md
- references/02_architecture/01_backend_kickoff_plan.md
- references/03_execution/00_master_index.md

Task:
- Implement the structured content foundation for Career Guidance, Interview Guidance, English Speaking, and Current Affairs / Monthly Updates.
- Use a reusable content model or tightly related modules so we do not duplicate publishing, visibility, featured ordering, media attachment, or track/medium classification logic.

Must include:
- content model(s) for article/lesson/feed style content
- admin CRUD, publish, feature, reorder, and schedule support
- public or student listing/detail APIs as appropriate
- exam-track and medium classification
- attachment or cover-image support via the file asset system
- content access rules for free vs premium where needed

Constraints:
- Do not force everything into PDF notes if article/lesson structure is a better fit
- Keep content renderer needs in mind for frontend reuse

Done when:
- All non-note content families have a clear backend home
- Admins can manage them without special-case ad hoc tables
- Tracker is updated
```

## Out Of Scope
- Question bank logic
- Student practice/test session flows

## Implementation Notes
- Guidance, interview guidance, and current affairs continue to use the shared `ContentEntry` foundation introduced in this step.
- English speaking now sits beside that foundation as a dedicated audio-first backend module with `EnglishSpeakingTopic`, `EnglishSpeakingSentence`, and `EnglishSpeakingSentenceAudio` tables so admins can generate preview audio, finalize approved output, and stream protected files through backend-controlled routes.
