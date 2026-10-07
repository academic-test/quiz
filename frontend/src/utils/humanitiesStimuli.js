export function buildHumanitiesStimulusGroups(questions = []) {
  const groups = [];
  const byKey = new Map();

  const imageByGroup = {
    "HUM-FRESH-02": "/stimuli/humanities-business-comparison.svg",
    "HUM-FRESH-03": "/stimuli/humanities-cartoon.svg",
    "HUM-FRESH-04": "/stimuli/humanities-fashion-scale.svg",
    "HUM-FRESH-05": "/stimuli/humanities-flight-experiments.svg",
    "HUM-FRESH-07": "/stimuli/humanities-migration.svg",
    "HUM-FRESH-08": "/stimuli/humanities-ad.svg"
  };

  questions.forEach((question, index) => {
    if (!question) return;

    const passageKey = String(question.passage || "")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();

    const key =
      question.stimulus_group ||
      (question.stimulus_image ? "image:" + question.stimulus_image : "") ||
      (passageKey ? "passage:" + passageKey : "") ||
      "legacy-group:" + Math.floor(index / 6);

    if (!byKey.has(key)) {
      const group = {
        key,
        passage: question.passage || "",
        image: question.stimulus_image || imageByGroup[question.stimulus_group] || "",
        questions: []
      };
      byKey.set(key, group);
      groups.push(group);
    }

    const group = byKey.get(key);
    group.questions.push(question);

    if (!group.passage && question.passage) group.passage = question.passage;
    if (!group.image && (question.stimulus_image || imageByGroup[question.stimulus_group])) {
      group.image = question.stimulus_image || imageByGroup[question.stimulus_group];
    }
  });

  return groups;
}
