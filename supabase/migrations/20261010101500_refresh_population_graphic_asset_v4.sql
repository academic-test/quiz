-- Point population stimuli to the newest generated asset so browsers do not reuse
-- a stale cached graphic. The asset is generated from server/mathScienceData.js.
update public.generated_questions
set stimulus_image = '/stimuli/math-population-v4.svg'
where stimulus_image in (
  '/stimuli/math-population.svg',
  '/stimuli/math-population-v2.svg',
  '/stimuli/math-population-v3.svg'
);
