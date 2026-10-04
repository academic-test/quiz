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
- Student must not see a “Time's Up” message during the test.
- Answers remain editable only while the current block is open.

## Question format
- Current intended practice test: 230 questions.
- Intended allocation: 60 Quantitative/Numerical, 60 Mathematics, 55 Reading, 55 Verbal.
- Questions stay in fixed section order; they are not mixed.
- First 10 questions should be generated before the student starts; the rest generate in the background.
- Background generation polls for newly available questions.
- Database inserts were changed to batches for speed.

## ACER-style timing design
Current Victorian practice design used for the student app:
- Block 1: Mathematics + Quantitative Reasoning — 60 minutes.
- Break: 20 minutes.
- Block 2: Reading + Verbal Reasoning — 55 minutes.
- Break: 5 minutes.
- Writing: 40 minutes.

The app currently implements the two timed testing blocks only; Writing/break screens are not yet part of the student test flow.

These are block timers, not individual-question timers. Exact ACER question counts within subtests are not publicly specified, so the 60/60 and 55/55 split is a practice allocation, not an ACER claim.

## Student navigation and submission rules
- One overall timer is shown for the active block.
- Block 1 timer is 60 minutes for Questions 1–120.
- Block 2 timer is 55 minutes for Questions 121–230.
- There is no individual question timer in the intended design.
- Student may select an answer and change it while still in the same block.
- Selecting an option does NOT save the response.
- A response is saved when the student moves away from an answered question using Next, Previous, or question navigation.
- Response time is captured only for answered questions when their response is saved.
- A skipped question is not written to `quiz_responses` and does not record time taken.
- Student can skip unanswered questions and revisit them later within the same block.
- Question navigation shows current, answered and skipped status.
- Previous/Next navigation is limited to the current block.
- The student cannot move to the next block until every question in the current block has been answered.
- The end-of-block action is an explicit section submission:
  - Block 1: “Submit Section & Continue →”
  - Block 2: “Submit Test”
- Once a block is explicitly submitted, it is permanently locked.
- After Block 1 submission, the student cannot return to Quantitative/Numerical or Mathematics questions, including previously skipped questions.
- After Block 2 submission, the entire test is complete.
- If a section timer reaches zero, that section is automatically submitted and permanently locked.
- On timer expiry, an already-selected answer is saved normally if it has not yet been saved.
- Unanswered/skipped questions remain unrecorded; the student cannot return to them after the section auto-submits.
- On Block 1 timeout, Block 2 starts automatically.
- On Block 2 timeout, the test ends automatically.

## Timing analytics
For each saved response, capture actual response time in seconds.

Admin timing flags:
- Very fast: <=10 seconds.
- On pace: 10–25 seconds.
- Near limit: >25 seconds.
- Timed out: use only when a section/test timer expires before a selected answer can be saved.

Admin section reporting should show questions, total time, average time/question, accuracy, timeouts and correct count.

Improvement flags use internal practice thresholds:
- Accuracy <70%, timeout present, or average >25s = Needs attention.
- Accuracy <85% or average >20s = Watch.
- Otherwise = On track.

These thresholds are practice analytics only and are not ACER scoring rules.

## Answer persistence / backend behaviour
- `POST /api/responses` validates attempt/session/question ownership and hashed IP.
- The response route supports revisiting a question and updating its existing response instead of creating a duplicate response row.
- Skipped/unanswered questions are not sent to the response endpoint.
- The student-facing app keeps local answer state so an answer can be changed before section submission.
- Do not treat an option click as a completed response.

## Admin
- `/admin` contains the login/dashboard.
- Attempt table shows student + Session ID.
- View opens a separate response page/tab.
- `/admin/responses?id=<attempt-id>` shows the Session ID prominently at the top and question-level results.
- Response page includes section performance and Areas for Improvement.
- Admin timing data is intended to support speed/accuracy review without exposing correctness during the student test.

## Supabase tables
`quiz_attempts`: id, session_id, session_name, year_level, section, difficulty, question_count, started_at, completed_at, score, correct_count, wrong_count, timeout_count, average_response_seconds.

`quiz_responses`: attempt_id, session_id, question_id, section, difficulty, selected_answer, correct_answer, is_correct, timed_out, response_seconds, answered_at, question_text, answer_options.

`generated_questions`: id, session_id, ip_hash, year_level, section, difficulty, time, question_text, passage, answer_options, correct_answer, explanation, created_at.

## Important files
- `server.js` — APIs, generation, security, Supabase access, static serving.
- `frontend/src/App.vue` — student app shell/state orchestration, block timers, navigation and submission rules.
- `frontend/src/components/StartScreen.vue`
- `frontend/src/components/Timer.vue` — displays the overall block timer.
- `frontend/src/components/QuestionCard.vue` — answer selection, Skip, Previous, Next, section submission.
- `frontend/src/components/ResultsScreen.vue`
- `frontend/src/styles.css`
- `public/admin.html`
- `public/admin.js`
- `public/admin-responses.html`
- `frontend/src/useQuiz.js` — created during an earlier refactor; treat as experimental/untrusted unless explicitly verified against the current app.

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

Recent deployment sequence:
- `a916872a5f0670668ff08d30ac626f3cd32fdded` — restored stable quiz app.
- `4ae290d1b2689c98602c1d08e27e357146b3ccc5` — timed-block experiment; build failed.
- `908f62c871b5c533115cb228f26bc1276908f3cd` — fixed duplicate `totalQuestions` declaration; deployed Live.
- `d2098fa28d48de7a375d35f9ec8dcce6a76defdb` — fixed undefined `currentBlock.end`; deployed Live.
- `a7508af223e291d31f34096000e8ae1ed7b18a3c` — removed undefined `savedResponses.has`; deployed Live.
- `4280fad05b166646831c994123c49408806649db` — introduced block timer/skip navigation.
- `21034e6b97b9f14bef5201b4e437a8346fa27e16` — styling for question navigation.
- `da4875145f338091f13919ce8f140fcbfb771b38` — changed response persistence so answers save on navigation.
- `b39c6c583fe3712be983d2639750ad8458ba4836` — stopped scoring skipped questions as responses.
- `af48b351c38ea950b229070393c5dc168d138a29` — made timer label explicitly indicate block time.
- `7c77f9ca8b22d2a2ae691ee227c7b75c48c904a7` — disabled Skip after an answer is selected.
- `0d51590a9725ed67d687931a4271fe6bdd01f865` — saved selected answers normally when section timer expires; this deployment reached Live.
- `222065d84d8421f1f150c1b3d4f05bdc1e253567` — required all current-block questions to be answered before explicit section submission.
- `152f3d5963e1e935a37e79719c94205e1cf68e21` — added explicit section submission controls and unanswered warning.
- `3e1c9bdbd08984c93f77718d579b561f62380ad9` — wired section submission button; this deployment reached Live.
- `f63808d0d1c724496a433e3893e2ff7cd6e9e18e` — locks submitted sections and prevents returning to previous blocks.
- `21b7f562083ea0a4c9f0e37c1a95374eeaea7d08` — auto-submits and locks a section when its timer expires; Render deployment was started after this commit.

Important: always verify the newest intended commit is **Live** before asking the user to test. A build-in-progress or queued deployment is not confirmed live.

## Source material
The supplied `Volume 1 Exam Pack Question Book.pdf` was used as a blueprint for sample question types/structures. It is not an ACER publication and explicitly states it is not affiliated with ACER. Official ACER material was also consulted for current Victorian schedule information.

## Rules for future changes
- Do not reintroduce Learning unless explicitly requested.
- Do not mix sections unless explicitly requested.
- Do not show correctness during the test.
- Do not show a Time's Up message during the test.
- Do not show per-question timers.
- Use one overall timer per active testing block.
- Save an answered question when the student leaves it, not when an option is clicked.
- Never record time for a skipped/unanswered question.
- Permit revisits only within the current unsubmitted block.
- Once a block is submitted or times out, lock it permanently.
- Require all questions in a block to be answered for manual section submission.
- Auto-submit and lock a block when its timer reaches zero.
- Keep answer keys and generated questions on the backend.
- Preserve student name + Session ID in Admin.
- Keep timing data for admin analysis.
- Verify the Render deployment is Live before asking the user to test.
- Never overwrite the working Vue app with partial snippets.
