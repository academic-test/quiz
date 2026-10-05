-- Store the Year 9 assessment section allocation and keep a copy on each attempt.
alter table public.quiz_attempts
  add column if not exists section_counts jsonb not null
  default '{"numerical":60,"maths":60,"reading":55,"verbal":55}'::jsonb;

create table if not exists public.assessment_configs (
  id uuid primary key default gen_random_uuid(),
  config_key text not null unique,
  year_level text not null,
  section_counts jsonb not null,
  total_question_count integer not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.assessment_configs enable row level security;

insert into public.assessment_configs (
  config_key,
  year_level,
  section_counts,
  total_question_count,
  active
)
values (
  'year9_default',
  '9',
  '{"numerical":60,"maths":60,"reading":55,"verbal":55}'::jsonb,
  230,
  true
)
on conflict (config_key) do update
set
  year_level = excluded.year_level,
  section_counts = excluded.section_counts,
  total_question_count = excluded.total_question_count,
  active = excluded.active;
