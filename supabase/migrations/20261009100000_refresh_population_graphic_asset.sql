-- Point the population stimulus at a fresh asset URL so clients cannot keep
-- rendering an older cached copy. The generator still also writes the original
-- path for already-open sessions and historical records.
update public.generated_questions
set stimulus_image = '/stimuli/math-population-v2.svg'
where stimulus_image = '/stimuli/math-population.svg';
