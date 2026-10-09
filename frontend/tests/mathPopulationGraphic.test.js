import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { populationAgeGroups } = require("../../server/mathScienceData");
const { renderPopulationSvg } = require("../../scripts/generate-math-population");

const generatedFiles = [
  resolve(process.cwd(), "frontend/public/stimuli/math-population.svg"),
  resolve(process.cwd(), "frontend/public/stimuli/math-population-v2.svg")
];

function readBarWidth(svg, group, year, value) {
  const escapedLabel = group.replace(/[.*+?^$()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    '<rect data-age-group="' + escapedLabel +
    '" data-year="' + year +
    '" data-value="' + value +
    '" x="205" y="\\d+" width="(\\d+)"'
  );
  const match = svg.match(pattern);
  expect(match, "Missing chart bar for " + group + " / " + year).not.toBeNull();
  return Number(match[1]);
}

describe("data-generated population chart", () => {
  it("keeps every bar proportional to the source population numbers", () => {
    const svg = renderPopulationSvg();
    const maxValue = Math.max(
      ...populationAgeGroups.flatMap(group => [group.year1980, group.year2020])
    );
    const axisMax = Math.ceil(maxValue / 500) * 500;
    const chartWidth = 650;

    for (const group of populationAgeGroups) {
      for (const [year, value] of [[1980, group.year1980], [2020, group.year2020]]) {
        expect(readBarWidth(svg, group.label, year, value)).toBe(
          Math.round((value / axisMax) * chartWidth)
        );
      }
    }

    expect(readBarWidth(svg, "0–14", 1980, 1800))
      .toBeGreaterThan(readBarWidth(svg, "55+", 1980, 900));
  });

  it("keeps both committed SVG files in sync with the data-driven generator", () => {
    const expected = renderPopulationSvg();
    for (const file of generatedFiles) {
      expect(readFileSync(file, "utf8")).toBe(expected);
    }
  });
});
