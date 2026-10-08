import { describe, expect, it } from "vitest";
import generators from "../../server/year10Level2Generators.js";
import pages from "../../server/mathScienceNewPages.js";

const { newMathSciencePages } = pages;
const { mathematicsScienceStimulusSet } = generators;

const EXPECTED = {
  "MATH-NEW-01": ["4,000", "32,000", "200"],
  "MATH-NEW-02": ["18 kWh", "10.8 kWh", "7.2 kWh"],
  "MATH-NEW-03": ["The length of the pendulum", "It doubles", "Period increases with length, but not in direct proportion to it"],
  "MATH-NEW-04": ["80 km", "13:00", "240 km"],
  "MATH-NEW-05": ["0.9 t/ha", "From 40 kg to 60 kg", "76%"],
  "MATH-NEW-06": ["3/10", "2/9", "20"],
  "MATH-NEW-07": ["1.15 km", "12 cm", "25 hectares"],
  "MATH-NEW-08": ["0.10 mol", "0.10 mol/L", "100 mL"],
  "MATH-NEW-09": ["6 kWh", "$1.80", "$0.72", "300 days"],
  "MATH-NEW-10": ["1/4", "60", "The tall parent is probably TT", "100"]
};

describe("new Mathematics & Science pages", () => {
  it("has 10 pages and 32 questions in the same slot sizes as the built-in pages", () => {
    expect(newMathSciencePages.map(p => p.questions.length)).toEqual([3, 3, 3, 3, 3, 3, 3, 3, 4, 4]);
  });

  it("keys the expected answer for every question", () => {
    newMathSciencePages.forEach(page => {
      expect(page.questions.map(q => String(q[1]))).toEqual(EXPECTED[page.key]);
    });
  });

  it("gives every question four distinct options, an explanation and no leaked float noise", () => {
    newMathSciencePages.forEach(page => page.questions.forEach(([text, answer, distractors, explanation]) => {
      const options = [answer, ...distractors].map(String);
      expect(new Set(options).size, text).toBe(4);
      expect(options.every(o => !/\d{7,}/.test(o)), text).toBe(true);
      expect(explanation.length, text).toBeGreaterThan(15);
    }));
  });
});

describe("generated Mathematics & Science assessment", () => {
  const sessions = Array.from({ length: 300 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`);

  it("always returns 32 valid questions on 10 pages, mixing built-in and new pages", () => {
    const seen = new Set();
    sessions.forEach(sessionId => {
      const rows = mathematicsScienceStimulusSet(sessionId);
      expect(rows).toHaveLength(32);
      const sizes = {};
      rows.forEach(r => {
        sizes[r.stimulus_group] = (sizes[r.stimulus_group] || 0) + 1;
        seen.add(r.stimulus_group);
        expect(r.answer_options).toHaveLength(4);
        expect(new Set(r.answer_options).size).toBe(4);
        expect(r.correct_answer).toBeGreaterThanOrEqual(0);
        expect(r.correct_answer).toBeLessThan(4);
      });
      expect(Object.values(sizes)).toEqual([3, 3, 3, 3, 3, 3, 3, 3, 4, 4]);
    });
    expect([...seen].some(key => key.startsWith("MATH-NEW-"))).toBe(true);
  });
});