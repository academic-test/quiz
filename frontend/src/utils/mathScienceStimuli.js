export function buildMathScienceStimulusGroups(questions = []) {
  const groups = [];
  const byKey = new Map();

  const imageByGroup = {
    "MATH-PAGE-01": "/stimuli/math-landmass.svg",
    "MATH-PAGE-02": "/stimuli/math-population-v4.svg",
    "MATH-PAGE-03": "/stimuli/math-air-quality.svg",
    "MATH-PAGE-04": "/stimuli/math-tiles.svg",
    "MATH-PAGE-05": "/stimuli/math-food-web.svg",
    "MATH-PAGE-06": "/stimuli/math-blood-flow.svg",
    "MATH-PAGE-07": "/stimuli/math-moving-average.svg",
    "MATH-PAGE-08": "/stimuli/math-forgetting.svg",
    "MATH-PAGE-09": "/stimuli/math-aquarium.svg",
    "MATH-PAGE-10": "/stimuli/math-morse.svg"
  };

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
