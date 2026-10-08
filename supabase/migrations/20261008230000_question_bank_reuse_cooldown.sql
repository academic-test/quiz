-- Preserve question-bank usage history so completed questions are not immediately reused.
alter table if exists public.generated_questions
  add column if not exists last_used_at timestamptz;

-- Convert questions from completed Year 10 assessments into reusable bank rows.
-- Active assessment rows are deliberately left untouched.
update public.generated_questions q
set
  is_bank = true,
  session_id = null,
  last_used_at = a.completed_at,
  subject = case
    when q.section = 'humanities' then 'humanities'
    when q.section = 'mathematics' then 'mathematics'
    when q.section = 'science' then 'science'
    when q.section = 'mathematics_science' then 'mathematics_science'
    else q.subject
  end
from public.quiz_attempts a
where q.session_id = a.session_id
  and q.year_level = '10'
  and q.is_bank = false
  and a.completed_at is not null;
