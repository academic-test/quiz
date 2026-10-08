const DIFFICULTY_WEIGHTS = Object.freeze({
  easy: 1,
  medium: 1.5,
  hard: 2
});

function difficultyWeight(difficulty) {
  return DIFFICULTY_WEIGHTS[String(difficulty || "").trim().toLowerCase()] || 1;
}

function calculateWeightedScore(rows) {
  let earned = 0;
  let possible = 0;

  for (const row of rows || []) {
    const weight = difficultyWeight(row?.difficulty);
    possible += weight;
    if (row?.is_correct && !row?.timed_out) earned += weight;
  }

  return {
    score: possible ? Math.round((earned / possible) * 100) : 0,
    earned,
    possible
  };
}

module.exports = {
  DIFFICULTY_WEIGHTS,
  difficultyWeight,
  calculateWeightedScore
};
