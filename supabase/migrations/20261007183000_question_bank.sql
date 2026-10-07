-- Persistent Year 10 question-bank metadata and initial bank sets.
alter table public.generated_questions
  add column if not exists is_bank boolean not null default false;

create index if not exists generated_questions_bank_lookup_idx
  on public.generated_questions (year_level, section, is_bank, session_id, stimulus_group);

update public.generated_questions
set is_bank = true
where year_level = '10'
  and section in ('humanities', 'mathematics_science')
  and session_id is null
  and is_bank = false;

with source_session as (
  select session_id
  from public.generated_questions
  where year_level = '10'
    and section = 'mathematics_science'
    and stimulus_group is not null
  group by session_id
  having count(*) = 32
     and count(stimulus_group) = 32
     and count(distinct stimulus_group) = 10
  order by max(created_at) desc
  limit 1
),
source_rows as (
  select g.*,
         row_number() over (order by g.stimulus_group, g.id) as rn
  from public.generated_questions g
  join source_session s on s.session_id = g.session_id
  where g.year_level = '10'
    and g.section = 'mathematics_science'
)
insert into public.generated_questions (
  id, session_id, ip_hash, year_level, section, difficulty, time,
  question_text, answer_options, correct_answer, explanation, passage,
  stimulus_group, stimulus_image, is_bank
)
select
  'MS-BANK-A-Q' || lpad(rn::text, 2, '0'),
  null,
  md5('question-bank|' || rn::text),
  year_level,
  section,
  difficulty,
  time,
  question_text,
  answer_options,
  correct_answer,
  explanation,
  passage,
  replace(stimulus_group, 'MATH-PAGE-', 'MATH-BANK-A-PAGE-'),
  stimulus_image,
  true
from source_rows
where not exists (
  select 1
  from public.generated_questions existing
  where existing.id = 'MS-BANK-A-Q' || lpad(source_rows.rn::text, 2, '0')
);