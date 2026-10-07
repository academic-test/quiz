import { describe, expect, it } from "vitest";
import { buildHumanitiesStimulusGroups } from "../src/utils/humanitiesStimuli";

const q = (id, group, passage = "", image = "") => ({ id, stimulus_group: group, passage, stimulus_image: image });

describe("buildHumanitiesStimulusGroups", () => {
  it("keeps all questions from the same stimulus on one page", () => {
    const groups = buildHumanitiesStimulusGroups([
      q("q1", "HUM-PDF-A-01", "shared passage"),
      q("q2", "HUM-PDF-A-01", "shared passage"),
      q("q3", "HUM-PDF-A-01", "shared passage"),
      q("q4", "HUM-PDF-A-02", "", "/stimuli/chart.svg"),
      q("q5", "HUM-PDF-A-02", "", "/stimuli/chart.svg")
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0].questions.map(x => x.id)).toEqual(["q1", "q2", "q3"]);
    expect(groups[1].questions.map(x => x.id)).toEqual(["q4", "q5"]);
    expect(groups[1].image).toBe("/stimuli/chart.svg");
  });

  it("uses the shared passage or image when an explicit group is missing", () => {
    const groups = buildHumanitiesStimulusGroups([
      q("q1", "", "A passage"),
      q("q2", "", "  A   passage "),
      q("q3", "", "", "/stimuli/cartoon.svg"),
      q("q4", "", "", "/stimuli/cartoon.svg")
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0].questions).toHaveLength(2);
    expect(groups[1].questions).toHaveLength(2);
  });
});
