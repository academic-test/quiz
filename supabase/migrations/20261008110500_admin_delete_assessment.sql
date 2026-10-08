create or replace function public.admin_delete_quiz_attempt(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
  v_deleted integer := 0;
begin
  select session_id
    into v_session_id
  from public.quiz_attempts
  where id = p_attempt_id
  for update;

  if v_session_id is null then
    return jsonb_build_object('deleted', false);
  end if;

  delete from public.quiz_attempts
  where id = p_attempt_id;

  get diagnostics v_deleted = row_count;

  -- Return persistent bank questions to the available pool; remove only
  -- session-specific generated questions.
  update public.generated_questions
  set session_id = null
  where session_id = v_session_id
    and is_bank = true;

  delete from public.generated_questions
  where session_id = v_session_id
    and is_bank = false;

  return jsonb_build_object('deleted', v_deleted = 1);
end;
$$;

revoke all on function public.admin_delete_quiz_attempt(uuid) from public;
grant execute on function public.admin_delete_quiz_attempt(uuid) to service_role;