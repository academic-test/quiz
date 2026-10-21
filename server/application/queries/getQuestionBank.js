async function getQuestionBank({ supabase, section }) {
  const { data, error } = await supabase
    .from("generated_questions")
    .select("id,year_level,section,subject,difficulty,time,question_text,answer_options,correct_answer,explanation,passage,stimulus_group,stimulus_image,is_bank,session_id,created_at,updated_at")
    .eq("year_level", "10")
    .eq("section", section)
    .eq("is_bank", true)
    .order("stimulus_group", { ascending: true })
    .order("id", { ascending: true });

  if (error) return { error };
  const questions = data || [];
  return {
    section,
    questions,
    count: questions.length,
    active_count: questions.filter(row => row.session_id).length
  };
}

module.exports = { getQuestionBank };
