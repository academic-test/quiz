# Aptitude Practice Lab — Project Summary

This file records the current architecture, product decisions, implemented changes, deployment notes, and pending work so future development can resume safely.

## Project
- Repo: `academic-test/quiz`
- Student app: Vue 3 + Vite
- Backend: Express 5
- Database: Supabase
- Student target: Year 10 entry preparation using ACER Level 2 practice material for entry in Years 9 and 10
- Original practice questions informed by the supplied ACER Scholarship and Select Entry Tests practice booklet; no ACER affiliation and no copied ACER questions

## Key product decisions
- Testing only; Learning was removed from the intended student experience.
- Student enters a name and starts a generated test.
- Five answer choices A–E.
- Questions are generated on the server.
- The content target is the supplied ACER Scholarship/Select Entry Tests practice structure for entry in Years 9 and 10, with this project focused on Year 10 entry.
- Same-IP question reuse is blocked using hashed IP + generated question IDs.
- Session IDs are UUIDs and Admin shows student name with Session ID.
- After a response is submitted, the student sees the correct answer and an explanation.
- Once a response is submitted/feedback is shown, the student cannot change that response.
- Student must not see a “Time's Up” message during the test.
- Answers remain editable only while the current block is open.

## Assessment sections and content target
The supplied ACER Scholarship and Select Entry Tests practice booklet is explicitly for entry in Years 9 and 10. It contains four test components:
- Written Expression: Test 1 — 25 minutes.
- Humanities Comprehension and Interpretation: Test 2 — 40 minutes.
- Mathematics and Science: Test 3 — 40 minutes.
- Written Expression: Test 4 — 25 minutes.

For this project, the student target is Year 10 entry. The four source-supported assessment components are therefore:
1. Written Expression — Test 1.
2. Humanities Comprehension and Interpretation — Test 2.
3. Mathematics and Science — Test 3.
4. Written Expression — Test 4.

The supplied booklet describes Written Expression as an original response to a stimulus. Students may respond with a story, persuasive piece or personal reflection. Assessment emphasis is on:
- quality of thoughts and content
- structure and organisation
- quality, effectiveness and appropriateness of language
- responding to the stimulus rather than using a rehearsed response

Humanities Comprehension and Interpretation should use varied written and visual information, including literary passages, charts, diagrams, cartoons, advertisements, graphs and source material. Questions should emphasise comprehension, interpretation, inference, comparison, evidence evaluation and drawing conclusions.

Mathematics and Science should use reasoning-first problems built from supplied information. Question families should include mathematics, data interpretation, spatial/visual reasoning, graphs, tables, patterns, measurement, proportional reasoning, probability, logical deduction and science contexts where students analyse evidence, relationships and experimental information.

The practice bank should support both text-only and image/diagram-based questions.

Important: the supplied booklet establishes the four components above. It does not support keeping the previous 230-question split as the official ACER structure. Any project-specific question counts are practice allocations and must not be described as official ACER counts.

## Question-bank design requirements
- Preserve useful existing questions, but classify them as suitable, upgrade, replace or add for Year 10 Level 2 practice.
- Reduce repeated templates and repeated wording; distinct scenarios and reasoning tasks matter, not just unique IDs.
- Avoid consecutive questions using the same reasoning type within a section where practical.
- Prefer unfamiliar, multi-step and interpretation-heavy problems over routine textbook exercises.
- Include richer data displays and visual information rather than relying mainly on short prose questions.
- Add a dedicated Science question family to Mathematics and Science.
- Add Written Expression practice with two separate 25-minute tasks.
- Do not copy ACER questions, passages, charts or answer choices. Use original material that mirrors the reasoning demands and formats.


## Source-based timing design
The supplied ACER practice booklet gives these timings:
- Written Expression Test 1 — 25 minutes.
- Humanities Comprehension and Interpretation Test 2 — 40 minutes.
- Mathematics and Science Test 3 — 40 minutes.
- Written Expression Test 4 — 25 minutes.

For the project, these four source-based components should be treated as the content and timing target. Any alternative practice mode or condensed mock mode must be clearly labelled as project-specific.

Do not describe the previous 60/60/55/55 two-block structure as an official ACER structure.
Do not use individual-question countdowns as a substitute for the source test component timing unless explicitly requested for a practice mode.

## Student navigation and submission rules
- The student assessment has four source-supported test components in this order:
  1. Written Expression — Test 1.
  2. Humanities Comprehension and Interpretation — Test 2.
  3. Mathematics and Science — Test 3.
  4. Written Expression — Test 4.
- Multiple-choice questions use four answer choices A–D, matching the supplied ACER practice booklet.
- Written Expression 1 is 25 minutes.
- Humanities is 40 minutes.
- Mathematics & Science is 40 minutes.
- Written Expression 2 is 25 minutes.
- MCQ components use one overall component timer; there are no per-question countdowns.
- Selecting an answer only highlights it locally. It is not saved or locked until the student commits it.
- First click on Next Question records the selected answer, locks the response, and displays the correct answer plus explanation on the SAME question.
- The student must click Next Question a SECOND time to move to the next MCQ question.
- On the final MCQ of a component, the first click records the final answer and displays feedback on the same question; the second click submits the completed component when all questions are answered.
- After feedback is displayed, the recorded response cannot be changed.
- Skip is available only before an answer is selected. A skipped question can be revisited within the same unsubmitted MCQ component.
- Previous navigation is allowed within the current unsubmitted MCQ component. Recorded answers remain locked and their feedback is restored when revisited.
- The student cannot move to the next component until the current component is submitted or times out.
- Writing responses are submitted once and then locked.
- An active assessment is persisted in browser session storage so a page refresh does not create a new assessment.
- A component timeout automatically submits and permanently locks that component.
- There is no student-facing “Time's Up” message.
- After Test 4 is submitted or times out, the assessment is completed and results are shown.

## Question-data integrity
- Every MCQ question shown to a student must contain exactly four non-empty answer choices A–D.
- Answer choices must be unique after normalisation; duplicate choices are invalid and must never be shown.
- `correct_answer` must be an integer from 0 to 3.
- Legacy five-choice or malformed bank rows must be ignored by the Year 10 Level 2 assessment generator.
- Generated questions must use the same four-choice shape.
- Example invalid item: A=13, B=4, C=4, D=5. It must be rejected because B and C duplicate, even though B can be the mathematically correct answer.

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
- `POST /api/responses` validates assessment access, attempt/session/question ownership and response integrity.
- A selected option is not persisted when clicked.
- The response is persisted when the student commits it with Next/submit.
- The successful response API returns correctness, the correct answer index and explanation; the frontend displays these immediately on the same question.
- A recorded response is locked. A second submission for the same attempt/question is rejected.
- Skipped/unanswered questions are not sent to the response endpoint.
- Response time is captured when the response is committed.
- Do not treat an option click as a completed response.

## Admin
- `/admin` contains the login/dashboard.
- Attempt table shows student + Session ID.
- View opens a separate response page/tab.
- `/admin/responses?id=<attempt-id>` shows the Session ID prominently at the top and question-level results.
- Response page includes section performance and Areas for Improvement.
- Admin timing data is intended to support speed/accuracy review without exposing correctness during the student test.

## Supabase tables
`quiz_attempts`: id, session_id, session_name, year_level, section, difficulty, question_count, section_counts, started_at, completed_at, score, correct_count, wrong_count, timeout_count, average_response_seconds.

`quiz_responses`: attempt_id, session_id, question_id, section, difficulty, selected_answer, correct_answer, is_correct, timed_out, response_seconds, answered_at, question_text, answer_options.

`quiz_writing_responses`: attempt_id, session_id, task_id, response_text, submitted_at.

`generated_questions`: id, session_id, ip_hash, year_level, section, difficulty, time, question_text, passage, answer_options, correct_answer, explanation, created_at.

`assessment_configs`: active assessment configuration. Current Year 10 Level 2 practice allocation uses 40 Humanities MCQs + 32 Mathematics & Science MCQs = 72 MCQs, plus two 25-minute Written Expression tasks. This is a project practice allocation based on the supplied ACER practice booklet and must not be described as an official ACER question count.

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
- Public health endpoint: `GET /health`.
- Health response includes `ok: true` and `supabaseConfigured`.
- `/health` is suitable as a lightweight external cron/uptime request to keep the Render service active.
- Example health URL: `https://quiz-tv23.onrender.com/health`.

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
Primary source for the current assessment design: the supplied `Scholarship_Practice_Questions_Y9-10.pdf`, published by the Australian Council for Educational Research, titled `Scholarship and Select Entry Tests Practice Questions for entry in Years 9 and 10`. It contains Written Expression Tests 1 and 4, Humanities Comprehension and Interpretation Test 2, and Mathematics and Science Test 3.

The supplied `Volume 1 Exam Pack Question Book.pdf` remains a secondary blueprint for general question-type variety; it is not an ACER publication and explicitly states it is not affiliated with ACER.

The supplied LANTITE numeracy practice PDF is a secondary reference for numeracy/data question formats only. It must not be treated as the scholarship-test structure and must not be copied.

## Permanent Humanities stimulus-page contract

**NON-NEGOTIABLE:** Humanities is always presented as stimulus pages, never as one-question-per-page.

For every Humanities stimulus page:
- A shared stimulus (long passage, chart, diagram, cartoon, scale, migration visual, advertisement, etc.) is displayed once at the top.
- Multiple associated questions are displayed together underneath that same stimulus. The UI must not fall back to individual-question paging.
- Page 1 must preserve the long shared passage with its multiple questions (currently Questions 1–6 in the primary grouped set).
- Navigation buttons represent **stimulus pages/sets**, not individual questions. Example: one button for Stimulus 1 / Q1–6, one for Stimulus 2 / Q7–16, etc.
- Before review, the page shows **Save Answer & Review**. It is disabled until every question on the current page has an answer.
- Clicking **Save Answer & Review** saves all answers on that page and displays the correctness, correct answer (when needed), and explanation directly below each question's answer options.
- After a successful page review, the **same button becomes Next Page →**. There is no second/duplicate Next Page control for the same page.
- Clicking Next Page advances to the next stimulus set, which again contains multiple questions and starts with Save Answer & Review.
- Do not remove or bypass this grouped flow while fixing unrelated navigation, persistence, or styling issues.
- A page is considered reviewed only after every question on that page has a saved backend result. Track an explicit page-reviewed state as a UI invariant so the Next Page control cannot disappear merely because a reactive result calculation changes.
- Any question-bank fallback for Humanities must preserve complete stimulus groups. Never use the normal individual-question diversity fallback for Humanities.
- Maintain these rules across future refactors; regression tests must assert grouped rendering, page-level navigation, page review, feedback placement, and the review-to-next-button transition.

## Rules for future changes
- Do not reintroduce Learning unless explicitly requested.
- Keep the four source-supported test components in order: Written Expression 1, Humanities, Mathematics & Science, Written Expression 2.
- Do not mix sections unless explicitly requested.
- Show feedback on the SAME MCQ question after the first Next/submit click.
- Require a second Next/submit click to move forward.
- Show the correct answer and explanation after a response is recorded.
- Do not allow a recorded response to be changed.
- Do not show a Time's Up message during the test.
- Do not show per-question timers.
- Use one overall timer per active test component.
- Save an answered question when the response is committed, not when an option is clicked.
- Never record time for a skipped/unanswered question.
- Permit revisits only within the current unsubmitted MCQ component.
- Once a component is submitted or times out, lock it permanently.
- Require all questions in an MCQ component to be answered for manual submission.
- Auto-submit and lock a component when its timer reaches zero.
- Keep answer keys and generated questions on the backend.
- Preserve student name + Session ID in Admin.
- Keep timing data for admin analysis.
- Verify the Render deployment is Live before asking the user to test.
- Never overwrite the working Vue app with partial snippets.
