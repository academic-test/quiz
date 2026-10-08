const DIFFICULTY_WEIGHTS = Object.freeze({
  easy: 1,
  medium: 1.5,
  hard: 2
});

export function difficultyWeight(difficulty) {
  return DIFFICULTY_WEIGHTS[String(difficulty || "").trim().toLowerCase()] || 1;
}
