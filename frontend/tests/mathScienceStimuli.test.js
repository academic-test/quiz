import { describe, expect, it } from "vitest";
import { buildMathScienceStimulusGroups } from "../src/utils/mathScienceStimuli";

describe("buildMathScienceStimulusGroups", () => {
  it("keeps all questions sharing a topic on the same page", () => {
    const questions = [
      { id: "1", stimulus_group: "MATH-PAGE-01", passage: "Shared data", q: "Q1", o: ["A", "B", "C", "D"] },
      { id: "2", stimulus_group: "MATH-PAGE-01", passage: "Shared data", q: "Q2", o: ["A", "B", "C", "D"] },
      { id: "3", stimulus_group: "MATH-PAGE-02", passage: "Other data", q: "Q3", o: ["A", "B", "C", "D"] }
    ];

    const groups = buildMathScienceStimulusGroups(questions);

    expect(groups).toHaveLength(2);
    expect(groups[0].questions.map(q => q.id)).toEqual(["1", "2"]);
    expect(groups[0].passage).toBe("Shared data");
    expect(groups[1].questions.map(q => q.id)).toEqual(["3"]);
    expect(groups[1].image).toBe("/stimuli/math-population-v4.svg");
  });
});
