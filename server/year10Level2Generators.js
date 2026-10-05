const pick = (array) => array[Math.floor(Math.random() * array.length)];

function shuffle(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function four(answer, distractors) {
  const values = [String(answer), ...distractors.map(String)];
  const unique = [];
  for (const value of values) if (!unique.includes(value)) unique.push(value);
  while (unique.length < 4) unique.push(String(unique.length + 1));
  const options = shuffle(unique.slice(0, 4));
  return { options, index: options.indexOf(String(answer)) };
}

function humanitiesQuestion() {
  const topics = [
    ["a city tram network", "access, cost and reliability"],
    ["a community library", "access to services and long-term funding"],
    ["a coastal reserve", "conservation and public recreation"],
    ["a school phone policy", "concentration, safety and personal responsibility"],
    ["a town market", "local business and use of public space"],
    ["a youth arts program", "participation, funding and community benefit"]
  ];
  const [topic, issue] = pick(topics);
  const variant = pick(["however", "nevertheless", "in contrast", "at the same time"]);
  const type = Math.floor(Math.random() * 14);

  if (type === 0) {
    const name = pick(["Mia","Noah","Asha","Luca","Sienna","Eli"]);
    const passage = name + " expected the meeting about " + topic + " to produce a simple yes-or-no decision. Instead, speakers agreed on several facts but interpreted their importance differently. One resident argued that the proposal would improve " + issue + "; another accepted the possible benefit but questioned who would bear the cost. " + variant + ", both used evidence from the same report.";
    const r = four("People can interpret the same evidence differently when they give different weight to its consequences.", [
      "Disagreement shows that the evidence must be unreliable.",
      "People reach agreement whenever they use the same report.",
      "The financial cost is always more important than every other factor."
    ]);
    return { section:"humanities", difficulty:"hard", time:60, passage, question_text:"What conclusion is best supported by the passage?", answer_options:r.options, correct_answer:r.index, reasoning_type:"humanities:inference" };
  }

  if (type === 1) {
    const a = pick(["Elena","Marcus","Priya","Daniel"]);
    const b = pick(["a shop owner","a parent","a student","a council planner"]);
    const passage = a + " argues that " + topic + " should be expanded because it would improve " + issue + ". " + b + " accepts that benefit but warns that expansion could create a new problem unless limits are introduced.";
    const r = four("The speakers recognise a potential benefit but differ over risks and safeguards.", [
      "Both speakers believe the proposal has no benefit.",
      "The second speaker rejects the evidence entirely.",
      "Both speakers are primarily discussing advertising."
    ]);
    return { section:"humanities", difficulty:"hard", time:65, passage, question_text:"Which statement best compares the two viewpoints?", answer_options:r.options, correct_answer:r.index, reasoning_type:"humanities:viewpoints" };
  }

  if (type === 2) {
    const cities = ["A","B","C","D"];
    const data = cities.map((c,i)=>"Option "+c+" — reliability "+[5,4,3,2][i]+"/5; cost "+[4,2,3,1][i]+"/5; access "+[3,5,4,2][i]+"/5");
    const priority = pick(["reliability","cost","access"]);
    const best = priority === "reliability" ? "Option A" : priority === "cost" ? "Option D" : "Option B";
    const r = four(best, cities.filter(c=>"Option "+c!==best).map(c=>"Option "+c));
    return { section:"humanities", difficulty:"hard", time:65, passage:"Comparison data:\n"+data.join("\n"), question_text:"A decision-maker gives the highest priority to "+priority+". Which option is the best choice?", answer_options:r.options, correct_answer:r.index, reasoning_type:"humanities:data" };
  }

  if (type === 3) {
    const rows = [
      ["Plan Red","green space +20%","traffic +5%","within budget"],
      ["Plan Blue","green space +10%","traffic unchanged","within budget"],
      ["Plan Green","green space +25%","traffic +12%","over budget"],
      ["Plan Gold","green space unchanged","traffic -8%","within budget"]
    ];
    const best = rows[1][0];
    const r = four(best, rows.slice(0,1).concat(rows.slice(2)).map(x=>x[0]));
    return { section:"humanities", difficulty:"hard", time:65, passage:"Proposal summary:\n"+rows.map(x=>x.join(" — ")).join("\n"), question_text:"A community wants more green space, no increase in traffic, and a plan within budget. Which plan satisfies all three conditions?", answer_options:r.options, correct_answer:r.index, reasoning_type:"humanities:evaluation" };
  }

  if (type === 4) {
    const year = pick([1912,1931,1948,1963,1977]);
    const passage = "Source written in "+year+": “Supporters presented the change as a practical response to new circumstances. Opponents accepted some immediate benefits but questioned whether its longer-term effects had been examined.”";
    const r = four("The source presents both a claimed benefit and a concern about long-term consequences.", [
      "The source proves that everyone supported the change.",
      "The source gives no evidence of disagreement.",
      "The source says the change had already been reversed."
    ]);
    return { section:"humanities", difficulty:"hard", time:60, passage, question_text:"Which statement best captures the source?", answer_options:r.options, correct_answer:r.index, reasoning_type:"humanities:source" };
  }

  if (type === 5) {
    const product = pick(["a weekend pass","a new reading app","a museum membership","a city festival pass"]);
    const passage = "Advertisement: “Why leave possibilities unexplored? Choose "+product+" and turn an ordinary month into a collection of experiences. One simple decision. More to discover.”";
    const r = four("It appeals to the desire for variety and new experiences.", [
      "It relies mainly on fear of punishment.",
      "It proves that the product is the cheapest option.",
      "It encourages customers to avoid unfamiliar activities."
    ]);
    return { section:"humanities", difficulty:"medium", time:55, passage, question_text:"What desire does the advertisement appeal to most strongly?", answer_options:r.options, correct_answer:r.index, reasoning_type:"humanities:advertising" };
  }

  if (type === 6) {
    const groups = ["large cities","small cities","suburban areas","rural areas"];
    const base = pick([3600,4200,4800]);
    const vals = groups.map((g,i)=>g+": "+(base-i*540+(i%2)*90)+" net moves");
    const best = groups[0];
    const r = four(best, groups.slice(1));
    return { section:"humanities", difficulty:"hard", time:65, passage:"Net movement data:\n"+vals.join("\n"), question_text:"Which settlement type shows the largest net movement into it?", answer_options:r.options, correct_answer:r.index, reasoning_type:"humanities:flow-data" };
  }

  if (type === 7) {
    const rainfall = pick([42,58,71]);
    const passage = "A council measured water quality before and after a wetland restoration. Fish numbers rose, water became clearer and aquatic insects increased. The study lasted only three months, and rainfall varied considerably; the recorded rainfall during one monitoring period was "+rainfall+" mm.";
    const r = four("The results are promising, but the short study and changing rainfall limit how confidently long-term effects can be claimed.", [
      "The restoration definitely caused every observed change.",
      "Rainfall had no possible effect on the measurements.",
      "The data are useless because measurements were repeated."
    ]);
    return { section:"humanities", difficulty:"hard", time:65, passage, question_text:"Which is the most cautious conclusion?", answer_options:r.options, correct_answer:r.index, reasoning_type:"humanities:evidence" };
  }

  if (type === 8) {
    const counts = [
      pick([18,22,26]),
      pick([30,34,38]),
      pick([10,14,17]),
      pick([5,8,11])
    ];
    const passage = "Survey responses:\nStrongly support — "+counts[0]+"\nSupport — "+counts[1]+"\nNeutral — "+counts[2]+"\nOppose — "+counts[3];
    const r = four("Support has more responses than Strongly support, Neutral or Oppose.", [
      "Oppose has the largest number of responses.",
      "Neutral and Oppose are equal.",
      "Strongly support has more responses than every other category."
    ]);
    return { section:"humanities", difficulty:"medium", time:55, passage, question_text:"Which statement is directly supported by the survey?", answer_options:r.options, correct_answer:r.index, reasoning_type:"humanities:survey" };
  }

  if (type === 9) {
    const passage = "Event sequence:\n1. A proposal was announced.\n2. Residents submitted responses.\n3. Additional data were collected.\n4. The proposal was modified.\n5. A final decision was published.";
    const r = four("The proposal changed after both responses and additional evidence were considered.", [
      "The final decision came before residents responded.",
      "No new information was collected after the announcement.",
      "Residents responded only after the final decision."
    ]);
    return { section:"humanities", difficulty:"medium", time:55, passage, question_text:"Which statement best describes the sequence?", answer_options:r.options, correct_answer:r.index, reasoning_type:"humanities:sequence" };
  }

  if (type === 10) {
    const sourceTypes = ["a first-hand diary entry","a government summary written decades later","an anonymous social-media post","an advertisement published at the time"];
    const r = four("a first-hand diary entry", sourceTypes.slice(1));
    return { section:"humanities", difficulty:"hard", time:60, passage:"Possible sources:\n"+sourceTypes.join("\n"), question_text:"Which source would most directly reveal how an individual experienced an event at the time?", answer_options:r.options, correct_answer:r.index, reasoning_type:"humanities:sources" };
  }

  if (type === 11) {
    const word = pick(["qualified","tentative","selective","ambiguous","provisional"]);
    const definitions = {
      qualified:"limited or conditional",
      tentative:"not certain",
      selective:"carefully choosing",
      ambiguous:"open to more than one interpretation",
      provisional:"temporary and subject to change"
    };
    const answer = definitions[word];
    const r = four(answer, shuffle(Object.values(definitions).filter(v=>v!==answer)).slice(0,3));
    return { section:"humanities", difficulty:"medium", time:55, passage:"The writer described the conclusion as '"+word+"', adding that more evidence might change it.", question_text:"In this context, which meaning best matches '"+word+"'?", answer_options:r.options, correct_answer:r.index, reasoning_type:"humanities:vocabulary" };
  }

  if (type === 12) {
    const a = pick([14,16,18,20]);
    const b = pick([6,8,10,12]);
    const passage = "A historical population record reports "+a+" units in one decade and "+b+" in a later decade. The report notes that the change followed a period of migration.";
    const difference = a-b;
    const r = four(difference, [a+b,a/b,Math.abs(a+b)]);
    return { section:"humanities", difficulty:"medium", time:55, passage, question_text:"Which calculation gives the decrease between the two reported figures?", answer_options:r.options, correct_answer:r.index, reasoning_type:"humanities:quantitative-reading" };
  }

  const passage = "Two commentators discuss "+topic+". Commentator 1 argues that the proposal should be judged mainly by its immediate effect. Commentator 2 argues that the same proposal should be judged by its likely long-term consequences.";
  const r = four("They use different time horizons when evaluating the proposal.", [
    "They disagree about whether the proposal exists.",
    "They use completely different evidence about the same short-term outcome.",
    "They both argue that only financial information matters."
  ]);
  return { section:"humanities", difficulty:"hard", time:65, passage, question_text:"What is the key difference between the commentators' approaches?", answer_options:r.options, correct_answer:r.index, reasoning_type:"humanities:comparison" };
}

function mathematicsScienceQuestion() {
  const type = Math.floor(Math.random() * 18);

  if (type === 0) {
    const original = pick([160,180,240,320]), decrease = pick([15,20,25]), increase = pick([10,20]);
    const value = original * (1-decrease/100) * (1+increase/100);
    const r = four(value.toFixed(0), [
      (original*(1-decrease/100)).toFixed(0),
      (original*(1+increase/100)).toFixed(0),
      (original*(1-(decrease-increase)/100)).toFixed(0)
    ]);
    return { section:"mathematics_science", difficulty:"hard", time:65, question_text:"A quantity of "+original+" is reduced by "+decrease+"% and then increased by "+increase+"%. What is the final value?", answer_options:r.options, correct_answer:r.index, reasoning_type:"math:multi-step-percentage" };
  }

  if (type === 1) {
    const a = pick([12,15,18,21]), b = pick([7,9,11,13]), c = pick([14,16,20,22]), mean = pick([16,18,20]);
    const d = mean*4-a-b-c;
    const r = four(d,[d-2,d+2,mean]);
    return { section:"mathematics_science", difficulty:"medium", time:60, question_text:"Three measurements are "+a+", "+b+" and "+c+". What fourth measurement is needed to make the mean "+mean+"?", answer_options:r.options, correct_answer:r.index, reasoning_type:"math:mean" };
  }

  if (type === 2) {
    const r1=pick([2,3,4]), r2=pick([4,5,6]), r3=pick([3,4,5]), total=(r1+r2+r3)*pick([4,5]);
    const answer=total*r2/(r1+r2+r3);
    const r=four(answer,[total*r1/(r1+r2+r3),total*r3/(r1+r2+r3),answer+4]);
    return { section:"mathematics_science", difficulty:"hard", time:60, question_text:"Three components are in the ratio "+r1+":"+r2+":"+r3+". If there are "+total+" units altogether, how many are in the second component?", answer_options:r.options, correct_answer:r.index, reasoning_type:"math:ratio" };
  }

  if (type === 3) {
    const x=pick([3,4,5,6]), m=pick([2,3,4]), c=pick([1,2,5]), y=m*x+c;
    const r=four(x,[y,m+c,x+1]);
    return { section:"mathematics_science", difficulty:"medium", time:60, question_text:"For y = "+m+"x + "+c+", which value of x gives y = "+y+"?", answer_options:r.options, correct_answer:r.index, reasoning_type:"math:algebra" };
  }

  if (type === 4) {
    const base=pick([9,12,15,18]), height=pick([6,8,10]), area=base*height/2;
    const r=four(area,[base*height,area+height,area-base]);
    return { section:"mathematics_science", difficulty:"medium", time:60, question_text:"A triangle has base "+base+" cm and perpendicular height "+height+" cm. What is its area?", answer_options:r.options, correct_answer:r.index, reasoning_type:"math:geometry" };
  }

  if (type === 5) {
    const total=pick([20,24,30]), success=pick([6,8,9]), pct=(success/total)*100;
    const r=four(pct.toFixed(0)+"%",[(100-pct).toFixed(0)+"%",(pct/2).toFixed(0)+"%",(pct+5).toFixed(0)+"%"]);
    return { section:"mathematics_science", difficulty:"medium", time:55, question_text:"In a trial, "+success+" of "+total+" outcomes are successful. What percentage is successful?", answer_options:r.options, correct_answer:r.index, reasoning_type:"math:percentage" };
  }

  if (type === 6) {
    const start=pick([2,3,4,5]), factor=pick([2,3]), terms=[start];
    for(let i=1;i<5;i++) terms.push(terms[i-1]*factor);
    const answer=terms[4]*factor;
    const r=four(answer,[terms[4],answer+factor,answer-factor]);
    return { section:"mathematics_science", difficulty:"medium", time:55, question_text:"Find the next number: "+terms.join(", ")+", ?", answer_options:r.options, correct_answer:r.index, reasoning_type:"math:pattern" };
  }

  if (type === 7) {
    const rows=[
      ["A",pick([130,150,170]),pick([90,100,110])],
      ["B",pick([125,145,165]),pick([100,115,130])],
      ["C",pick([140,160,180]),pick([105,115,125])],
      ["D",pick([135,155,175]),pick([80,95,110])]
    ];
    const differences=rows.map(x=>x[1]-x[2]);
    const bestIndex=differences.indexOf(Math.max(...differences));
    const answer=rows[bestIndex][0];
    const r=four(answer,rows.filter((_,i)=>i!==bestIndex).map(x=>x[0]));
    return { section:"mathematics_science", difficulty:"hard", time:65, passage:"Data table:\n"+rows.map(x=>x[0]+" — week 1: "+x[1]+"; week 4: "+x[2]).join("\n"), question_text:"Which group shows the greatest decrease between the two weeks?", answer_options:r.options, correct_answer:r.index, reasoning_type:"math:data" };
  }

  if (type === 8) {
    const hours=pick([4,6,8,10]);
    const passage="Plant experiment:\nGroup A: "+hours+" hours of light/day\nGroup B: "+(hours+2)+" hours/day\nGroup C: "+(hours+4)+" hours/day\nSoil type, pot size and water are kept constant. Growth is measured after four weeks.";
    const r=four("hours of light",["soil type","pot size","amount of water"]);
    return { section:"mathematics_science", difficulty:"hard", time:60, passage, question_text:"Which variable is deliberately changed between the groups?", answer_options:r.options, correct_answer:r.index, reasoning_type:"science:variables" };
  }

  if (type === 9) {
    const repeats=pick([3,5,8]);
    const r=four("Repeat the experiment "+repeats+" times and compare the results while keeping other variables controlled.",[
      "Change several variables at once.",
      "Use only the trial that supports the prediction.",
      "Remove the measurements that disagree."
    ]);
    return { section:"mathematics_science", difficulty:"hard", time:65, question_text:"Which change would most improve the reliability of an experiment?", answer_options:r.options, correct_answer:r.index, reasoning_type:"science:design" };
  }

  if (type === 10) {
    const passage="Food web: algae are eaten by small crustaceans; small fish eat the crustaceans; larger fish eat the small fish. A pollutant sharply reduces the algae population for several weeks.";
    const r=four("The small crustacean population is likely to fall.",[
      "The larger fish population must immediately double.",
      "The pollutant increases the amount of algae available.",
      "The food web is unaffected because algae are not animals."
    ]);
    return { section:"mathematics_science", difficulty:"hard", time:65, passage, question_text:"What is the most likely consequence of the algae reduction?", answer_options:r.options, correct_answer:r.index, reasoning_type:"science:food-web" };
  }

  if (type === 11) {
    const rest=pick([600,750,900]), factor=pick([1.5,2,2.5]), newRate=rest*factor;
    const r=four(newRate,[newRate+rest,newRate-rest,rest]);
    return { section:"mathematics_science", difficulty:"medium", time:55, question_text:"A tissue receives "+rest+" mL of blood per minute at rest. During exercise its flow becomes "+factor+" times as large. What is the new rate?", answer_options:r.options, correct_answer:r.index, reasoning_type:"science:rate" };
  }

  if (type === 12) {
    const base=pick([2.5,3,4]), laps=pick([3,4,5]), distance=base*laps;
    const r=four(distance.toFixed(1)+" km",[(distance-base).toFixed(1)+" km",(distance+base).toFixed(1)+" km",(distance/2).toFixed(1)+" km"]);
    return { section:"mathematics_science", difficulty:"medium", time:55, question_text:"A runner covers "+base+" km per lap and completes "+laps+" laps. How far does the runner travel?", answer_options:r.options, correct_answer:r.index, reasoning_type:"math:measurement" };
  }

  if (type === 13) {
    const values=shuffle([18,24,30,36]), ordered=[...values].sort((a,b)=>a-b), answer=ordered[3]-ordered[2];
    const r=four(answer,[ordered[3],ordered[2],ordered[3]+ordered[2]]);
    return { section:"mathematics_science", difficulty:"medium", time:55, question_text:"The four values are "+values.join(", ")+". What is the difference between the largest and second-largest?", answer_options:r.options, correct_answer:r.index, reasoning_type:"math:comparison" };
  }

  if (type === 14) {
    const initial=pick([45,90,135]), turn=pick([45,90,135]), answer=(initial+turn)%360;
    const r=four(answer+"°",[((initial-turn)+360)%360+"°",(initial+2*turn)%360+"°",(answer+90)%360+"°"]);
    return { section:"mathematics_science", difficulty:"hard", time:60, question_text:"A direction is initially "+initial+"°. It is rotated clockwise by "+turn+"°. What is the new direction?", answer_options:r.options, correct_answer:r.index, reasoning_type:"math:spatial" };
  }

  if (type === 15) {
    const mass=pick([240,300,360]), percent=pick([20,25,30]), part=mass*percent/100;
    const r=four(part,[mass-percent,mass+part,mass*(1-percent/100)]);
    return { section:"mathematics_science", difficulty:"medium", time:55, question_text:"A sample has a mass of "+mass+" g. "+percent+"% of it is a particular component. What is the mass of that component?", answer_options:r.options, correct_answer:r.index, reasoning_type:"math:percentage" };
  }

  if (type === 16) {
    const duration=pick([40,55,70]), rate=pick([12,15,18]), output=duration*rate;
    const r=four(output,[output-rate,output+rate,output/duration]);
    return { section:"mathematics_science", difficulty:"hard", time:60, question_text:"A machine produces "+rate+" units per minute for "+duration+" minutes. How many units does it produce?", answer_options:r.options, correct_answer:r.index, reasoning_type:"math:rate" };
  }

  const passage="An experiment compares two materials. Material A is heated from 20°C to 40°C and expands by 3 mm. Material B is heated through the same temperature change and expands by 5 mm. All other conditions are kept constant.";
  const r=four("Material B expands more for the same temperature increase.",[
    "Material A expands more because it started colder.",
    "Both materials expand by the same amount.",
    "No comparison is possible because temperature was measured."
  ]);
  return { section:"mathematics_science", difficulty:"hard", time:65, passage, question_text:"Which conclusion is supported by the information?", answer_options:r.options, correct_answer:r.index, reasoning_type:"science:comparison" };
}

function questionFingerprint(question) {
  return JSON.stringify([
    question.section,
    String(question.question_text || "").trim().replace(/\\s+/g, " "),
    String(question.passage || "").trim().replace(/\\s+/g, " ")
  ]);
}

function questionType(question) {
  return question.reasoning_type || String(question.section || "other") + ":other";
}

function pickDiverseQuestions(candidates, count, usedFingerprints, initialLastType = "") {
  const buckets = new Map();
  for (const candidate of shuffle(candidates)) {
    const fp = questionFingerprint(candidate);
    if (usedFingerprints.has(fp)) continue;
    const type = questionType(candidate);
    if (!buckets.has(type)) buckets.set(type, []);
    buckets.get(type).push(candidate);
  }
  for (const bucket of buckets.values()) shuffle(bucket);
  const result = [];
  let lastType = initialLastType;
  while (result.length < count) {
    const types = [...buckets.keys()].filter(type => buckets.get(type).length > 0 && type !== lastType);
    if (!types.length) break;
    const type = pick(types);
    const item = buckets.get(type).pop();
    item.reasoning_type = type;
    result.push(item);
    lastType = type;
  }
  return result;
}

function getWritingTasks() {
  return [
    {
      id: "we-1",
      title: "Written Expression 1",
      time: 25 * 60,
      prompt: "Write a piece in response to this idea: A decision that seems small can sometimes change everything. You may write a story, persuasive piece, discussion or personal reflection."
    },
    {
      id: "we-2",
      title: "Written Expression 2",
      time: 25 * 60,
      prompt: "Write a piece in response to this idea: People often notice what is missing before they notice what is present. You may write a story, persuasive piece, discussion or personal reflection."
    }
  ];
}

module.exports = {
  humanitiesQuestion,
  mathematicsScienceQuestion,
  questionFingerprint,
  questionType,
  pickDiverseQuestions,
  getWritingTasks
};
