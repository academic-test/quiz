-- Difficulty-weighted scoring: easy=1, medium=1.5, hard=2.
-- Recalculate stored scores for existing attempts so historical results match
-- the same scoring model used for new assessments.
with weighted as (
  select
    attempt_id,
    sum(
      case lower(coalesce(difficulty, ''))
        when 'hard' then 2.0
        when 'medium' then 1.5
        when 'easy' then 1.0
        else 1.0
      end
    ) as possible_points,
    sum(
      case
        when is_correct and not timed_out then
          case lower(coalesce(difficulty, ''))
            when 'hard' then 2.0
            when 'medium' then 1.5
            when 'easy' then 1.0
            else 1.0
          end
        else 0.0
      end
    ) as earned_points
  from public.quiz_responses
  group by attempt_id
)
update public.quiz_attempts qa
set score = round((weighted.earned_points / nullif(weighted.possible_points, 0)) * 100)::integer
from weighted
where qa.id = weighted.attempt_id;
