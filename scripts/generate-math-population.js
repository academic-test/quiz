const fs = require("fs");
const path = require("path");
const { populationAgeGroups } = require("../server/mathScienceData");

const width = 1000;
const height = 560;
const chartX = 205;
const chartWidth = 650;
const chartTop = 105;
const groupGap = 90;
const barHeight = 24;
const barGap = 8;
const maxValue = Math.max(
  ...populationAgeGroups.flatMap(group => [group.year1980, group.year2020])
);
const axisMax = Math.ceil(maxValue / 500) * 500;
const axisY = chartTop + (populationAgeGroups.length - 1) * groupGap + 76;

const esc = value => String(value)
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&apos;");

const barWidth = value => Math.round((value / axisMax) * chartWidth);

function renderPopulationSvg() {
  const groups = populationAgeGroups.map((group, index) => {
    const y = chartTop + index * groupGap;
    const width1980 = barWidth(group.year1980);
    const width2020 = barWidth(group.year2020);
    return [
      '<text x="45" y="' + (y + 20) + '" font-family="Arial,sans-serif" font-size="16" font-weight="700">' + esc(group.label) + '</text>',
      '<text x="175" y="' + (y + 18) + '" text-anchor="end" font-family="Arial,sans-serif" font-size="12" fill="#555">1980</text>',
      '<rect data-age-group="' + esc(group.label) + '" data-year="1980" data-value="' + group.year1980 + '" x="' + chartX + '" y="' + y + '" width="' + width1980 + '" height="' + barHeight + '" rx="3" fill="#b5b5b5"/>',
      '<text x="' + (chartX + width1980 + 10) + '" y="' + (y + 18) + '" font-family="Arial,sans-serif" font-size="13">' + esc(group.year1980) + '</text>',
      '<text x="175" y="' + (y + 18 + barHeight + barGap) + '" text-anchor="end" font-family="Arial,sans-serif" font-size="12" fill="#555">2020</text>',
      '<rect data-age-group="' + esc(group.label) + '" data-year="2020" data-value="' + group.year2020 + '" x="' + chartX + '" y="' + (y + barHeight + barGap) + '" width="' + width2020 + '" height="' + barHeight + '" rx="3" fill="#555"/>',
      '<text x="' + (chartX + width2020 + 10) + '" y="' + (y + barHeight + barGap + 18) + '" font-family="Arial,sans-serif" font-size="13">' + esc(group.year2020) + '</text>'
    ].join("");
  }).join("");

  const ticks = Array.from({ length: axisMax / 500 + 1 }, (_, index) => {
    const value = index * 500;
    const x = chartX + Math.round((value / axisMax) * chartWidth);
    return [
      '<line x1="' + x + '" y1="' + (chartTop - 10) + '" x2="' + x + '" y2="' + axisY + '" stroke="#e6e6e6"/>',
      '<text x="' + x + '" y="' + (axisY + 24) + '" text-anchor="middle" font-family="Arial,sans-serif" font-size="12" fill="#666">' + value + '</text>'
    ].join("");
  }).join("");

  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + width + ' ' + height + '">',
    '<rect width="' + width + '" height="' + height + '" fill="white"/>',
    '<text x="500" y="38" text-anchor="middle" font-family="Arial,sans-serif" font-size="24" font-weight="700">Population by Age Group</text>',
    '<text x="500" y="64" text-anchor="middle" font-family="Arial,sans-serif" font-size="13" fill="#666">Residents recorded in each survey year</text>',
    '<rect x="725" y="82" width="18" height="18" rx="3" fill="#b5b5b5"/><text x="751" y="96" font-family="Arial,sans-serif" font-size="13">1980</text>',
    '<rect x="810" y="82" width="18" height="18" rx="3" fill="#555"/><text x="836" y="96" font-family="Arial,sans-serif" font-size="13">2020</text>',
    '<g font-family="Arial,sans-serif" font-size="12" fill="#666">' + ticks + '</g>',
    '<line x1="' + chartX + '" y1="' + axisY + '" x2="' + (chartX + chartWidth) + '" y2="' + axisY + '" stroke="#999"/>',
    '<g font-family="Arial,sans-serif">' + groups + '</g>',
    '</svg>',
    ""
  ].join("");
}

function generatePopulationSvgs() {
  const targets = [
    path.join(__dirname, "..", "frontend", "public", "stimuli", "math-population.svg"),
    path.join(__dirname, "..", "frontend", "public", "stimuli", "math-population-v2.svg")
  ];
  const svg = renderPopulationSvg();
  targets.forEach(target => {
    fs.writeFileSync(target, svg);
    console.log("Generated " + target);
  });
}

if (require.main === module) generatePopulationSvgs();

module.exports = { renderPopulationSvg, generatePopulationSvgs, barWidth };
