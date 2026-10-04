# Aptitude Practice Lab — Project Summary

This file records the current architecture, product decisions, implemented changes, deployment notes, and pending work so future development can resume safely.

## Project
- Repo: `academic-test/quiz`
- Student app: Vue 3 + Vite
- Backend: Express 5
- Database: Supabase
- Student test: Year 9 only
- Original ACER-style practice questions; no ACER affiliation or copied questions

## Key product decisions
- Testing only; Learning was removed from the intended student experience.
- Student enters a name and starts a generated test.
- Five answer choices A–E.
- Questions are generated on the server.
- Same-IP question reuse is blocked using hashed IP + generated question IDs.
- Session IDs are UUIDs and Admin shows student name with Session ID.
- Student must not see correctness feedback during the test.
- Student must not see a Time's Up message during the test.

## Question format
- Current intended practice test: 230 questions.
- Intended allocation: 60 Quantitative/Numerical, 60 Mathematics, 55 Reading, 55 Verbal.
- Questions stay in fixed section order; they are not mixed.
- First 10 questions should be generated before the student starts; the rest generate in the background.
- Background generation polls for newly available questions.
- Database inserts were changed to batches for speed.

## ACER-style timing design
Current Victorian practice design discussed in this project:
- Block 1: Mathematics + Quantitative Reasoning — 60 minutes.
- Break: 20 minutes.
- Block 2: Reading + Verbal Reasoning — 55 minutes.
- Break: 5 minutes.
- Writing: 40 minutes.

These are block timers, not individual-question timers. Exact ACER question counts within subtests are not publicly specified, so the 60/60 and 55/55 split is a practice allocation, not an ACER claim.

## Student navigation requirements
- Overall time remaining must be shown for the current section/block.
- Student can skip a question.
- Skipped questions can be revisited and answered later.
- Navigation should identify current, answered and skipped questions.
- Student can move backwards within the current block.
- Final question has a Submit Test action.
- When a section timer expires, move to the next block; do not end the whole test early.

## Timing analytics
For each response, capture actual response time. Admin timing flags:
- Very fast: <=10 seconds.
- On pace: 10–25 seconds.
- Near limit: >25 seconds.
- Timed out: section/test timing expired before a response was saved.

Admin section reporting should show questions, total time, average time/question, accuracy, timeouts and correct count. Improvement flags use practice thresholds: accuracy <70%, timeout present, average >25s = Needs attention; accuracy <85% or average >20s = Watch.

## Admin
- `/admin` contains the login/dashboard.
- Attempt table shows student + Session ID.
- View opens a separate response page/tab.
- `/admin/responses?id=<attempt-id>` shows the Session ID prominently at the top and question-level results.
- Response page includes section performance and Areas for Improvement.

## Supabase tables
`quiz_attempts`: id, session_id, session_name, year_level, section, difficulty, question_count, started_at, completed_at, score, correct_count, wrong_count, timeout_count, average_response_seconds.

`quiz_responses`: attempt_id, session_id, question_id, section, difficulty, selected_answer, correct_answer, is_correct, timed_out, response_seconds, answered_at, question_text, answer_options.

`generated_questions`: id, session_id, ip_hash, year_level, section, difficulty, time, question_text, passage, answer_options, correct_answer, explanation, created_at.

## Important files
- `server.js` — APIs, generation, security, Supabase access, static serving.
- `frontend/src/App.vue` — student app shell/state orchestration.
- `frontend/src/components/StartScreen.vue`
- `frontend/src/components/Timer.vue`
- `frontend/src/components/QuestionCard.vue`
- `frontend/src/components/ResultsScreen.vue`
- `frontend/src/styles.css`
- `public/admin.html`
- `public/admin.js`
- `public/admin-responses.html`
- `frontend/src/useQuiz.js` — created during the attempted timed-test refactor; verify before using because deployment/build status was not confirmed.

## Security
- Supabase service-role key stays server-side.
- Response submission validates attempt/session/question ownership and hashed IP.
- Attempt completion validates session ID.
- Admin authentication uses an HTTP-only signed cookie.

## Deployment
- Render service: `quiz` / slug `quiz-tv23`.
- URL: https://quiz-tv23.onrender.com
- GitHub main auto-deploy is enabled.
- Express 5 wildcard fallback issue was fixed.
- Vue asset MIME-type issue was fixed by explicitly serving the built assets.

## Current recovery note
The section-timer/skip/revisit refactor was only partially completed. A later Render deployment for `4ae290d1b2689c98602c1d08e27e357146b3ccc5` failed to build. Do not assume the section-timer/skip/revisit functionality is live. First restore a coherent `App.vue`, verify all component props/events, build successfully, then deploy.

Most recent known stable Live deployment before that failed refactor: `a916872a5f0670668ff08d30ac626f3cd32fdded`.

## Source material
The supplied `Volume 1 Exam Pack Question Book.pdf` was used as a blueprint for sample question types/structures. It is not an ACER publication and explicitly states it is not affiliated with ACER. Official ACER material was also consulted for current Victorian schedule information.

## Rules for future changes
- Do not reintroduce Learning unless explicitly requested.
- Do not mix sections unless explicitly requested.
- Do not show correctness during the test.
- Do not show Time's Up during the test.
- Keep timing data for admin analysis.
- Preserve student name + Session ID in Admin.
- Keep answer keys and generated questions on the backend.
- Verify the Render deployment is Live before asking the user to test.
- Never overwrite the working Vue app with partial snippets.
