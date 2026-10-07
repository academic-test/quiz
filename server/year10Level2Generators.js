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
  while (unique.length < 4) { let filler = 1; while (unique.includes(String(filler))) filler += 1; unique.push(String(filler)); }
  const options = shuffle(unique.slice(0, 4));
  return { options, index: options.indexOf(String(answer)) };
}

function validQuestionShape(question) {
  const options = Array.isArray(question?.answer_options) ? question.answer_options : [];
  if (options.length !== 4) return false;

  const normalised = options.map(value => String(value ?? "").trim().replace(/\s+/g, " "));
  if (normalised.some(value => !value)) return false;
  if (new Set(normalised).size !== 4) return false;

  const correct = Number(question?.correct_answer);
  return Number.isInteger(correct) && correct >= 0 && correct < 4;
}

function humanitiesQuestion() {
  const type = Math.floor(Math.random() * 30);

  if (type === 0) {
    const items = [
      {
        passage: "In her diary, Lena described the town hall meeting as polite but uneasy. Supporters repeatedly referred to the plan's immediate benefits, while opponents kept returning to what might happen after five years. No speaker disputed the figures in the report; they disagreed about how much weight the figures should carry.",
        q: "What best explains the disagreement?",
        a: "The speakers place different importance on short- and long-term consequences.",
        d: ["The speakers are using completely different data.", "The figures in the report were proven false.", "The meeting focused on a topic unrelated to the plan."]
      },
      {
        passage: "A museum guide noted that visitors often stopped longest at a faded photograph. The image showed an ordinary street, yet people kept pointing to details in the background. The guide suggested that the photograph mattered less for its composition than for the clues it offered about a way of life that had since disappeared.",
        q: "Why does the photograph attract attention?",
        a: "It provides clues about a past way of life.",
        d: ["It is the museum's most colourful work.", "It was painted by a famous modern artist.", "It shows an event that visitors witnessed personally."]
      },
      {
        passage: "When the new footbridge opened, residents initially praised its appearance. A year later, the council found that people were using it at different times for different reasons: commuters valued the shorter route, older residents valued the handrails, and shopkeepers valued the extra foot traffic. A single measure of 'success' did not capture all these effects.",
        q: "What conclusion is best supported?",
        a: "The value of a public project can depend on the priorities of different users.",
        d: ["Public projects should have only one intended use.", "The bridge failed because residents used it differently.", "Shopkeepers were the only group to benefit."]
      }
    ];
    const item = pick(items);
    const r = four(item.a, item.d);
    return { section:"humanities", difficulty:"hard", time:70, passage:item.passage, question_text:item.q, answer_options:r.options, correct_answer:r.index, reasoning_type:"humanities:literary-inference" };
  }

  if (type === 1) {
    const items = [
      ["The writer calls the proposal 'ambitious, but not yet convincing' and notes that several assumptions remain untested.", "cautious"],
      ["The article describes the decision as 'an avoidable mistake' and lists consequences in increasingly severe terms.", "critical"],
      ["The speaker thanks the committee for listening before calmly explaining why the recommendation should still be reconsidered.", "respectful but questioning"],
      ["The reviewer repeatedly uses phrases such as 'surprisingly effective' and 'far better than expected'.", "strongly approving"],
      ["The memoir describes the old station with warm details, but also hints that some memories are unreliable.", "nostalgic but reflective"],
      ["The report states that the evidence is incomplete and recommends further investigation before any final judgement.", "tentative"]
    ];
    const item = pick(items);
    const r = four(item[1], shuffle(["angry","humorous","celebratory"]).slice(0,3));
    return { section:"humanities", difficulty:"hard", time:60, passage:item[0], question_text:"Which tone best describes the passage?", answer_options:r.options, correct_answer:r.index, reasoning_type:"humanities:tone" };
  }

  if (type === 2) {
    const topic = pick(["a late-night bus service","a ban on single-use drink containers","a new community sports centre","a proposed park redevelopment"]);
    const first = pick(["emphasises immediate convenience","emphasises environmental costs","emphasises access for families","emphasises the effect on local businesses"]);
    const second = pick(["questions long-term costs","questions whether alternatives were considered","questions whether benefits will be shared equally","questions whether the evidence is strong enough"]);
    const passage = "Two commentators discuss " + topic + ". Commentator A " + first + ", while Commentator B " + second + ". Both refer to the same council report but select different consequences to emphasise.";
    const r = four("They use the same evidence but give different weight to different consequences.", [
      "They disagree about whether the council exists.",
      "They rely on completely unrelated topics.",
      "They both argue that only cost matters."
    ]);
    return { section:"humanities", difficulty:"hard", time:65, passage, question_text:"What is the key difference between the commentators' approaches?", answer_options:r.options, correct_answer:r.index, reasoning_type:"humanities:viewpoint-comparison" };
  }

  if (type === 3) {
    const rows = [
      ["North","reliability 5/5","cost 3/5","access 2/5"],
      ["East","reliability 4/5","cost 5/5","access 4/5"],
      ["South","reliability 3/5","cost 2/5","access 5/5"],
      ["West","reliability 2/5","cost 4/5","access 3/5"]
    ];
    const priority = pick(["reliability","cost","access"]);
    const map = { reliability:"North", cost:"East", access:"South" };
    const answer = map[priority];
    const r = four(answer, ["North","East","South","West"].filter(x => x !== answer));
    return { section:"humanities", difficulty:"hard", time:60, passage:"Comparison table:\n" + rows.map(x=>x.join(" — ")).join("\n"), question_text:"A decision-maker gives the highest priority to " + priority + ". Which option is best?", answer_options:r.options, correct_answer:r.index, reasoning_type:"humanities:data-priority" };
  }

  if (type === 4) {
    const plans = [
      ["Plan A","trees +20%","traffic +3%","within budget"],
      ["Plan B","trees +10%","traffic unchanged","within budget"],
      ["Plan C","trees +30%","traffic +12%","over budget"],
      ["Plan D","trees unchanged","traffic -5%","within budget"]
    ];
    const constraints = pick([
      "more trees, no increase in traffic, and staying within budget",
      "lower traffic, no loss of trees, and staying within budget",
      "more trees and more traffic allowed, but staying within budget"
    ]);
    let answer;
    if (constraints.startsWith("more trees, no")) answer = "Plan B";
    else if (constraints.startsWith("lower traffic")) answer = "Plan D";
    else answer = "Plan A";
    const r = four(answer, plans.map(x=>x[0]).filter(x=>x!==answer));
    return { section:"humanities", difficulty:"hard", time:65, passage:"Proposal summary:\n" + plans.map(x=>x.join(" — ")).join("\n"), question_text:"Which plan satisfies the stated requirements: " + constraints + "?", answer_options:r.options, correct_answer:r.index, reasoning_type:"humanities:constraint-evaluation" };
  }

  if (type === 5) {
    const cities = ["Harbour","Ridge","Plain","Valley"];
    const start = pick([820,960,1100]);
    const step = pick([70,90,110]);
    const values = cities.map((c,i)=>[c,start + i*step]);
    const direction = pick(["increases steadily","decreases steadily","remains unchanged"]);
    if (direction === "decreases steadily") values.reverse();
    if (direction === "remains unchanged") values.forEach(x=>x[1]=start);
    const r = four(direction, [
      "rises sharply then falls",
      "changes direction twice",
      "cannot be compared"
    ]);
    return { section:"humanities", difficulty:"medium", time:55, passage:"Population index:\n" + values.map(x=>x[0] + ": " + x[1]).join("\n"), question_text:"Which description best matches the pattern shown?", answer_options:r.options, correct_answer:r.index, reasoning_type:"humanities:trend-data" };
  }

  if (type === 6) {
    const passage = "A survey of 420 residents found that 62% supported extending library opening hours. The survey was conducted online over three days and was promoted on the library's social-media page.";
    const r = four("The exact views of all residents cannot be known from this survey alone.", [
      "Exactly 62% of every resident supports the proposal.",
      "The survey proves that the proposal will reduce costs.",
      "The online responses must represent every age group equally."
    ]);
    return { section:"humanities", difficulty:"hard", time:65, passage, question_text:"Which conclusion cannot be claimed with certainty from the information?", answer_options:r.options, correct_answer:r.index, reasoning_type:"humanities:limit-of-evidence" };
  }

  if (type === 7) {
    const sources = [
      ["a signed diary entry written during the event","direct first-hand evidence"],
      ["a government summary written twenty years later","secondary account"],
      ["an anonymous comment posted recently","unclear provenance"],
      ["a textbook chapter that compares several sources","synthesised secondary account"]
    ];
    const item = pick(sources);
    const r = four(item[1], shuffle(["direct first-hand evidence","secondary account","unclear provenance"]).filter(x=>x!==item[1]).slice(0,3));
    return { section:"humanities", difficulty:"hard", time:60, passage:"Possible source: " + item[0] + ".", question_text:"How should this source best be described?", answer_options:r.options, correct_answer:r.index, reasoning_type:"humanities:source-type" };
  }

  if (type === 8) {
    const passage = "A newspaper editorial arguing for a new stadium quotes three local business owners who support the project. It does not mention the residents' group that has published a detailed objection.";
    const r = four("The editorial may give a one-sided picture because it selects supportive voices.", [
      "The stadium project is definitely harmful.",
      "All business owners oppose the project.",
      "The residents' group has no evidence."
    ]);
    return { section:"humanities", difficulty:"hard", time:65, passage, question_text:"What limitation should a reader notice?", answer_options:r.options, correct_answer:r.index, reasoning_type:"humanities:bias" };
  }

  if (type === 9) {
    const products = ["the museum night pass","the festival membership","the travel card","the weekend discovery pass"];
    const product = pick(products);
    const passage = "Advertisement: \"" + product + " — one decision, many possibilities. Try something unfamiliar, follow a new path and make this month larger than the last.\"";
    const r = four("It appeals to curiosity and the desire for new experiences.", [
      "It mainly appeals to fear of punishment.",
      "It proves the product is the cheapest available.",
      "It discourages people from trying unfamiliar activities."
    ]);
    return { section:"humanities", difficulty:"medium", time:55, passage, question_text:"What desire does the advertisement appeal to most strongly?", answer_options:r.options, correct_answer:r.index, reasoning_type:"humanities:advertising-purpose" };
  }

  if (type === 10) {
    const scenes = [
      "A cartoon shows a person carrying an enormous stack of forms while a sign above a tiny counter says 'Simple Application'.",
      "A cartoon shows two clocks labelled 'meeting starts' and 'meeting actually starts', with the second clock far ahead.",
      "A cartoon shows a manager praising a worker for being 'highly flexible' while the worker is visibly tied to a desk."
    ];
    const interpretations = [
      ["The cartoon is mocking a process described as simple even though it is burdensome.","irony"],
      ["The cartoon is criticising the gap between an official schedule and what actually happens.","contrast"],
      ["The cartoon is questioning whether a positive description matches the worker's reality.","irony"]
    ];
    const item = interpretations[pick(scenes.map((_,i)=>i))];
    const scene = scenes[interpretations.indexOf(item)];
    const r = four(item[1], ["celebration","historical nostalgia","literal instruction"]);
    return { section:"humanities", difficulty:"hard", time:60, passage:scene, question_text:"What device is most important to the cartoon's message?", answer_options:r.options, correct_answer:r.index, reasoning_type:"humanities:cartoon-inference" };
  }

  if (type === 11) {
    const passage = "A project was announced. Residents submitted responses. Engineers collected extra measurements. The design was amended. A revised proposal was published. The council then scheduled a final vote.";
    const r = four("The design was changed after both public responses and additional measurements.", [
      "The final vote occurred before the proposal was published.",
      "Extra measurements were collected after the final vote.",
      "Residents responded only after the design had been finalised."
    ]);
    return { section:"humanities", difficulty:"medium", time:55, passage, question_text:"Which statement best describes the sequence?", answer_options:r.options, correct_answer:r.index, reasoning_type:"humanities:chronology" };
  }

  if (type === 12) {
    const quote = pick([
      "We had little time, but we learned more from the failed attempt than from the easy successes.",
      "The new rule was praised as efficient, yet its effects on people with fewer resources were not considered.",
      "The explorer wrote that reaching the summit mattered less than what the difficult journey had revealed."
    ]);
    const r = four("The speaker values what can be learned from experience, not simply the final outcome.", [
      "The speaker believes failure always makes people weaker.",
      "The speaker thinks outcomes are irrelevant.",
      "The speaker argues that difficult tasks should be avoided."
    ]);
    return { section:"humanities", difficulty:"hard", time:65, passage:quote, question_text:"Which interpretation is best supported?", answer_options:r.options, correct_answer:r.index, reasoning_type:"humanities:quotation-interpretation" };
  }

  if (type === 13) {
    const words = [
      ["qualified","limited or conditional"],
      ["tentative","not certain"],
      ["ambiguous","open to more than one interpretation"],
      ["provisional","temporary and subject to change"],
      ["selective","carefully choosing some things rather than all"]
    ];
    const item = pick(words);
    const passage = "The writer described the conclusion as '" + item[0] + "', adding that new evidence could change it.";
    const r = four(item[1], shuffle(words.filter(x=>x[0]!==item[0]).map(x=>x[1])).slice(0,3));
    return { section:"humanities", difficulty:"medium", time:55, passage, question_text:"In this context, which meaning best matches '" + item[0] + "'?", answer_options:r.options, correct_answer:r.index, reasoning_type:"humanities:vocabulary-context" };
  }

  if (type === 14) {
    const items = [
      ["A town restored an old theatre. Attendance initially rose, local businesses benefited, and the building became a venue for school performances and community meetings.","The restored theatre became useful to the wider community in several ways."],
      ["A researcher compared two explanations for falling bird numbers. Both fit some observations, but one required fewer unsupported assumptions and matched more of the measured data.","The stronger explanation was the one that fitted the evidence with fewer unsupported assumptions."],
      ["A school changed its timetable. Students appreciated having longer breaks, but transport services became harder to coordinate and some after-school activities started later.","A single change can create benefits as well as practical trade-offs."]
    ];
    const item = pick(items);
    const r = four(item[1], [
      "The passage mainly describes a complete failure.",
      "The passage proves that one group is always correct.",
      "The passage contains no evidence for its conclusion."
    ]);
    return { section:"humanities", difficulty:"hard", time:65, passage:item[0], question_text:"Which statement best gives the main idea?", answer_options:r.options, correct_answer:r.index, reasoning_type:"humanities:main-idea" };
  }

  if (type === 15) {
    const passage = "After a wetland was restored, fish numbers increased and the water became clearer. However, rainfall was unusually high during the study, and the monitoring period lasted only three months.";
    const r = four("The restoration may have helped, but other factors mean the result should be interpreted cautiously.", [
      "The restoration definitely caused every change.",
      "Rainfall could not have affected the result.",
      "A three-month study is enough to prove all long-term effects."
    ]);
    return { section:"humanities", difficulty:"hard", time:65, passage, question_text:"Which is the most defensible conclusion?", answer_options:r.options, correct_answer:r.index, reasoning_type:"humanities:evidence-and-alternative" };
  }

  if (type === 16) {
    const support = pick([44,48,52]);
    const oppose = pick([12,16,20]);
    const neutral = 100 - support - oppose;
    const passage = "Survey of respondents:\nSupport: " + support + "%\nNeutral: " + neutral + "%\nOppose: " + oppose + "%";
    const r = four("Support was the largest of the three categories.", [
      "Oppose was larger than support.",
      "Neutral was exactly half of support.",
      "All respondents had the same view."
    ]);
    return { section:"humanities", difficulty:"medium", time:55, passage, question_text:"Which statement is directly supported by the survey?", answer_options:r.options, correct_answer:r.index, reasoning_type:"humanities:survey" };
  }

  if (type === 17) {
    const start = pick(["north-east","south-east","south-west","north-west"]);
    const clockwise = pick([45,90,135]);
    const directions = ["north","north-east","east","south-east","south","south-west","west","north-west"];
    let index = directions.indexOf(start);
    index = (index + Math.round(clockwise/45)) % 8;
    const answer = directions[index];
    const r = four(answer, directions.filter(x=>x!==answer).slice(0,3));
    return { section:"humanities", difficulty:"hard", time:60, passage:"A vehicle is initially heading " + start + " and turns clockwise by " + clockwise + " degrees.", question_text:"Which direction is it heading after the turn?", answer_options:r.options, correct_answer:r.index, reasoning_type:"humanities:spatial-direction" };
  }

  if (type === 18) {
    const passage = "Source A, written immediately after the event, says the crowd was small. Source B, a later newspaper summary, says thousands attended. A photograph taken that afternoon shows a dense crowd near the main entrance.";
    const r = four("The photograph provides independent evidence that can be compared with both written sources.", [
      "The photograph proves exactly how many people attended.",
      "Source B must be correct because it was published later.",
      "Source A must be correct because it was written first."
    ]);
    return { section:"humanities", difficulty:"hard", time:70, passage, question_text:"What is the most useful way to use the photograph?", answer_options:r.options, correct_answer:r.index, reasoning_type:"humanities:corroboration" };
  }

  if (type === 19) {
    const passage = "A council can either spend its available funds on a new sports court or upgrade an older community hall. The court would benefit more young people, while the hall is used by a wider range of age groups and currently needs urgent repairs.";
    const r = four("The decision involves a trade-off between the size of the beneficiary group and the urgency and breadth of the existing need.", [
      "The option helping more young people must always be chosen.",
      "Urgent repairs can never outweigh future benefits.",
      "The two projects have exactly the same consequences."
    ]);
    return { section:"humanities", difficulty:"hard", time:65, passage, question_text:"Which statement best describes the decision?", answer_options:r.options, correct_answer:r.index, reasoning_type:"humanities:policy-tradeoff" };
  }

  if (type === 20) {
    const values = shuffle([12,15,17,18,19,41]);
    const ordered = [...values].sort((a,b)=>a-b);
    const r = four(41, [12,18,19]);
    return { section:"humanities", difficulty:"medium", time:55, passage:"Daily visitor counts: " + values.join(", "), question_text:"Which value is the most obvious outlier in this data set?", answer_options:r.options, correct_answer:r.index, reasoning_type:"humanities:outlier" };
  }

  if (type === 21) {
    const headlines = [
      ["Council approves revised bike plan","neutral"],
      ["Council finally admits bike plan was flawed","critical"],
      ["Council unveils exciting new bike plan","positive"]
    ];
    const item = pick(headlines);
    const r = four(item[1], ["critical","positive","neutral"].filter(x=>x!==item[1]));
    return { section:"humanities", difficulty:"hard", time:55, passage:"Headline: " + item[0], question_text:"What tone does the headline most strongly convey?", answer_options:r.options, correct_answer:r.index, reasoning_type:"humanities:framing" };
  }

  if (type === 22) {
    const passage = "The town introduced a free shuttle. Within six months, foot traffic around the central shops increased. A separate report also shows that the main road was partially closed for construction during the same period.";
    const r = four("The increase in foot traffic may have more than one possible explanation.", [
      "The shuttle definitely caused the entire increase.",
      "Road construction could not have changed shopping behaviour.",
      "The data prove that every resident used the shuttle."
    ]);
    return { section:"humanities", difficulty:"hard", time:65, passage, question_text:"Which conclusion is most appropriate?", answer_options:r.options, correct_answer:r.index, reasoning_type:"humanities:causal-reasoning" };
  }

  if (type === 23) {
    const passage = "A museum's attendance rose from 18 000 to 21 000 after a new evening program began. During the same months, a major school holiday exhibition was also running.";
    const r = four("The attendance increase cannot be attributed to the evening program alone from this information.", [
      "The evening program had no effect.",
      "The school holiday exhibition reduced attendance.",
      "Attendance would have fallen without the program."
    ]);
    return { section:"humanities", difficulty:"hard", time:65, passage, question_text:"What can most reasonably be inferred?", answer_options:r.options, correct_answer:r.index, reasoning_type:"humanities:confounding-factor" };
  }

  if (type === 24) {
    const source = pick([
      ["a personal diary","first-hand personal source"],
      ["a newspaper editorial","opinionated commentary"],
      ["a census table","statistical record"],
      ["a political campaign poster","persuasive source"],
      ["a laboratory report","scientific report"]
    ]);
    const r = four(source[1], [
      "first-hand personal source","opinionated commentary","statistical record"
    ].filter(x=>x!==source[1]).concat(source[1]==="statistical record"?["persuasive source"]:[]).slice(0,3));
    return { section:"humanities", difficulty:"medium", time:55, passage:"Source presented: " + source[0] + ".", question_text:"Which category best describes this source?", answer_options:r.options, correct_answer:r.index, reasoning_type:"humanities:source-classification" };
  }

  if (type === 25) {
    const passage = "A proposal claims that extending the library's opening hours will increase student reading. The evidence cited is that students who already use the library frequently tend to read more.";
    const r = four("Students who would use the longer opening hours will respond in the same way as the students already observed.", [
      "Libraries are always open at the best time.",
      "Every student prefers reading to other activities.",
      "The existing users are a random sample of all students."
    ]);
    return { section:"humanities", difficulty:"hard", time:70, passage, question_text:"Which assumption is needed for the argument to be persuasive?", answer_options:r.options, correct_answer:r.index, reasoning_type:"humanities:assumption" };
  }

  if (type === 26) {
    const passage = "Argument A gives one example of a successful school garden. Argument B compares results from twelve schools, notes differences in rainfall and explains how the measurements were collected.";
    const r = four("Argument B is stronger because it uses broader evidence and addresses relevant differences.", [
      "Argument A is stronger because examples are always better than data.",
      "Argument A is stronger because it is shorter.",
      "The two arguments are equally supported."
    ]);
    return { section:"humanities", difficulty:"hard", time:65, passage, question_text:"Which argument is better supported?", answer_options:r.options, correct_answer:r.index, reasoning_type:"humanities:argument-strength" };
  }

  if (type === 27) {
    const horizon = pick(["immediate effect","effect over five years","effect on the next generation"]);
    const passage = "Two commentators evaluate the same transport proposal. One focuses on its " + horizon + ". The other focuses on the financial and environmental consequences over a different time period.";
    const r = four("They may reach different judgements because they are evaluating different time horizons.", [
      "They must be using different facts about the proposal.",
      "Only one commentator has considered evidence.",
      "A proposal cannot have more than one consequence."
    ]);
    return { section:"humanities", difficulty:"hard", time:60, passage, question_text:"Why might the commentators reach different judgements?", answer_options:r.options, correct_answer:r.index, reasoning_type:"humanities:time-horizon" };
  }

  if (type === 28) {
    const passage = "A school reports that students who join the new study club tend to achieve higher marks. The report gives the students' marks and attendance at the club but does not say whether they were already high-achieving before joining.";
    const r = four("Whether club members already differed from other students before joining.", [
      "The colour of the club's logo.",
      "The exact day on which the club began.",
      "Whether the school has a sports team."
    ]);
    return { section:"humanities", difficulty:"hard", time:65, passage, question_text:"Which missing information would most help interpret the result?", answer_options:r.options, correct_answer:r.index, reasoning_type:"humanities:missing-information" };
  }

  if (type === 29) {
    const passage = "A new pedestrian crossing appears safer because fewer accidents were reported after it was installed. However, the road also became busier during the same period.";
    const r = four("Compare accident rates with traffic volume before and after the installation.", [
      "Ask drivers whether they like the crossing.",
      "Measure the colour of the road markings only.",
      "Ignore traffic volume because accidents were reported."
    ]);
    return { section:"humanities", difficulty:"hard", time:65, passage, question_text:"Which additional evidence would best test the safety claim?", answer_options:r.options, correct_answer:r.index, reasoning_type:"humanities:best-next-evidence" };
  }
}

function mathematicsScienceQuestion() {
  const type = Math.floor(Math.random() * 41);

  if (type === 0) {
    const original=pick([160,180,240,320]), decrease=pick([10,15,20,25]), increase=pick([10,15,20]);
    const value=original*(1-decrease/100)*(1+increase/100);
    const r=four(value.toFixed(0),[
      (original*(1-decrease/100)).toFixed(0),
      (original*(1+increase/100)).toFixed(0),
      (original*(1-(decrease-increase)/100)).toFixed(0)
    ]);
    return {section:"mathematics_science",difficulty:"hard",time:65,question_text:"A quantity of "+original+" is reduced by "+decrease+"% and then increased by "+increase+"%. What is the final value?",answer_options:r.options,correct_answer:r.index,reasoning_type:"math:multi-step-percentage"};
  }

  if (type === 1) {
    const original=pick([72,80,96,120]), pct=pick([20,25,30,40]), final=original*(1+pct/100);
    const r=four(original,[final,final-pct,original-pct]);
    return {section:"mathematics_science",difficulty:"hard",time:60,question_text:"A value becomes "+final+" after increasing by "+pct+"%. What was the original value?",answer_options:r.options,correct_answer:r.index,reasoning_type:"math:reverse-percentage"};
  }

  if (type === 2) {
    const [a,b,c]=shuffle([2,3,4,5,6]).slice(0,3),total=(a+b+c)*pick([4,5]);
    const answer=total*b/(a+b+c);
    const r=four(answer,[total*a/(a+b+c),total*c/(a+b+c),answer+4]);
    return {section:"mathematics_science",difficulty:"hard",time:60,question_text:"Three components are in the ratio "+a+":"+b+":"+c+". If there are "+total+" units altogether, how many are in the second component?",answer_options:r.options,correct_answer:r.index,reasoning_type:"math:ratio"};
  }

  if (type === 3) {
    const rate=pick([6,8,12,15]), amount=pick([4,5,7]), answer=rate*amount;
    const r=four(answer,[answer+rate,answer-rate,amount*amount]);
    return {section:"mathematics_science",difficulty:"medium",time:55,question_text:"If "+rate+" units are needed for each item, how many units are needed for "+amount+" items?",answer_options:r.options,correct_answer:r.index,reasoning_type:"math:direct-proportion"};
  }

  if (type === 4) {
    const metres=pick([1.2,1.5,2.4,3.6]), centimetres=metres*100;
    const r=four(centimetres+" cm",[metres+" cm",(metres*10)+" cm",(metres*1000).toFixed(0)+" cm"]);
    return {section:"mathematics_science",difficulty:"medium",time:50,question_text:"A length is "+metres+" m. What is the length in centimetres?",answer_options:r.options,correct_answer:r.index,reasoning_type:"math:unit-conversion"};
  }

  if (type === 5) {
    const l=pick([9,11,14]),w=pick([5,6,8]), border=pick([1,2]);
    const outer=(l+2*border)*(w+2*border), inner=l*w, answer=outer-inner;
    const r=four(answer,[2*(l+w),outer,inner+border]);
    return {section:"mathematics_science",difficulty:"hard",time:65,question_text:"A rectangular sign is "+l+" cm by "+w+" cm. A uniform border "+border+" cm wide surrounds it. What is the area of the border?",answer_options:r.options,correct_answer:r.index,reasoning_type:"math:composite-geometry"};
  }

  if (type === 6) {
    const a=pick([4,5,6]),b=pick([3,4,5]),h=pick([5,6,8]),vol=a*b*h;
    const r=four(vol,[a*b+h,a*b*2,vol+h]);
    return {section:"mathematics_science",difficulty:"medium",time:55,question_text:"A rectangular prism measures "+a+" cm by "+b+" cm by "+h+" cm. What is its volume?",answer_options:r.options,correct_answer:r.index,reasoning_type:"math:volume"};
  }

  if (type === 7) {
    const den=pick([8,10,12]),num=pick([3,5,7]),whole=pick([24,30,36]),part=whole*num/den;
    const r=four(part,[whole-part,whole/den,part+num]);
    return {section:"mathematics_science",difficulty:"medium",time:55,question_text:"What is "+num+"/"+den+" of "+whole+"?",answer_options:r.options,correct_answer:r.index,reasoning_type:"math:fraction"};
  }

  if (type === 8) {
    const a=pick([3,4,5,6]),x=pick([4,5,6,7]),b=pick([2,4,7]),rhs=a*x+b;
    const r=four(x,[x+1,x-1,rhs]);
    return {section:"mathematics_science",difficulty:"hard",time:60,question_text:"Solve for x: "+a+"x + "+b+" = "+rhs+".",answer_options:r.options,correct_answer:r.index,reasoning_type:"math:algebra"};
  }

  if (type === 9) {
    const limit=pick([18,22,30]),step=pick([2,3,4]),lower=limit-step;
    const answer=""+lower+" <= x <= "+limit;
    const r=four(answer,["x <= "+lower,"x >= "+lower,""+lower+" < x < "+limit]);
    return {section:"mathematics_science",difficulty:"hard",time:60,question_text:"Which inequality describes numbers that are no more than "+step+" below "+limit+" and do not exceed "+limit+"?",answer_options:r.options,correct_answer:r.index,reasoning_type:"math:inequality"};
  }

  if (type === 10) {
    const start=pick([2,3,4,5]),a=pick([2,3]),b=pick([1,2]),terms=[start];
    for(let i=1;i<5;i++) terms.push(terms[i-1]*a+b);
    const answer=terms[4]*a+b;
    const r=four(answer,[terms[4],answer+a,answer-b]);
    return {section:"mathematics_science",difficulty:"hard",time:65,question_text:"A sequence follows a rule. The terms are "+terms.join(", ")+" . What is the next term?",answer_options:r.options,correct_answer:r.index,reasoning_type:"math:nonlinear-pattern"};
  }

  if (type === 11) {
    const a=pick([12,15,18]),b=pick([7,9,11]),c=pick([14,16,20]),mean=pick([16,18,20]),d=mean*4-a-b-c;
    const r=four(d,[d-2,d+2,mean]);
    return {section:"mathematics_science",difficulty:"medium",time:60,question_text:"Three measurements are "+a+", "+b+" and "+c+". What fourth measurement is needed to make the mean "+mean+"?",answer_options:r.options,correct_answer:r.index,reasoning_type:"math:mean"};
  }

  if (type === 12) {
    const values=shuffle([12,15,18,22,27]),sorted=[...values].sort((a,b)=>a-b),answer=sorted[2];
    const r=four(answer,[sorted[1],sorted[3],sorted[4]]);
    return {section:"mathematics_science",difficulty:"medium",time:55,question_text:"The five values are "+values.join(", ")+" . What is the median?",answer_options:r.options,correct_answer:r.index,reasoning_type:"math:median"};
  }

  if (type === 13) {
    const total=pick([20,24,30]),favourable=pick([5,6,8]),p=favourable/total;
    const r=four(p.toFixed(2),[(1-p).toFixed(2),(p/2).toFixed(2),((favourable+1)/total).toFixed(2)]);
    return {section:"mathematics_science",difficulty:"medium",time:55,question_text:"A result occurs "+favourable+" times in "+total+" equally likely trials. What is the experimental probability?",answer_options:r.options,correct_answer:r.index,reasoning_type:"math:probability"};
  }

  if (type === 14) {
    const base=pick([120,130,140]);
    const diffs=[40,50,60,70];
    const initials=[base,base+8,base+16,base+24];
    const rows=["A","B","C","D"].map((name,i)=>[name,initials[i],initials[i]-diffs[i]]);
    const target=pick(["greatest decrease","smallest decrease"]);
    const idx=target==="greatest decrease"?3:0;
    const answer=rows[idx][0];
    const r=four(answer,rows.filter((_,i)=>i!==idx).map(x=>x[0]));
    return {section:"mathematics_science",difficulty:"hard",time:65,passage:"Data table:\n"+rows.map(r=>r[0]+" — initial "+r[1]+"; final "+r[2]).join("\n"),question_text:"Which group shows the "+target+"?",answer_options:r.options,correct_answer:r.index,reasoning_type:"math:data-table"};
  }

  if (type === 15) {
    const rate=pick([45,50,60,72]),time=pick([1.5,2,2.5,3]),distance=rate*time;
    const r=four(rate+" km/h",[(rate-5)+" km/h",(rate+5)+" km/h",(rate*2)+" km/h"]);
    return {section:"mathematics_science",difficulty:"hard",time:60,question_text:"A vehicle travels "+distance+" km in "+time+" hours. What is its average speed?",answer_options:r.options,correct_answer:r.index,reasoning_type:"math:rate"};
  }

  if (type === 16) {
    const start=pick([8,8.5,9]),duration=pick([75,95,110]),second=pick([15,20,25]);
    const [h,m]=String(start).includes(".")?String(start).split("."):[""+start,"0"];
    const startMin=Number(h)*60+(m==="5"?30:0);
    const firstFinish=startMin+duration;
    const secondStart=firstFinish+second;
    const hour=Math.floor(secondStart/60),minute=secondStart%60;
    const answer=(hour%12||12)+":"+String(minute).padStart(2,"0")+" "+(hour>=12?"pm":"am");
    const r=four(answer,[ (hour%12||12)+":"+String((minute+10)%60).padStart(2,"0")+" "+(hour>=12?"pm":"am"), (hour%12||12)+":"+String((minute+20)%60).padStart(2,"0")+" "+(hour>=12?"pm":"am"), "10:00 am"]);
    return {section:"mathematics_science",difficulty:"hard",time:65,passage:"Schedule:\nActivity 1 starts at "+String(start).replace(".5",":30")+" and lasts "+duration+" minutes.\nA "+second+"-minute changeover follows before Activity 2.",question_text:"When does Activity 2 begin?",answer_options:r.options,correct_answer:r.index,reasoning_type:"math:timetable"};
  }

  if (type === 17) {
    const start=pick(["north-east","south-east","south-west","north-west"]),turn=pick([45,90,135]);
    const dirs=["north","north-east","east","south-east","south","south-west","west","north-west"];
    let idx=dirs.indexOf(start); idx=(idx+turn/45)%8; const answer=dirs[idx];
    const r=four(answer,dirs.filter(x=>x!==answer).slice(0,3));
    return {section:"mathematics_science",difficulty:"hard",time:60,question_text:"A hiker is initially heading "+start+" and turns clockwise by "+turn+"°. Which direction is the hiker now facing?",answer_options:r.options,correct_answer:r.index,reasoning_type:"math:spatial"};
  }

  if (type === 18) {
    const scale=pick([1,2,5]),mapDistance=pick([3.2,4.5,6.8]),actual=mapDistance*scale;
    const r=four(actual+" km",[(mapDistance+scale).toFixed(1)+" km",(actual+scale).toFixed(1)+" km",Math.max(0.1,actual-scale).toFixed(1)+" km"]);
    return {section:"mathematics_science",difficulty:"hard",time:60,question_text:"On a map, 1 cm represents "+scale+" km. Two places are "+mapDistance+" cm apart on the map. What is the actual distance?",answer_options:r.options,correct_answer:r.index,reasoning_type:"math:scale"};
  }

  if (type === 19) {
    const changed=pick(["light intensity","water volume","temperature","soil type"]);
    const passage="Plant experiment:\nGroup A and Group B are identical except for one variable. The groups are given the same seeds, pot size and soil, and growth is measured after four weeks. The groups differ in "+changed+".";
    const r=four(changed,["seed type","pot size","measurement time"]);
    return {section:"mathematics_science",difficulty:"hard",time:60,passage,question_text:"Which variable is deliberately changed between the groups?",answer_options:r.options,correct_answer:r.index,reasoning_type:"science:variables"};
  }

  if (type === 20) {
    const improvement=pick(["repeat the experiment with more trials","change two variables at once","remove results that disagree","use only the most successful trial"]);
    const r=four(improvement,["change two variables at once","remove results that disagree","use only the most successful trial"]);
    return {section:"mathematics_science",difficulty:"hard",time:65,question_text:"Which change would most improve the reliability of an experiment?",answer_options:r.options,correct_answer:r.index,reasoning_type:"science:reliability"};
  }

  if (type === 21) {
    const values=[pick([4,6,8]),pick([9,11,13]),pick([14,16,18]),pick([19,21,23])];
    const trend=values[3]>values[2]?"increasing":"decreasing";
    const r=four("The measured quantity generally increases over time.",[
      "The measured quantity stays exactly constant.",
      "The measured quantity falls at every measurement.",
      "No trend can be identified."
    ]);
    return {section:"mathematics_science",difficulty:"hard",time:60,passage:"Measurement graph data:\nTime 1: "+values[0]+"\nTime 2: "+values[1]+"\nTime 3: "+values[2]+"\nTime 4: "+values[3],question_text:"Which conclusion is best supported by the measurements?",answer_options:r.options,correct_answer:r.index,reasoning_type:"science:graph-trend"};
  }

  if (type === 22) {
    const a=pick([10,12,14]),b=a+10,c=b+10,target=a+15;
    const estimate=(b-a)/ (b-a)===1 ?  b-((c-b)*0.5) : b;
    const r=four(b,[a,c,target]);
    return {section:"mathematics_science",difficulty:"hard",time:60,passage:"A measured quantity is  "+a+" units at one point and "+c+" units at a later point. The change is approximately steady between the two points.",question_text:"Which value is most reasonable for the quantity halfway between the two measurements?",answer_options:r.options,correct_answer:r.index,reasoning_type:"science:interpolation"};
  }

  if (type === 23) {
    const passage="Students who sleep more hours tend to report higher concentration scores. The study is observational: students' sleep was not assigned by the researchers.";
    const r=four("The relationship does not by itself prove that extra sleep causes the higher scores.",[
      "Sleep and concentration must be unrelated.",
      "The study proves exactly how much sleep every student needs.",
      "Observational studies always give false results."
    ]);
    return {section:"mathematics_science",difficulty:"hard",time:65,passage,question_text:"Which conclusion is scientifically most appropriate?",answer_options:r.options,correct_answer:r.index,reasoning_type:"science:correlation-causation"};
  }

  if (type === 24) {
    const passage="A pond food web contains algae, small insects, fish and herons. A chemical spill sharply reduces the algae population. Small insects feed on algae; fish feed on the insects; herons feed on fish.";
    const r=four("The insect population is likely to decrease after the algae decline.",[
      "The fish population must immediately increase.",
      "The algae population will increase because of the spill.",
      "The food web is unaffected because algae are not animals."
    ]);
    return {section:"mathematics_science",difficulty:"hard",time:65,passage,question_text:"What is the most likely first consequence in the food web?",answer_options:r.options,correct_answer:r.index,reasoning_type:"science:food-web"};
  }

  if (type === 25) {
    const a=pick([2,3,4]),b=a+2;
    const passage="Two metal strips are heated through the same temperature increase. Strip A expands by "+a+" mm. Strip B expands by "+b+" mm. Other conditions are kept constant.";
    const r=four("Strip B expands more for the same temperature increase.",[
      "Strip A expands more because it is shorter.",
      "Both strips expand by the same amount.",
      "No comparison is possible."
    ]);
    return {section:"mathematics_science",difficulty:"hard",time:60,passage,question_text:"Which conclusion is supported by the data?",answer_options:r.options,correct_answer:r.index,reasoning_type:"science:material-comparison"};
  }

  if (type === 26) {
    const rows=[
      ["brain",pick([700,750,800]),pick([700,750,800])],
      ["heart",pick([180,220,260]),pick([650,700,750])],
      ["kidneys",pick([1050,1100,1150]),pick([550,600,650])],
      ["muscles",pick([700,750,800]),pick([11000,12000,13000])]
    ];
    const target=pick(["heart","kidneys","muscles"]);
    const row=rows.find(x=>x[0]===target);
    const change=row[2]-row[1];
    const r=four(change.toString(),[row[1].toString(),row[2].toString(),(Math.abs(change)+100).toString()]);
    return {section:"mathematics_science",difficulty:"hard",time:65,passage:"Blood flow (mL per minute):\n"+rows.map(x=>x[0]+" — rest "+x[1]+", exercise "+x[2]).join("\n"),question_text:"By how much does blood flow to the "+target+" change from rest to exercise?",answer_options:r.options,correct_answer:r.index,reasoning_type:"science:data-table"};
  }

  if (type === 27) {
    const mass=pick([240,300,360]),volume=pick([30,40,60]),density=mass/volume;
    const r=four(density+" g/cm³",[density+1,density/2,mass+volume]);
    return {section:"mathematics_science",difficulty:"hard",time:60,question_text:"A sample has a mass of "+mass+" g and a volume of "+volume+" cm³. What is its density?",answer_options:r.options,correct_answer:r.index,reasoning_type:"science:density"};
  }

  if (type === 28) {
    const km=pick([18,24,36]),minutes=pick([15,20,30]),hours=minutes/60,speed=km/hours;
    const r=four(speed+" km/h",[speed/2+" km/h",(speed+10)+" km/h",(km/minutes)+" km/h"]);
    return {section:"mathematics_science",difficulty:"hard",time:60,question_text:"A cyclist travels "+km+" km in "+minutes+" minutes. What is the average speed in km/h?",answer_options:r.options,correct_answer:r.index,reasoning_type:"math:rate-conversion"};
  }

  if (type === 29) {
    const total=pick([240,300,360]),pct=pick([15,20,25,30]),part=total*pct/100;
    const r=four(part,[total-pct,total+part,total*(1-pct/100)]);
    return {section:"mathematics_science",difficulty:"medium",time:55,question_text:"A sample has a total mass of "+total+" g. "+pct+"% is one component. What is the mass of that component?",answer_options:r.options,correct_answer:r.index,reasoning_type:"math:percentage-composition"};
  }

  if (type === 30) {
    const choices=["A","B","C","D","E"],first=pick(choices),second=pick(choices.filter(x=>x!==first));
    const answer=choices.length*(choices.length-1);
    const r=four(answer, [choices.length, choices.length*2, choices.length+choices.length-1]);
    return {section:"mathematics_science",difficulty:"hard",time:65,question_text:"Five different cards are labelled A to E. Two different cards are selected in order, without replacement. How many ordered pairs are possible?",answer_options:r.options,correct_answer:r.index,reasoning_type:"math:counting"};
  }

  if (type === 31) {
    const start=pick([3,4,5]),times=pick([2,3]),answer=start*times;
    const r=four(answer,[start+times,start*times+1,start+times*2]);
    return {section:"mathematics_science",difficulty:"hard",time:60,passage:"A shape is enlarged so that each linear dimension is multiplied by "+times+".",question_text:"A length of "+start+" cm is enlarged by a factor of "+times+". What is the new length?",answer_options:r.options,correct_answer:r.index,reasoning_type:"math:transformation"};
  }

  if (type === 32) {
    const known=pick([35,45,55]),other=pick([40,50,60]),third=180-known-other;
    const r=four(third,[180-third,known+other,third+10]);
    return {section:"mathematics_science",difficulty:"medium",time:55,question_text:"Two angles of a triangle are "+known+"° and "+other+"°. What is the third angle?",answer_options:r.options,correct_answer:r.index,reasoning_type:"math:angles"};
  }

  if (type === 33) {
    const measured=pick([8,12,20]),error=pick([0.5,1,2]);
    const lower=measured-error,upper=measured+error;
    const r=four("between "+lower+" and "+upper+" inclusive",[String(measured-error*2)+" to "+(measured+error*2),String(measured)+" to "+(upper+error),String(lower-error)+" to "+measured]);
    return {section:"mathematics_science",difficulty:"hard",time:65,question_text:"A measurement is recorded as "+measured+" units with a possible error of ±"+error+". Which range is reasonable for the true value?",answer_options:r.options,correct_answer:r.index,reasoning_type:"math:bounds"};
  }

  if (type === 34) {
    const plans=[
      ["A",80,20],["B",90,35],["C",75,15],["D",85,25]
    ];
    const minimum=pick([82,85]),maximumBudget=pick([25,30]);
    const eligible=plans.filter(p=>p[1]>=minimum && p[2]<=maximumBudget);
    const answer=eligible.length?eligible[0][0]:"None";
    const distractors=plans.map(p=>p[0]).filter(x=>x!==answer).slice(0,3);
    if(answer==="None") distractors=["A","B","C"];
    const r=four(answer,distractors);
    return {section:"mathematics_science",difficulty:"hard",time:65,passage:"Plan data (output score, cost units):\n"+plans.map(p=>p[0]+" — "+p[1]+" score; "+p[2]+" cost").join("\n"),question_text:"A plan must have an output score of at least "+minimum+" and a cost of no more than "+maximumBudget+". Which plan meets the requirements?",answer_options:r.options,correct_answer:r.index,reasoning_type:"math:optimisation"};
  }

  if (type === 35) {
    const passage="A school wants to estimate how many students support a new lunchtime program. It surveys only students who are already members of lunchtime clubs.";
    const r=four("The sample may not represent students who do not usually join lunchtime clubs.",[
      "The sample is guaranteed to represent every student.",
      "The result proves the program will be popular with all students.",
      "Students in clubs cannot answer survey questions."
    ]);
    return {section:"mathematics_science",difficulty:"hard",time:65,passage,question_text:"What is the main limitation of this sample?",answer_options:r.options,correct_answer:r.index,reasoning_type:"science:sampling-bias"};
  }

  if (type === 36) {
    const values=shuffle([12,16,18,22]),newValue=pick([30,36,40]);
    const before=values.reduce((a,b)=>a+b,0)/values.length;
    const after=(values.reduce((a,b)=>a+b,0)+newValue)/(values.length+1);
    const r=four(after.toFixed(1),[before.toFixed(1),newValue.toFixed(1),(after+2).toFixed(1)]);
    return {section:"mathematics_science",difficulty:"hard",time:65,question_text:"The mean of "+values.join(", ")+" is calculated. A new value of "+newValue+" is then added. What is the new mean?",answer_options:r.options,correct_answer:r.index,reasoning_type:"math:mean-effect"};
  }

  if (type === 37) {
    const rate=pick([4,5,6]),time=pick([3,4,5]),output=rate*time;
    const r=four("output = rate × time",["output = rate + time","output = rate ÷ time","output = time ÷ rate"]);
    return {section:"mathematics_science",difficulty:"hard",time:60,passage:"Observed machine data:\nAt "+time+" minutes, output was "+output+" units.\nThe rate of production stayed constant.",question_text:"Which formula best represents the relationship between output, rate and time?",answer_options:r.options,correct_answer:r.index,reasoning_type:"math:formula-from-data"};
  }

  if (type === 38) {
    const passage="A student tests whether different soils affect plant growth. The student uses the same plant variety, same pot size and same volume of water, but uses three different soils.";
    const r=four("Keep the plant variety, pot size and water volume the same.",[
      "Change soil and plant variety together.",
      "Use a different amount of water for each soil.",
      "Measure one plant only and select the best result."
    ]);
    return {section:"mathematics_science",difficulty:"hard",time:65,passage,question_text:"Which design choice best isolates the effect of soil?",answer_options:r.options,correct_answer:r.index,reasoning_type:"science:experimental-control"};
  }

  const values=shuffle([18,21,24,27,42]);
  const expected=values.filter((v,i)=>i<4).reduce((a,v)=>a+v,0)/4;
  const anomaly=42;
  const r=four("42 is inconsistent with the pattern in the other measurements.",[
    "18 is the only useful measurement.",
    "All values are identical.",
    "No value can be compared with another."
  ]);
  return {section:"mathematics_science",difficulty:"hard",time:60,passage:"Repeated measurements: "+values.join(", "),question_text:"Which observation should prompt a student to check the measurement for a possible anomaly?",answer_options:r.options,correct_answer:r.index,reasoning_type:"science:anomaly"};
}


function mathematicsScienceStimulusSet() {
  const groups = [
    {
      key: "MATH-PAGE-01",
      passage: "A research team models how a large ancient landmass separated over time. The record uses a horizontal time scale in millions of years. At 145 million years ago, Landmass R split into two regions. One branch later separated at 118 million years ago, while another remained joined until 92 million years ago.",
      questions: [
        ["How many millions of years passed between the split of Landmass R and the later split at 118 million years ago?", 27, [21, 31, 37], "Subtract 118 from 145."],
        ["How many millions of years passed from the original split at 145 million years ago to the later event at 92 million years ago?", 53, [43, 57, 63], "Subtract 92 from 145."],
        ["Which statement is best supported by the time model?", "The landmass changed through more than one separation event.", ["All separation happened at the same time.","No separation happened after the first event.","The model proves the exact cause of every split."], "The timeline represents a sequence of separate events rather than one single split."]
      ]
    },
    {
      key: "MATH-PAGE-02",
      passage: "A town has recorded its population by age group in two survey years. In 1980 the numbers of residents aged 0–14, 15–34, 35–54 and 55+ were 1800, 2600, 1900 and 900. In 2020 the corresponding numbers were 1400, 3100, 2500 and 1500.",
      questions: [
        ["How many residents were recorded in the 15–34 group in 2020?", 3100, [2600, 2900, 3500], "Read the 15–34 value for 2020."],
        ["By how many residents did the 55+ group increase from 1980 to 2020?", 600, [400, 700, 900], "Subtract 900 from 1500."],
        ["Which age group had the largest increase between the two years?", "55+", ["15–34", "35–54", "0–14"], "The changes are +500, +500, −400 and +600 respectively."]
      ]
    },
    {
      key: "MATH-PAGE-03",
      passage: "A winter air-quality study measures light scattering in a city. Higher scattering means more particles are present. Traffic is busiest during the morning and afternoon commuter periods, while some homes use wood heaters overnight. Three additional conditions are measured: a warm working day, a cold non-working day and a warm non-working day.",
      questions: [
        ["Which comparison would best help separate the effect of traffic from the effect of wood heaters?", "Compare a cold working day with a cold non-working day.", ["Compare two warm working days only.","Compare two identical cold working days.","Compare a warm working day with another warm working day."], "Keeping temperature similar while changing whether people commute helps isolate the traffic effect."],
        ["Why is a non-working day useful in this investigation?", "Traffic patterns are different while many other conditions can be similar.", ["Wood fires cannot operate on non-working days.","It guarantees there will be no particles in the air.","It makes temperature irrelevant."], "A non-working day changes a key traffic-related factor without automatically changing every other variable."],
        ["A sharp evening peak appears on working days but not on cold non-working days. Which explanation is most consistent with this evidence?", "Traffic is a plausible contributor to the peak.", ["The peak must be caused entirely by rainfall.","The evidence proves wood smoke never contributes.","The instruments must be broken."], "The difference between working and non-working conditions is consistent with a traffic contribution, though it does not prove traffic is the only cause."]
      ]
    },
    {
      key: "MATH-PAGE-04",
      passage: "A builder lays rectangular tiles in a repeating staggered pattern. Every second row begins and ends with a half-tile. A full wall is 6 tiles wide and 5 rows high. The row sequence repeats after two rows.",
      questions: [
        ["How many full-width tile positions are there across five rows if each row is 6 tile-widths long?", 30, [24, 26, 36], "There are 6 positions per row across 5 rows."],
        ["If the two edge half-tiles together make one full tile-width in each alternating row, how many half-tiles occur in the five-row wall?", 6, [4, 5, 10], "Three of the five rows are alternating rows, each with two half-tiles."],
        ["Which feature of the pattern makes it rectangular despite the staggered rows?", "The half-tiles complete the missing edge widths.", ["Every row uses only half-tiles.","The row lengths continually decrease.","The tiles are placed randomly."], "The edge half-tiles compensate for the stagger so the outer boundary remains straight."]
      ]
    },
    {
      key: "MATH-PAGE-05",
      passage: "A coastal food web contains kelp, sea snails, sea urchins, small fish and sea otters. Snails and urchins graze on kelp. Otters feed on sea urchins. A sudden decline in otters changes the balance of the web.",
      questions: [
        ["What is the most likely immediate consequence of a large decline in sea otters?", "The sea-urchin population is likely to increase.", ["Kelp must immediately increase.","Sea urchins stop feeding.","Sea snails disappear immediately."], "With fewer predators, sea urchins are likely to face less predation."],
        ["If sea urchin numbers rise substantially, what is the most likely effect on kelp?", "Kelp is likely to decline because grazing pressure increases.", ["Kelp must double immediately.","Kelp becomes a predator.","Sea urchins stop eating kelp."], "More urchins feeding on kelp increases grazing pressure."],
        ["Which intervention would most directly reduce grazing on kelp without removing kelp itself?", "Reduce the number of major kelp grazers.", ["Increase the number of grazers.","Remove all rocks from the sea floor.","Increase sunlight at night."], "Reducing grazing pressure directly addresses the cause of excessive kelp consumption."]
      ]
    },
    {
      key: "MATH-PAGE-06",
      passage: "A laboratory study records average blood flow in millilitres per minute to four body regions at rest and during vigorous exercise. Brain: 760 to 760. Heart: 210 to 780. Kidneys: 1080 to 620. Skeletal muscles: 720 to 11,900.",
      questions: [
        ["What percentage of total rest flow of 5000 mL/min would be directed to the brain?", "15.2%", ["7.6%","12.0%","20.0%"], "Divide 760 by 5000 and multiply by 100."],
        ["By how much does blood flow to the heart increase during exercise?", "570 mL/min", ["470 mL/min","990 mL/min","1030 mL/min"], "Subtract 210 from 780."],
        ["Which body region shows the largest increase in blood flow?", "Skeletal muscles", ["Brain","Heart","Kidneys"], "Skeletal-muscle flow rises from 720 to 11,900 mL/min."]
      ]
    },
    {
      key: "MATH-PAGE-07",
      passage: "A market analyst tracks a commodity's daily price and also calculates a 10-day moving average. The daily price can change sharply from one day to the next, while the moving average combines recent values and therefore changes more gradually.",
      questions: [
        ["Why does a moving average usually have a smaller range than the daily prices?", "High and low daily values are smoothed by averaging.", ["It ignores recent prices.","It always equals the highest price.","It is calculated from only one day."], "Averaging reduces the effect of individual extremes."],
        ["Compared with a sudden rise in the daily price, when would a moving average usually respond?", "More gradually, after several daily values contribute to the average.", ["Instantly by exactly the same amount.","Before the daily rise occurs.","It would never change."], "The average includes multiple observations, so a single day's change has a smaller immediate effect."],
        ["A daily price is 84 and the nine previous daily prices average 60. What is the new 10-day moving average?", 62.4, [61.6, 64.0, 68.4], "The new average is (9×60 + 84) ÷ 10 = 62.4."]
      ]
    },
    {
      key: "MATH-PAGE-08",
      passage: "Two students memorise 120 symbols. Immediately after learning, both recall 120. Student A recalls 60% as many symbols at each 20-minute test. Student B recalls 18 fewer symbols at each test.",
      questions: [
        ["How many symbols does Student A recall after 40 minutes?", 43.2, [48, 36, 61.2], "After two intervals: 120 × 0.6 × 0.6 = 43.2."],
        ["How many symbols does Student B recall after 60 minutes?", 66, [84, 72, 54], "There are three 20-minute intervals, so 120 − 3×18 = 66."],
        ["Which statement best compares the two forgetting patterns?", "Student A follows a proportional pattern, while Student B loses a fixed amount each interval.", ["Both students lose the same number each interval.","Both students lose the same percentage each interval.","Neither student's recall changes over time."], "A percentage-based decrease and a fixed numerical decrease produce different patterns."]
      ]
    },
    {
      key: "MATH-PAGE-09",
      passage: "An aquarium guide estimates carrying capacity from water-surface area. Without aeration, each square metre can support fish with a combined body length of 24 cm. Aeration increases that capacity by 25%. A new tank is planned for fish that are each 4 cm long.",
      questions: [
        ["Without aeration, how many 4 cm fish can 1.0 m² support?", 6, [4, 5, 8], "Divide the 24 cm total capacity by 4 cm per fish."],
        ["What total fish length can an aerated 1.0 m² tank support?", "30 cm", ["25 cm","28 cm","36 cm"], "Increase 24 cm by 25%: 24 × 1.25 = 30 cm."],
        ["What is the minimum surface area needed for 100 fish that are each 4 cm long in an aerated tank?", "13.33 m²", ["10 m²","12 m²","16 m²"], "The required total length is 400 cm; 400 ÷ 30 = 13.33 m²."],
        ["Why is surface area used in this guide rather than simply the volume of the tank?", "Gas exchange at the water surface is important for supporting the fish.", ["Fish only live at the surface.","Tank volume has no effect on anything.","Surface area determines fish colour."], "The guide uses surface area as a practical indicator related to oxygen exchange."]
      ]
    },
    {
      key: "MATH-PAGE-10",
      passage: "A communication system uses two symbols, a dot and a dash. A code may contain one, two or three symbols, and order matters. For example, dot-dash is different from dash-dot.",
      questions: [
        ["How many different codes of exactly two symbols are possible?", 4, [2, 6, 8], "Each position has 2 choices, so 2×2 = 4."],
        ["How many different codes of exactly three symbols are possible?", 8, [6, 9, 12], "There are 2 choices for each of 3 positions: 2³ = 8."],
        ["How many different codes are possible using exactly one, two or three symbols?", 14, [10, 12, 16], "There are 2 + 4 + 8 = 14 possible codes."],
        ["Why do dot-dash and dash-dot count as different codes?", "The order of the symbols is part of the code.", ["Only the number of symbols matters.","Dots and dashes have identical meanings.","The codes are always read backwards."], "Changing the order changes the sequence and therefore creates a different code."]
      ]
    }
  ];

  const rows = [];
  groups.forEach(group => {
    group.questions.forEach((item, index) => {
      const r = four(item[1], item[2]);
      rows.push({
        section: "mathematics_science",
        difficulty: index === 0 ? "medium" : "hard",
        time: index === 0 ? 55 : 60,
        question_text: item[0],
        answer_options: r.options,
        correct_answer: r.index,
        explanation: item[3],
        passage: group.passage,
        stimulus_group: group.key,
        stimulus_image: null,
        reasoning_type: "math-science:stimulus-page"
      });
    });
  });
  return rows;
}

function questionFingerprint(question) {
  return JSON.stringify([
    question.section,
    String(question.question_text || "").trim().replace(/\\s+/g, " "),
    String(question.passage || "").trim().replace(/\\s+/g, " ")
  ]);
}

function questionType(question) {
  return question.reasoning_type
    || (question.stimulus_group ? "stimulus:" + String(question.stimulus_group) : null)
    || String(question.section || "other") + ":other";
}

function normalizeRegionalStimulusQuestion(row) {
  if (String(row.stimulus_group || "") !== "HUM-ALT-B-02") return row;
  const passage = "The regional comparison visual compares six markets—China, Malaysia, Taiwan, Singapore, Indonesia and Thailand—across market size, growth, infrastructure, stability, labour cost, management cost and tax environment. Dark marks indicate relatively stronger conditions; lighter marks indicate weaker conditions. Read each mark against the country headings and the factor labels.";
  const map = {
    "Which district has the highest skilled-worker share?": ["Which country is associated with the dark mark on the Growth row?", ["China","Malaysia","Indonesia","Thailand"], 1],
    "Why would a decision-maker avoid using cost alone?": ["Which country is associated with the dark mark on the Stability row?", ["China","Taiwan","Singapore","Thailand"], 2],
    "Which district has the shortest travel time?": ["Which country is associated with the dark mark on the Labour cost row?", ["Malaysia","Taiwan","Indonesia","Thailand"], 2],
    "Which district has the highest growth?": ["Which country is associated with the lighter mark on the Infrastructure row?", ["China","Malaysia","Taiwan","Singapore"], 0],
    "Which district has both the lowest facility cost and highest vacancy count?": ["Which country is associated with the lighter mark on the Tax environment row?", ["China","Malaysia","Indonesia","Thailand"], 2]
  };
  const replacement = map[row.question_text];
  if (!replacement) return row;
  return { ...row, question_text: replacement[0], answer_options: replacement[1], correct_answer: replacement[2], passage };
}

function pickStimulusGroups(candidates, count, usedFingerprints) {
  const sets = new Map();

  for (const candidate of candidates) {
    if (!validQuestionShape(candidate)) continue;
    const fp = questionFingerprint(candidate);
    if (usedFingerprints.has(fp)) continue;

    const group = String(candidate.stimulus_group || "").trim();
    if (!group) continue;

    // Bank batches use HUM-PDF-A-01 ... HUM-PDF-A-09 (and B, C, ...).
    // Keep a complete batch together so every stimulus retains all of its
    // questions on the same screen.
    const parts = group.split("-");
    const setKey = parts.length >= 3 ? parts.slice(0, 3).join("-") : group;
    if (!sets.has(setKey)) sets.set(setKey, new Map());
    const groups = sets.get(setKey);
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(candidate);
  }

  const eligibleSets = shuffle([...sets.entries()])
    .map(([setKey, groups]) => ({
      setKey,
      groups: [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))
    }))
    .filter(({ groups }) => {
      const total = groups.reduce((sum, [, rows]) => sum + rows.length, 0);
      // Humanities must always render as multi-question stimulus pages.
      // Reject any set containing a one-question stimulus rather than allowing
      // a later fallback to break the grouped-page contract.
      const everyStimulusHasMultipleQuestions = groups.length > 0 &&
        groups.every(([, rows]) => rows.length >= 2);
      return total === count && everyStimulusHasMultipleQuestions;
    });

  if (!eligibleSets.length) return [];

  const chosen = eligibleSets.sort((a, b) => String(a.setKey).localeCompare(String(b.setKey)))[0];
  const selected = [];
  for (const [, rows] of chosen.groups) {
    selected.push(...rows);
  }
  return selected.slice(0, count).map(normalizeRegionalStimulusQuestion);
}

function pickDiverseQuestions(candidates, count, usedFingerprints, initialLastType = "") {
  const buckets = new Map();
  for (const candidate of shuffle(candidates)) {
    if (!validQuestionShape(candidate)) continue;
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
  const conceptualPrompts = [
    "A small choice can reveal a great deal about a person.",
    "What looks like a problem from one point of view may be an opportunity from another.",
    "Some changes are obvious. Others are noticed only after time has passed.",
    "People sometimes understand an experience only after it is over.",
    "A rule can protect people, but it can also create a problem.",
    "The most useful lesson is not always the one we expected to learn.",
    "Being heard is not the same as being agreed with.",
    "What is left unsaid can sometimes be as important as what is said."
  ];
  const prompts = shuffle(conceptualPrompts).slice(0,2);
  return prompts.map((prompt,index)=>({
    id:"we-"+(index+1),
    title:"Written Expression "+(index+1),
    time:25*60,
    prompt:"Write a piece in response to this idea: "+prompt+" You may write a story, persuasive piece, discussion or personal reflection."
  }));
}

module.exports = {
  humanitiesQuestion,
  mathematicsScienceQuestion,
  questionFingerprint,
  questionType,
  pickDiverseQuestions,
  pickStimulusGroups,
  mathematicsScienceStimulusSet,
  getWritingTasks
};