export function buildMathScienceStimulusGroups(questions = []) {
  const groups = [];
  const byKey = new Map();

  questions.forEach((question, index) => {
    if (!question) return;

    const passageKey = String(question.passage || "")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();

    const key =
      question.stimulus_group ||
      (passageKey ? "passage:" + passageKey : "") ||
      "math-legacy-group:" + index;

    if (!byKey.has(key)) {
      const group = {
        key,
        passage: question.passage || "",
        image: question.stimulus_image || "",
        questions: []
      };
      byKey.set(key, group);
      groups.push(group);
    }

    const group = byKey.get(key);
    group.questions.push(question);

    if (!group.passage && question.passage) group.passage = question.passage;
    if (!group.image && question.stimulus_image) group.image = question.stimulus_image;
  });

  return groups;
}
