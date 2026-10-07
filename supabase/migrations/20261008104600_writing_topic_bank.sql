create table if not exists public.writing_topics (
  id text primary key,
  task_slot integer not null check (task_slot in (1,2)),
  topic text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists writing_topics_slot_active_idx
  on public.writing_topics (task_slot, active, created_at);

alter table public.writing_topics enable row level security;

insert into public.writing_topics (id, task_slot, topic, active)
values
  ('WT-1-01', 1, 'A small choice can reveal a great deal about a person.', true),
  ('WT-1-02', 1, 'What looks like a problem from one point of view may be an opportunity from another.', true),
  ('WT-1-03', 1, 'Some changes are obvious. Others are noticed only after time has passed.', true),
  ('WT-1-04', 1, 'People sometimes understand an experience only after it is over.', true),
  ('WT-2-01', 2, 'A rule can protect people, but it can also create a problem.', true),
  ('WT-2-02', 2, 'The most useful lesson is not always the one we expected to learn.', true),
  ('WT-2-03', 2, 'Being heard is not the same as being agreed with.', true),
  ('WT-2-04', 2, 'What is left unsaid can sometimes be as important as what is said.', true)
on conflict (id) do update
set task_slot=excluded.task_slot, topic=excluded.topic, active=excluded.active, updated_at=now();