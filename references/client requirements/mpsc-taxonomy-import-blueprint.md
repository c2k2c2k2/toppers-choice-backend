# MPSC Taxonomy Import Blueprint

## Purpose
This file is the operational blueprint for entering the MPSC syllabus data into the current Topper's Choice system without weakening downstream filters for notes, questions, tests, or structured content.

## Confirmed Modeling Decision
- `MPSC - English Medium` and `एमपीएससी व तत्सम स्पर्धा परीक्षा` are separate exam tracks.
- `medium` remains a separate filter dimension and does not change the subject or topic tree.
- Subject and topic records are owned by an exam track through `subject.examTrackId`.

## Why This Fits The Current System
- The backend taxonomy model is `examTrack -> subject -> topic`.
- `medium` is currently attached to notes, questions, tests, practice sessions, and structured content classification.
- The frontend student and admin catalog flows already resolve subjects by track, then apply medium separately.

## Important Data-Entry Rules
- Create the two MPSC exam tracks first, before entering MPSC subjects or topics.
- Create global mediums once and reuse them across all tracks.
- Use the subject record from the correct track when creating notes, questions, tests, or practice data.
- For MPSC-specific notes, questions, and tests, prefer an explicit `mediumId` instead of leaving it `null`.
- Keep `topicId` empty when the client did not provide reliable topic breakdown.
- Do not invent topic trees for `Marathi Grammar`, `Reasoning`, or `Mathematics` where the source has not provided them.
- Treat any syllabus that says "refer to another track" as deferred until we decide whether to duplicate that topic tree or keep the subject flat.

## Naming Policy
- The current taxonomy schema has one `name` field for exam tracks, subjects, and topics.
- For Marathi-track subjects and topics, the draft keeps Marathi in `name` and preserves English in `englishName` only inside the canonical draft JSON.
- If we later want localized taxonomy labels in the product, that is a separate schema and API enhancement and should not be mixed into this data-entry round.

## Content-Type Implications
- `notes`: single `subjectId`, optional single `mediumId`, optional many topics under one subject.
- `questions`: single `subjectId`, optional single `mediumId`, optional single `topicId`.
- `tests`: optional single track, medium, and subject scope.
- `structured content`: can link many exam tracks and many mediums, so it is more reusable than notes/questions.

## Import Order
1. Create mediums:
   - `en` / `english`
   - `mr` / `marathi`
2. Create exam tracks:
   - `mpsc-english-medium`
   - `mpsc-marathi-allied`
3. Create MPSC English subjects.
4. Create only the MPSC English topics marked `FULL` in the canonical draft.
5. Create MPSC Marathi subjects.
6. Create only the MPSC Marathi topics marked `FULL` in the canonical draft.
7. Leave all `DEFERRED` subjects topic-less until their shared-source strategy is explicitly approved.

## MPSC English Entry Notes
- `General Knowledge` is ready for direct topic entry.
- `English` is ready for direct topic entry.
- `Marathi Grammar` should remain subject-only for now.
- `Test of Reasoning` should remain subject-only for now.
- `Maths` is marked `DEFERRED` because the client explicitly points to the Staff-Railway-Bank maths notes rather than providing a dedicated MPSC-English topic list.

## MPSC Marathi Entry Notes
- `सामान्यज्ञान` is ready for direct topic entry and benefits from parent-child topic grouping for Geography, History, and Agriculture.
- `इंग्रजी` is ready for direct topic entry.
- `अंकगणित`, `बुद्धीमापन`, and `मराठी व्याकरण` should remain subject-only for now.

## Open Decisions Before Broader Taxonomy Import
- Bank-track `General Knowledge` and `English` refer back to MPSC English syllabus. We still need to decide whether bank filters should use duplicated track-owned topics or subject-only tagging.
- MPSC English `Maths` can stay subject-only, or we can later duplicate the bank maths topic tree if topic-level filtering becomes necessary.
- If student-facing taxonomy must show both Marathi and English labels at once, that is a product/UI decision, not just a data-entry choice.

## Validation Checklist
- Exam track codes and slugs are unique.
- Medium codes and slugs are unique.
- Subject codes and slugs are unique within each track.
- Topic codes and slugs are unique within each subject, including nested trees.
- Every track has a valid `defaultMediumCode`.
- Subjects marked `FULL` contain at least one topic.
- Subjects marked `SUBJECT_ONLY` or `DEFERRED` contain no topics.
- Parent topics do not cross subject boundaries.
- Marathi-track records are entered under the Marathi MPSC track, not the English one.
- MPSC-specific notes/questions/tests are linked to the correct track-owned subject IDs.
- After entry, the student catalog, notes filters, question filters, and test filters are smoke-tested with both MPSC tracks.

## Canonical Source
- Machine-readable draft: `references/client requirements/mpsc-taxonomy-canonical-draft.json`
- Structural validator: `scripts/validate-taxonomy-draft.ts`
