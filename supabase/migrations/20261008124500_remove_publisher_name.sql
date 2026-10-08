-- Remove the publisher name from Humanities persistent question IDs.
-- Update saved response references first; there is intentionally no foreign-key
-- constraint on quiz_responses.question_id, so existing historical responses
-- keep pointing to the renamed question.
update public.quiz_responses
set question_id = replace(question_id, concat(chr(65), 'CER'), 'LEVEL2')
where question_id like concat('%', chr(65), 'CER%');

update public.generated_questions
set id = replace(id, concat(chr(65), 'CER'), 'LEVEL2')
where id like concat('%', chr(65), 'CER%');
