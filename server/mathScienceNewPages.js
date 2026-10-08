// Ten new Mathematics & Science problem pages (32 questions) in the same shape as the
// built-in pages in year10Level2Generators.js: each question is
// [question text, correct answer, [three distractors], explanation].
//
// Page sizes deliberately mirror the built-in slots (3,3,3,3,3,3,3,3,4,4) so a slot can be
// swapped for its counterpart without changing the 32-question total.
//
// Every numeric answer is computed from the numbers in the passage rather than typed in by
// hand, and frontend/tests/mathScienceNewPages.test.js cross-checks them with literals.

const fmt = (n, dp = 0) => Number(n).toLocaleString("en-AU", { minimumFractionDigits: dp, maximumFractionDigits: dp });

// 1. Bacterial growth -------------------------------------------------------------------
const bact = { start: 500, doubleEvery: 40 };
const bactAt = minutes => bact.start * 2 ** (minutes / bact.doubleEvery);
const bactFirstOver = target => { let m = 0; while (bactAt(m) <= target) m += bact.doubleEvery; return m; };

// 2. Solar panels -----------------------------------------------------------------------
const solar = { perPanel: 1.2, panels: 15, cloudy: 0.6, battery: 13.5 };
const solarDemand = solar.perPanel * solar.panels;
const solarCloudy = solarDemand * solar.cloudy;
const solarShort = solarDemand - solarCloudy;

// 3. Pendulum ---------------------------------------------------------------------------
const pend = { lengths: [25, 50, 100], periods: [1.0, 1.4, 2.0] };

// 4. Trains -----------------------------------------------------------------------------
const trains = { a: 80, b: 120, headStartMin: 60 };
const trainGap = trains.a * trains.headStartMin / 60;
const trainCatch = trainGap / (trains.b - trains.a);
const trainDist = trains.b * trainCatch;

// 5. Fertiliser -------------------------------------------------------------------------
const fert = { kg: [0, 20, 40, 60], yield: [2.1, 3.0, 3.6, 3.7] };
const fertGain = fert.yield.slice(1).map((y, i) => +(y - fert.yield[i]).toFixed(2));
const fertPct = Math.round((fert.yield[3] - fert.yield[0]) / fert.yield[0] * 100);

// 6. Tokens -----------------------------------------------------------------------------
const bag = { red: 5, blue: 3, green: 2 };
const bagN = bag.red + bag.blue + bag.green;

// 7. Map scale --------------------------------------------------------------------------
const map = { scale: 25000, cm: 4.6, realKm: 3, areaCm2: 4 };
const mapKm = map.cm * map.scale / 100000;
const mapCm = map.realKm * 100000 / map.scale;
const mapHa = map.areaCm2 * (map.scale / 100) ** 2 / 10000;

// 8. Dilution ---------------------------------------------------------------------------
const dil = { vol: 0.25, conc: 0.40, newVol: 1.0, targetVol: 0.5, targetConc: 0.08 };
const dilMol = dil.vol * dil.conc;
const dilNew = dilMol / dil.newVol;
const dilStockMl = Math.round(dil.targetConc * dil.targetVol / dil.conc * 1000);

// 9. Appliance running cost -------------------------------------------------------------
const app = { oldKw: 2.0, newKw: 1.2, hours: 3, rate: 0.30, price: 216 };
const appKwh = app.oldKw * app.hours;
const appDay = appKwh * app.rate;
const appSave = (app.oldKw - app.newKw) * app.hours * app.rate;
const appPayback = Math.round(app.price / appSave);

// 10. Genetics --------------------------------------------------------------------------
const gen = { plants: 80, offspring: 200 };

const pages = [
  {
    key: "MATH-NEW-01",
    passage: `A microbiologist grows bacteria in a nutrient broth. The culture begins with ${bact.start} cells and the number of cells doubles every ${bact.doubleEvery} minutes while nutrients are plentiful. The microbiologist records the cell count at regular intervals.`,
    questions: [
      ["How many cells are expected after 2 hours (120 minutes)?", fmt(bactAt(120)), [fmt(bactAt(80)), fmt(bactAt(160)), fmt(bact.start * 3 * 2)], "120 minutes is 3 doublings: 500 × 2 × 2 × 2 = 4,000."],
      ["How many cells are expected after 4 hours (240 minutes)?", fmt(bactAt(240)), [fmt(bactAt(200)), fmt(bact.start * 6 * 2), fmt(bact.start * 240 / 40)], "240 minutes is 6 doublings: 500 × 2⁶ = 32,000."],
      ["After how many minutes will the culture first exceed 10,000 cells?", String(bactFirstOver(10000)), [String(bactFirstOver(10000) - 40), String(bactFirstOver(10000) + 40), "250"], "After 160 minutes there are 8,000 cells, which is not enough. After 200 minutes (5 doublings) there are 16,000 cells."]
    ]
  },
  {
    key: "MATH-NEW-02",
    passage: `A household uses ${fmt(solarDemand)} kWh of electricity each day. Each rooftop solar panel produces ${solar.perPanel} kWh on a sunny day. The household has ${solar.panels} panels. On a cloudy day each panel produces only ${solar.cloudy * 100}% of its sunny-day output. The household also has a battery that stores ${solar.battery} kWh.`,
    questions: [
      ["How much electricity do the panels produce on a sunny day?", `${fmt(solarDemand)} kWh`, ["1.2 kWh", "10.8 kWh", "16.2 kWh"], "15 panels × 1.2 kWh = 18 kWh."],
      ["How much electricity do the panels produce on a cloudy day?", `${fmt(solarCloudy, 1)} kWh`, ["7.2 kWh", "9.2 kWh", "12.0 kWh"], "60% of 18 kWh = 10.8 kWh."],
      ["On a cloudy day, how much electricity is the household short of its daily use?", `${fmt(solarShort, 1)} kWh`, ["10.8 kWh", "8.2 kWh", "6.0 kWh"], "The shortfall is 18 − 10.8 = 7.2 kWh."]
    ]
  },
  {
    key: "MATH-NEW-03",
    passage: `A student investigates how the length of a pendulum affects its period (the time for one full swing). The mass and the starting angle are kept the same. The results are: length ${pend.lengths[0]} cm, period ${pend.periods[0].toFixed(1)} s; length ${pend.lengths[1]} cm, period ${pend.periods[1].toFixed(1)} s; length ${pend.lengths[2]} cm, period ${pend.periods[2].toFixed(1)} s.`,
    questions: [
      ["Which variable is the independent variable in this investigation?", "The length of the pendulum", ["The period of the pendulum", "The mass of the pendulum", "The starting angle"], "The student deliberately changes the length and measures the period in response."],
      ["The length is increased from 25 cm to 100 cm. What happens to the period?", "It doubles", ["It quadruples", "It stays the same", "It increases by 1.0 s"], "The length is multiplied by 4, but the period rises from 1.0 s to 2.0 s, which is multiplied by 2."],
      ["Which conclusion is best supported by the results?", "Period increases with length, but not in direct proportion to it", ["Period is directly proportional to length", "Period does not depend on length", "Period decreases as length increases"], "If period were proportional to length, 4 times the length would give 4 times the period. It gives only 2 times."]
    ]
  },
  {
    key: "MATH-NEW-04",
    passage: `Train A leaves a station at 10:00 and travels at a constant ${trains.a} km/h along a straight track. Train B leaves the same station on the same track at 11:00 and travels at a constant ${trains.b} km/h in the same direction. Neither train stops.`,
    questions: [
      ["How far from the station is Train A when Train B departs?", `${trainGap} km`, [`${trains.b} km`, `${trains.a * 2} km`, `${trains.a / 2} km`], "Train A has travelled for 1 hour at 80 km/h, so it is 80 km from the station."],
      ["At what time does Train B catch Train A?", "13:00", ["12:00", "12:30", "14:00"], "Train B gains 120 − 80 = 40 km each hour, so the 80 km gap closes in 2 hours after 11:00."],
      ["How far from the station are the trains when Train B catches Train A?", `${trainDist} km`, [`${trainGap} km`, `${trains.a * 2} km`, `${trains.b * 3} km`], "Train B travels for 2 hours at 120 km/h: 240 km. Train A travels for 3 hours at 80 km/h: also 240 km."]
    ]
  },
  {
    key: "MATH-NEW-05",
    passage: `A farmer tests four amounts of fertiliser on identical plots of wheat. The yield is measured in tonnes per hectare. With ${fert.kg[0]} kg of fertiliser the yield is ${fert.yield[0]} t/ha; with ${fert.kg[1]} kg it is ${fert.yield[1]} t/ha; with ${fert.kg[2]} kg it is ${fert.yield[2]} t/ha; and with ${fert.kg[3]} kg it is ${fert.yield[3]} t/ha. Every plot received the same water and sunlight.`,
    questions: [
      ["How much does the yield increase when fertiliser rises from 0 kg to 20 kg?", `${fertGain[0]} t/ha`, ["3.0 t/ha", `${fertGain[1]} t/ha`, "1.5 t/ha"], "3.0 − 2.1 = 0.9 t/ha."],
      ["Which increase in fertiliser produced the smallest gain in yield?", "From 40 kg to 60 kg", ["From 0 kg to 20 kg", "From 20 kg to 40 kg", "All increases produced the same gain"], "The gains are 0.9, 0.6 and 0.1 t/ha, so the last 20 kg added only 0.1 t/ha."],
      ["What is the percentage increase in yield from 0 kg to 60 kg of fertiliser (to the nearest whole number)?", `${fertPct}%`, ["1.6%", "57%", "176%"], "The increase is 3.7 − 2.1 = 1.6 t/ha. 1.6 ÷ 2.1 × 100 ≈ 76%."]
    ]
  },
  {
    key: "MATH-NEW-06",
    passage: `A bag contains ${bagN} tokens: ${bag.red} red, ${bag.blue} blue and ${bag.green} green. Tokens are identical apart from colour and are mixed thoroughly before each draw.`,
    questions: [
      ["What is the probability that one token drawn at random is blue?", "3/10", ["3/7", "1/3", "3/5"], "There are 3 blue tokens out of 10, so the probability is 3/10."],
      ["Two tokens are drawn without replacement. What is the probability that both are red?", "2/9", ["1/4", "1/5", "5/18"], "The first is red with probability 5/10, then 4 reds remain among 9 tokens: 5/10 × 4/9 = 20/90 = 2/9."],
      ["A token is drawn, its colour is recorded and it is replaced. This is done 40 times. About how many red tokens are expected?", "20", ["5", "10", "25"], "Each draw is red with probability 1/2, so the expected number in 40 draws is 20. The actual number may differ."]
    ]
  },
  {
    key: "MATH-NEW-07",
    passage: `A walking map has a scale of 1 : ${fmt(map.scale)}. This means 1 cm on the map represents ${fmt(map.scale)} cm (${map.scale / 100} m) on the ground.`,
    questions: [
      [`Two huts are ${map.cm} cm apart on the map. How far apart are they on the ground?`, `${fmt(mapKm, 2)} km`, ["11.5 km", "0.115 km", "4.6 km"], "4.6 × 25,000 = 115,000 cm = 1,150 m = 1.15 km."],
      [`A track is ${map.realKm} km long. How long is it on the map?`, `${mapCm} cm`, ["7.5 cm", "120 cm", "1.2 cm"], "3 km = 300,000 cm. 300,000 ÷ 25,000 = 12 cm."],
      [`A lake covers ${map.areaCm2} cm² on the map. What is its real area?`, `${mapHa} hectares`, ["1 hectare", "100 hectares", "250 hectares"], "1 cm represents 250 m, so 1 cm² represents 62,500 m². 4 cm² = 250,000 m² = 25 hectares."]
    ]
  },
  {
    key: "MATH-NEW-08",
    passage: `A chemist has ${dil.vol * 1000} mL of a salt solution with a concentration of ${dil.conc.toFixed(2)} mol/L. Concentration is the amount of dissolved salt (in moles) divided by the volume of solution (in litres). The chemist adds water to make the volume up to ${dil.newVol.toFixed(1)} L.`,
    questions: [
      ["How many moles of salt are in the original solution?", `${dilMol.toFixed(2)} mol`, ["0.40 mol", "0.16 mol", "1.60 mol"], "Moles = concentration × volume = 0.40 mol/L × 0.25 L = 0.10 mol."],
      ["What is the concentration after the water is added to reach 1.0 L?", `${dilNew.toFixed(2)} mol/L`, ["0.40 mol/L", "0.25 mol/L", "0.05 mol/L"], "Adding water does not change the 0.10 mol of salt. 0.10 mol ÷ 1.0 L = 0.10 mol/L."],
      ["What volume of the 0.40 mol/L solution is needed to make 500 mL of 0.08 mol/L solution by adding water?", `${dilStockMl} mL`, ["80 mL", "250 mL", "40 mL"], "The final solution needs 0.08 × 0.5 = 0.04 mol. 0.04 ÷ 0.40 = 0.10 L = 100 mL."]
    ]
  },
  {
    key: "MATH-NEW-09",
    passage: `An old heater uses ${app.oldKw.toFixed(1)} kW of power and is switched on for ${app.hours} hours each day. A new, more efficient heater provides the same warmth but uses ${app.newKw.toFixed(1)} kW. Electricity costs $${app.rate.toFixed(2)} per kWh, and energy used in kWh equals power in kW multiplied by time in hours. The new heater costs $${app.price}.`,
    questions: [
      ["How much energy does the old heater use each day?", `${appKwh} kWh`, ["2 kWh", "3 kWh", "1.8 kWh"], "2.0 kW × 3 h = 6 kWh."],
      ["What does it cost to run the old heater for one day?", `$${appDay.toFixed(2)}`, ["$0.60", "$6.00", "$0.72"], "6 kWh × $0.30 = $1.80."],
      ["How much money does the new heater save each day?", `$${appSave.toFixed(2)}`, ["$0.80", "$1.08", "$0.24"], "The new heater saves 0.8 kW × 3 h = 2.4 kWh, and 2.4 × $0.30 = $0.72."],
      ["After how many days will the savings equal the purchase price of the new heater?", `${appPayback} days`, ["120 days", "270 days", "216 days"], "$216 ÷ $0.72 per day = 300 days."]
    ]
  },
  {
    key: "MATH-NEW-10",
    passage: "In a species of pea plant, tall (T) is dominant to short (t). A tall plant can have the genotype TT or Tt, and a short plant must have the genotype tt. Each parent passes on one of its two alleles to each offspring, and each allele is equally likely to be passed on.",
    questions: [
      ["Two plants with the genotype Tt are crossed. What is the probability that an offspring is short?", "1/4", ["1/2", "3/4", "0"], "An offspring is short only if it receives t from both parents: 1/2 × 1/2 = 1/4."],
      [`The cross Tt × Tt produces ${gen.plants} offspring. About how many are expected to be tall?`, String(gen.plants * 3 / 4), ["20", "40", "80"], "3/4 of the offspring are expected to be tall: 80 × 3/4 = 60."],
      ["A tall plant of unknown genotype is crossed with a short plant, and every one of 12 offspring is tall. Which conclusion is best supported?", "The tall parent is probably TT", ["The tall parent is definitely Tt", "The tall parent must be tt", "No conclusion is possible"], "A Tt parent would give about half short offspring. Twelve tall offspring in a row makes TT very likely, although it is not absolutely certain."],
      [`A Tt plant is crossed with a short plant and produces ${gen.offspring} offspring. About how many are expected to be short?`, String(gen.offspring / 2), ["50", "150", "200"], "Tt × tt gives Tt and tt equally often, so about half (100) are expected to be short."]
    ]
  }
];

const notes = Object.fromEntries(pages.map(page => [page.key, [
  "All figures in this passage are exact values used for practice.",
  "The passage should be read carefully before the questions are answered.",
  "Use the information given in the passage when answering the questions.",
  "Work from the information given rather than from outside knowledge."
]]));

module.exports = { newMathSciencePages: pages, newMathScienceNotes: notes };
