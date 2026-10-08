-- Distinguish dynamically generated Mathematics and Science questions
-- while keeping the assessment-facing section as mathematics_science when claimed.
alter table if exists public.generated_questions
  add column if not exists subject text;

update public.generated_questions
set subject = case
  when section = 'humanities' then 'humanities'
  when section = 'mathematics' then 'mathematics'
  when section = 'science' then 'science'
  when section = 'mathematics_science' then 'mathematics_science'
  else section
end
where subject is null;
