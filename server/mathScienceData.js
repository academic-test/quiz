const populationAgeGroups = Object.freeze([
  Object.freeze({ label: "0–14", year1980: 1800, year2020: 1400 }),
  Object.freeze({ label: "15–34", year1980: 2600, year2020: 3100 }),
  Object.freeze({ label: "35–54", year1980: 1900, year2020: 2400 }),
  Object.freeze({ label: "55+", year1980: 900, year2020: 1500 })
]);

const populationPassage =
  "A town has recorded its population by age group in two survey years. In 1980 the numbers of residents aged " +
  populationAgeGroups.map(group => group.label).join(", ") +
  " were " +
  populationAgeGroups.map(group => group.year1980).join(", ") +
  ". In 2020 the corresponding numbers were " +
  populationAgeGroups.map(group => group.year2020).join(", ") +
  ".";

module.exports = {
  populationAgeGroups,
  populationPassage
};
