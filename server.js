const express = require("express");
const path = require("path");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const publicDir = path.join(__dirname, "public");
const studentDir = path.join(publicDir, "student");

app.use(express.json({ limit: "100kb" }));
app.use(express.static(publicDir, { index: false }));
app.use(express.static(studentDir, { index: false }));
app.use("/assets", express.static(path.join(studentDir, "assets"), { index: false }));

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
const { difficultyWeight, calculateWeightedScore } = require("./server/scoring");

const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;
const cookieName = "quiz_admin";
const assessmentCookieName = "quiz_assessment";
const assessmentTtlMs = 4 * 60 * 60 * 1000;
const rateLimitBuckets = new Map();
const generationLocks = new Map();
const DEFAULT_ASSESSMENT = Object.freeze({
  yearLevel: "10",
  sectionCounts: { humanities: 40, mathematics_science: 32 },
  totalQuestionCount: 72,
  writingTaskCount: 2
});
async function getAssessmentConfig() {
  if (!supabase) return JSON.parse(JSON.stringify(DEFAULT_ASSESSMENT));
  const { data, error } = await supabase
    .from("assessment_configs")
    .select("year_level,section_counts,total_question_count")
    .eq("config_key", "year10_level2")
    .eq("active", true)
    .maybeSingle();
  if (error || !data) {
    if (error) console.error("Assessment config lookup failed", error);
    return JSON.parse(JSON.stringify(DEFAULT_ASSESSMENT));
  }
  const sectionCounts = {
    humanities: Number(data.section_counts?.humanities),
    mathematics_science: Number(data.section_counts?.mathematics_science)
  };
  const totalQuestionCount = Object.values(sectionCounts).reduce((sum, value) => sum + value, 0);
  if (
    String(data.year_level) !== "10" ||
    Object.values(sectionCounts).some(value => !Number.isInteger(value) || value <= 0) ||
    totalQuestionCount !== Number(data.total_question_count)
  ) {
    console.error("Invalid Year 10 assessment config; using defaults");
    return JSON.parse(JSON.stringify(DEFAULT_ASSESSMENT));
  }
  return { yearLevel:"10", sectionCounts, totalQuestionCount, writingTaskCount:2 };
}


async function getAssessmentWritingTasks() {
  const fallback = getWritingTasks();
  if (!supabase) return fallback;

  const { data, error } = await supabase
    .from("writing_topics")
    .select("id,task_slot,topic")
    .eq("active", true)
    .in("task_slot", [1,2])
    .order("created_at", { ascending: true });

  if (error || !data) {
    if (error) console.error("Writing topic lookup failed", error);
    return fallback;
  }

  const bySlot = { 1: [], 2: [] };
  for (const row of data) {
    if (bySlot[row.task_slot]) bySlot[row.task_slot].push(row);
  }

  if (!bySlot[1].length || !bySlot[2].length) return fallback;

  return [1,2].map(slot => {
    const chosen = pick(bySlot[slot]);
    return {
      id: "we-" + slot,
      title: "Written Expression " + slot,
      time: 25 * 60,
      prompt: "Write a piece in response to this idea: " + chosen.topic + " You may write a story, persuasive piece, discussion or personal reflection."
    };
  });
}

const {
  questionFingerprint,
  pickDiverseQuestions,
  pickStimulusGroups,
  getWritingTasks
} = require("./server/year10Level2Generators");

function signSession(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", adminPassword || "missing-admin-password").update(body).digest("base64url");
  return body + "." + signature;
}

function verifySession(req) {
  if (!adminPassword) return false;
  const match = (req.headers.cookie || "").match(new RegExp("(^|;\\s*)" + cookieName + "=([^;]+)"));
  if (!match) return false;
  const [body, signature] = match[2].split(".");
  if (!body || !signature) return false;
  const expected = crypto.createHmac("sha256", adminPassword).update(body).digest("base64url");
  if (signature.length !== expected.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8")).exp > Date.now();
  } catch {
    return false;
  }
}

function requireAdmin(req, res, next) {
  if (!verifySession(req)) return res.status(401).json({ error: "Admin login required" });
  next();
}

function clientIp(req) {
  return (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown").toString().split(",")[0].trim();
}

function ipHash(req) {
  const salt = process.env.QUESTION_IP_SALT || "quiz-question-salt";
  return crypto.createHash("sha256").update(salt + "|" + clientIp(req)).digest("hex");
}

function pick(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function shuffle(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function validUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

function assessmentSecret() {
  return process.env.ASSESSMENT_SESSION_SECRET || supabaseKey || "missing-assessment-secret";
}

function signAssessmentToken(sessionId, expiresAt) {
  const body = Buffer.from(JSON.stringify({ sessionId, exp: expiresAt })).toString("base64url");
  const signature = crypto.createHmac("sha256", assessmentSecret()).update(body).digest("base64url");
  return body + "." + signature;
}

function readCookie(req, name) {
  const match = (req.headers.cookie || "").match(new RegExp("(^|;\\s*)" + name + "=([^;]+)"));
  if (!match) return "";
  try {
    return decodeURIComponent(match[2]);
  } catch {
    return "";
  }
}

function verifyAssessmentToken(req, sessionId) {
  const token = readCookie(req, assessmentCookieName);
  if (!token) return false;

  const [body, signature] = token.split(".");
  if (!body || !signature) return false;

  const expected = crypto.createHmac("sha256", assessmentSecret()).update(body).digest("base64url");
  if (signature.length !== expected.length) return false;

  try {
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return payload.sessionId === sessionId && Number(payload.exp) > Date.now();
  } catch {
    return false;
  }
}

function setAssessmentCookie(req, res, token, maxAgeSeconds) {
  const secure = String(req.get("X-Forwarded-Proto") || "").toLowerCase() === "https" || req.secure ? " Secure;" : "";
  res.setHeader(
    "Set-Cookie",
    assessmentCookieName + "=" + encodeURIComponent(token) +
    "; HttpOnly; SameSite=Lax; Path=/; Max-Age=" + maxAgeSeconds + ";" + secure
  );
}

function clearAssessmentCookie(res) {
  res.setHeader(
    "Set-Cookie",
    assessmentCookieName + "=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0"
  );
}

function rateLimit(key, limit, windowMs) {
  const now = Date.now();
  const current = rateLimitBuckets.get(key);

  if (!current || current.resetAt <= now) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (current.count >= limit) return false;

  current.count += 1;
  return true;
}

function requireAssessmentAccess(req, res, sessionId, limitKey) {
  if (!validUuid(sessionId) || !verifyAssessmentToken(req, sessionId)) {
    res.status(401).json({ error: "Assessment access required" });
    return false;
  }

  if (limitKey && !rateLimit(limitKey, 120, 60 * 60 * 1000)) {
    res.status(429).json({ error: "Too many assessment requests. Please wait and try again." });
    return false;
  }

  return true;
}

function withAnswer(answer, distractors) {
  const values = [String(answer), ...distractors.map(String)];
  const unique = [];
  for (const value of values) {
    if (!unique.includes(value)) unique.push(value);
  }
  while (unique.length < 5) unique.push(String(unique.length + 1));
  const options = shuffle(unique.slice(0, 5));
  return { options, index: options.indexOf(String(answer)) };
}

function generatedId(question) {
  return crypto.createHash("sha256").update(JSON.stringify([
    question.year_level, question.section, question.question_text, question.passage || "",
    question.answer_options, question.correct_answer
  ])).digest("hex").slice(0, 24);
}

function money(value) {
  return "$" + Number(value).toFixed(2);
}

function makeMathQuestion() {
  const type = Math.floor(Math.random() * 6);

  if (type === 0) {
    const a = pick([3, 4, 5, 6, 7, 8]), x = pick([4, 5, 6, 7, 8, 9]), b = pick([3, 5, 7, 9, 11]);
    const answer = a * x + b;
    const result = withAnswer(x, [x - 2, x + 2, x + 3, x + 5]);
    return { section:"maths", difficulty:"hard", time:65, question_text:"Solve for x: " + a + "x + " + b + " = " + answer + ".", answer_options:result.options, correct_answer:result.index, explanation:"Subtract " + b + " from both sides, then divide by " + a + "." };
  }

  if (type === 1) {
    const price = pick([80, 90, 120, 150, 180, 240]), pct = pick([10, 15, 20, 25, 30]);
    const answer = price * (1 - pct / 100);
    const result = withAnswer(money(answer), [money(answer + 5), money(answer - 5), money(price * (1 - pct / 200)), money(price * 1.1)]);
    return { section:"maths", difficulty:"medium", time:60, question_text:"A jacket costs " + money(price) + " and is reduced by " + pct + "%. What is the sale price?", answer_options:result.options, correct_answer:result.index, explanation:"Calculate " + pct + "% of the original price and subtract it." };
  }

  if (type === 2) {
    const length = pick([7, 8, 9, 10, 11, 12]), width = pick([4, 5, 6, 7]), answer = length * width;
    const result = withAnswer(answer, [answer + length, answer - width, 2 * (length + width), answer + width]);
    return { section:"maths", difficulty:"medium", time:55, question_text:"A rectangle is " + length + " cm long and " + width + " cm wide. What is its area?", answer_options:result.options, correct_answer:result.index, explanation:"Area of a rectangle = length × width." };
  }

  if (type === 3) {
    const base = pick([8, 9, 10, 12]), height = pick([5, 6, 7, 8]), answer = base * height / 2;
    const result = withAnswer(answer, [base * height, answer + base, answer - height, base + height]);
    return { section:"maths", difficulty:"medium", time:60, question_text:"A triangle has a base of " + base + " cm and a height of " + height + " cm. What is its area?", answer_options:result.options, correct_answer:result.index, explanation:"Triangle area = 1/2 × base × height." };
  }

  if (type === 4) {
    const multiplier = pick([2, 3, 4]), x = pick([4, 5, 6, 7, 8]), constant = pick([-3, -1, 2, 4]);
    const answer = multiplier * x + constant;
    const expression = constant >= 0 ? multiplier + "x + " + constant : multiplier + "x − " + Math.abs(constant);
    const result = withAnswer(answer, [multiplier * x - constant, multiplier + x + constant, answer + multiplier, answer - multiplier]);
    return { section:"maths", difficulty:"hard", time:60, question_text:"If y = " + expression + ", what is y when x = " + x + "?", answer_options:result.options, correct_answer:result.index, explanation:"Substitute x = " + x + " into the formula." };
  }

  const ratios = pick([[2,3,4],[3,3,4],[3,4,5],[4,5,6]]);
  const parts = ratios.reduce((sum, value) => sum + value, 0);
  const answer = 360 * ratios[2] / parts;
  const result = withAnswer(answer + "°", [
    360 * ratios[0] / parts + "°", 360 * ratios[1] / parts + "°", "90°", "120°"
  ]);
  return { section:"maths", difficulty:"hard", time:65, question_text:"The angles of a quadrilateral are in the ratio " + ratios.join(":") + ". What is the largest angle?", answer_options:result.options, correct_answer:result.index, explanation:"Angles in a quadrilateral total 360°. Find one ratio part, then multiply by the largest ratio part." };
}

function makeNumericalQuestion() {
  const type = Math.floor(Math.random() * 6);

  if (type === 0) {
    const start = pick([4,5,7,9,12]), step = pick([3,4,5,6]), terms = [start];
    for (let i=1;i<5;i+=1) terms.push(terms[i-1] + step);
    const answer = terms[4] + step;
    const result = withAnswer(answer, [answer-step, answer+step*2, answer+step*3, answer-2]);
    return { section:"numerical", difficulty:"medium", time:50, question_text:"Find the next number: " + terms.join(", ") + ", ?", answer_options:result.options, correct_answer:result.index, explanation:"Each term increases by " + step + "." };
  }

  if (type === 1) {
    const average = pick([14,16,18,20,22]), known = [average-5,average-2,average+1,average+4];
    const answer = average*5 - known.reduce((sum,value)=>sum+value,0);
    const result = withAnswer(answer, [answer-2,answer+2,answer+4,average]);
    return { section:"numerical", difficulty:"medium", time:55, question_text:"The average of five numbers is " + average + ". Four numbers are " + known.join(", ") + ". What is the fifth number?", answer_options:result.options, correct_answer:result.index, explanation:"Total = average × 5. Subtract the four known values." };
  }

  if (type === 2) {
    const speed = pick([48,54,60,72]), hours = pick([1.5,2,2.5,3]), distance = speed*hours;
    const result = withAnswer(speed + " km/h", [(speed-6)+" km/h",(speed+6)+" km/h",(speed*2)+" km/h",(speed/2)+" km/h"]);
    return { section:"numerical", difficulty:"hard", time:60, question_text:"A cyclist travels " + distance + " km in " + hours + " hours. What is the average speed?", answer_options:result.options, correct_answer:result.index, explanation:"Average speed = distance ÷ time." };
  }

  if (type === 3) {
    const boys = pick([2,3,4,5]), girls = pick([3,4,5,6]), totalParts = boys+girls, students = totalParts*pick([4,5,6]);
    const answer = students*girls/totalParts;
    const result = withAnswer(answer, [students-answer,answer+boys,answer-girls,answer+5]);
    return { section:"numerical", difficulty:"hard", time:60, question_text:"In a class, boys:girls = " + boys + ":" + girls + ". If there are " + students + " students, how many are girls?", answer_options:result.options, correct_answer:result.index, explanation:"Divide the total by the number of ratio parts, then multiply by the girls' parts." };
  }

  if (type === 4) {
    const original = pick([80,100,120,160,200]), pct = pick([10,15,20,25]), answer = original*(1+pct/100);
    const result = withAnswer(money(answer), [money(original-pct),money(original*(1-pct/100)),money(answer+10),money(answer-10)]);
    return { section:"numerical", difficulty:"medium", time:55, question_text:"A value of " + money(original) + " increases by " + pct + "%. What is the new value?", answer_options:result.options, correct_answer:result.index, explanation:"Calculate the percentage increase and add it to the original value." };
  }

  const hour = pick([8,9,10,11]), minute = pick([5,15,25,35]), duration = pick([75,95,110,125]);
  const finish = hour*60 + minute + duration, h24 = Math.floor(finish/60)%24, minuteFinish = finish%60;
  const correct = (h24%12 || 12) + ":" + String(minuteFinish).padStart(2,"0") + " " + (h24>=12 ? "pm" : "am");
  const distractors = [5,10,15,20].map(offset => {
    const value = finish+offset, h = Math.floor(value/60)%24;
    return (h%12||12)+":"+String(value%60).padStart(2,"0")+" "+(h>=12?"pm":"am");
  });
  const result = withAnswer(correct,distractors);
  return { section:"numerical", difficulty:"medium", time:55, question_text:"A lesson starts at " + String(hour).padStart(2,"0") + ":" + String(minute).padStart(2,"0") + " and lasts " + duration + " minutes. What time does it finish?", answer_options:result.options, correct_answer:result.index, explanation:"Add the duration in minutes to the starting time." };
}

function makeVerbalQuestion() {
  const type = Math.floor(Math.random() * 6);

  if (type === 0) {
    const pair = pick([
      ["brief","concise"],["rapid","swift"],["accurate","precise"],["cautious","careful"],["observe","notice"],
      ["abundant","plentiful"],["assist","help"],["fortunate","lucky"],["ancient","old"],["difficult","challenging"],
      ["essential","necessary"],["fragile","delicate"],["generous","charitable"],["silent","quiet"],["certain","sure"]
    ]);
    const result = withAnswer(pair[1],["noisy","hostile","distant","fragile"]);
    return { section:"verbal", difficulty:"medium", time:50, question_text:"Which word is closest in meaning to '" + pair[0] + "'?", answer_options:result.options, correct_answer:result.index, explanation:"'" + pair[1] + "' is the closest synonym." };
  }

  if (type === 1) {
    const pair = pick([
      ["reluctant","eager"],["ancient","modern"],["scarce","abundant"],["temporary","permanent"],["expand","contract"],
      ["victory","defeat"],["complex","simple"],["generous","selfish"],["optimistic","pessimistic"],["arrive","depart"],
      ["include","exclude"],["rigid","flexible"],["superior","inferior"],["visible","hidden"],["increase","decrease"]
    ]);
    const result = withAnswer(pair[1],[pair[0],"fragile","curious","silent"]);
    return { section:"verbal", difficulty:"medium", time:50, question_text:"Which word is most nearly opposite in meaning to '" + pair[0] + "'?", answer_options:result.options, correct_answer:result.index, explanation:"'" + pair[1] + "' is the closest antonym." };
  }

  if (type === 2) {
    const pairs = [
      ["SCULPTOR","STATUE","CARTOGRAPHER","MAP"],["AUTHOR","BOOK","COMPOSER","MUSIC"],["ARCHITECT","BUILDING","CHEF","MEAL"],
      ["PAINTER","PORTRAIT","PHOTOGRAPHER","PHOTO"],["CARPENTER","FURNITURE","POTTER","POT"],["DIRECTOR","FILM","EDITOR","ARTICLE"],
      ["TAILOR","CLOTHING","BAKER","BREAD"],["BOTANIST","PLANT","ORNITHOLOGIST","BIRD"],["ENGINEER","BRIDGE","PROGRAMMER","SOFTWARE"],
      ["DENTIST","TEETH","VET","ANIMAL"],["FARMER","CROP","MINER","ORE"],["POET","VERSE","JOURNALIST","REPORT"]
    ];
    const pair = pick(pairs);
    const result = withAnswer(pair[3],[pair[2],"journey","tool","theatre"]);
    return { section:"verbal", difficulty:"hard", time:55, question_text:pair[0]+" is to "+pair[1]+" as "+pair[2]+" is to:", answer_options:result.options, correct_answer:result.index, explanation:"The first pair shows a creator or professional and what they produce or work with." };
  }

  if (type === 3) {
    const group = pick([
      ["generous","charitable","benevolent","selfish"],["rapid","swift","brisk","sluggish"],["fragile","delicate","breakable","durable"],
      ["silent","quiet","soundless","noisy"],["ancient","old","historic","modern"],["careful","cautious","prudent","reckless"],
      ["cheerful","joyful","merry","gloomy"],["honest","truthful","sincere","deceitful"],["tiny","small","minute","enormous"],
      ["angry","furious","irate","calm"],["clever","bright","intelligent","foolish"],["quick","rapid","speedy","sluggish"],
      ["assist","help","aid","hinder"],["begin","start","commence","finish"],["difficult","hard","challenging","easy"]
    ]);
    const result = withAnswer(group[3],group.slice(0,3));
    return { section:"verbal", difficulty:"medium", time:50, question_text:"Which word is the odd one out?", answer_options:result.options, correct_answer:result.index, explanation:"The other three words share a closer meaning or characteristic." };
  }

  if (type === 4) {
    const code = pick([
      ["nems","tavs","lorps"],["daxs","mivs","sorns"],["pels","rins","vorts"],["kems","bavs","jors"],
      ["wexs","fins","grols"],["tens","dovs","paks"],["rims","cals","zors"],["hans","pevs","qors"],
      ["lums","savs","norts"],["gavs","tirs","wens"],["beks","mors","dals"],["fens","rals","vims"]
    ]);
    return {
      section:"verbal", difficulty:"hard", time:60,
      question_text:"If all "+code[0]+" are "+code[1]+" and no "+code[1]+" are "+code[2]+", which statement must be true?",
      answer_options:["No "+code[0]+" are "+code[2],"All "+code[2]+" are "+code[0],"Some "+code[1]+" are "+code[2],"All "+code[0]+" are "+code[2],"No "+code[0]+" exist"],
      correct_answer:0,
      explanation:"Anything that is a "+code[0]+" must be a "+code[1]+", and no "+code[1]+" can be a "+code[2]+"."
    };
  }

  const context = pick([
    ["The engineer remained ___ when the first model failed.","composed"],
    ["The witness gave a ___ account of the events, avoiding unnecessary detail.","succinct"],
    ["The student made a ___ decision after considering the evidence carefully.","prudent"],
    ["The explanation was ___ enough to be accepted by the panel.","plausible"],
    ["The captain was ___ about changing the plan until more evidence arrived.","reluctant"],
    ["The instructions were ___ and easy to follow.","explicit"],
    ["The scientist offered a ___ explanation that fitted the available evidence.","credible"],
    ["The hikers were ___ of the weather and checked the forecast twice.","mindful"],
    ["The manager remained ___ during the difficult negotiation.","calm"],
    ["The reporter tried to remain ___ and describe only what could be verified.","objective"],
    ["The solution was ___ because it used very few resources.","efficient"],
    ["The teacher gave a ___ summary before the class discussion began.","concise"],
    ["The student was ___ to question the first answer and check the calculation.","inclined"],
    ["The committee reached a ___ decision after reviewing all the evidence.","reasoned"],
    ["The mechanic gave a ___ estimate after inspecting the vehicle.","realistic"]
  ]);
  const result = withAnswer(context[1],["reckless","fragile","hostile","lengthy"]);
  return { section:"verbal", difficulty:"medium", time:50, question_text:context[0], answer_options:result.options, correct_answer:result.index, explanation:"The context requires the word '"+context[1]+"'." };
}
function makeReadingQuestion() {
  const passages = [
    {
      p:"Maya passed the old railway station every afternoon. Its windows were dusty and the garden was overgrown. One rainy Thursday, she noticed a warm yellow light behind a window. Before she could knock, she heard a piano playing inside.",
      qs:[
        ["What first suggested that the station might not be abandoned?","The warm light",["The rain","The overgrown garden","The broken fence","The empty platform"]],
        ["What did Maya hear after noticing the light?","A piano playing",["A train arriving","A bell ringing","Voices outside","Birds singing"]],
        ["Why was Maya surprised by the station?","It appeared unused but showed signs of activity.",["It was newly built.","It had been moved.","It was brightly painted.","It was next to a busy road."]],
        ["The word 'overgrown' most nearly means:","Covered by plants that have grown unchecked.",["Recently planted","Carefully trimmed","Completely empty","Recently painted"]],
        ["What is the most likely reason Maya became curious?","The signs of life contradicted what the station looked like.",["She wanted to buy the station.","She was late for school.","She needed a train ticket.","She had lost her map."]]
      ]
    },
    {
      p:"The school garden had once been a neglected patch of dirt. Over several months, students planted herbs, vegetables and native flowers. By the end of spring, bees and butterflies had returned, and the science teacher began using the garden for lessons.",
      qs:[
        ["Which statement best describes the main idea?","The garden became useful through student effort.",["The science teacher disliked the garden.","Bees caused problems for the students.","The school replaced its science lessons.","The garden was removed."]],
        ["What happened by the end of spring?","Bees and butterflies returned.",["The garden was paved.","The students stopped gardening.","The library was expanded.","The flowers were removed."]],
        ["Why did the science teacher use the garden?","It provided a practical setting for lessons.",["It was the quietest room.","It contained computers.","It replaced the library.","It was used as a sports field."]],
        ["The word 'neglected' most nearly means:","Not properly cared for.",["Newly built","Carefully decorated","Closely watched","Fully repaired"]],
        ["What can be inferred about the students?","Their work changed the area over time.",["They disliked plants.","They avoided outdoor work.","They damaged the garden.","They were forced to remove the flowers."]]
      ]
    },
    {
      p:"Arun had planned his speech carefully, but when he reached the stage the microphone failed. Instead of stopping, he moved closer to the audience and continued without it. At first his voice trembled; by the end, the room was silent as everyone listened.",
      qs:[
        ["What can be inferred about Arun?","He adapted to an unexpected problem.",["He had forgotten his speech.","He refused to speak.","He was not prepared.","He left the room."]],
        ["Why did Arun move closer to the audience?","The microphone had stopped working.",["He wanted to leave the stage.","The audience moved away.","The room became crowded.","He had forgotten his notes."]],
        ["How did Arun's confidence change?","He became steadier as the speech continued.",["He became increasingly confused.","He stopped speaking.","He left the building.","He became louder immediately."]],
        ["What does 'trembled' suggest about Arun's voice?","It sounded slightly unsteady.",["It was very loud.","It was completely silent.","It sounded recorded.","It was unusually deep."]],
        ["Why was the room silent at the end?","The audience was concentrating on Arun.",["The lights had failed.","The audience had left.","The bell had rung.","The building was empty."]]
      ]
    },
    {
      p:"When the final bell rang, Leo did not rush home. He remained in the library, comparing two maps spread across a table. One showed the town as it was today; the other had been drawn almost a century earlier. The missing road on the older map fascinated him.",
      qs:[
        ["Why was Leo interested in the older map?","It showed a road that no longer appeared.",["It was easier to read.","It belonged to his teacher.","It showed his house.","It had brighter colours."]],
        ["What was Leo doing in the library?","Comparing two maps.",["Writing a story","Repairing a book","Studying a photograph","Drawing a new building"]],
        ["What difference did Leo notice?","A road was missing from the older map.",["The town was in another country.","The maps had different colours only.","The library had moved.","The newer map was hand-drawn."]],
        ["The word 'fascinated' most nearly means:","Very interested.",["Very tired","Very confused","Very annoyed","Very hurried"]],
        ["What can be inferred about Leo?","He is curious about how places change over time.",["He dislikes maps.","He avoids the library.","He is afraid of history.","He wants to leave school."]]
      ]
    },
    {
      p:"The first attempt at building the model bridge collapsed under a small weight. Rather than discard it, the students examined the joints, changed the design and tried again. Their second bridge held twice as much weight.",
      qs:[
        ["What quality did the students demonstrate?","Persistence",["Carelessness","Indifference","Impatience","Confusion"]],
        ["What did the students examine after the first failure?","The joints of the bridge.",["The classroom windows","The instruction booklet only","The floor","Another team's notes"]],
        ["Why was the second bridge stronger?","The students changed the design after examining the failure.",["They used no joints.","They made it much smaller.","They stopped testing it.","They ignored the first result."]],
        ["The word 'discard' most nearly means:","Throw away or reject.",["Measure carefully","Decorate brightly","Repair slowly","Carry outside"]],
        ["What does the result of the second test show?","The redesign improved the bridge.",["The first design was perfect.","Testing was unnecessary.","The students stopped working.","The bridge was made of metal."]]
      ]
    },
    {
      p:"At dawn the beach looked empty. As the sun rose, however, tiny tracks appeared in the wet sand leading from the dunes to the water. The ranger smiled and quietly marked the area with signs asking visitors to keep away.",
      qs:[
        ["Why did the ranger place signs?","To protect a sensitive area from visitors.",["To direct people to the water.","To advertise the beach.","To stop the tide.","To open a new pathway."]],
        ["What probably made the tracks?","Wildlife moving between the dunes and water.",["Cars","Beach cleaners","Boats","Tourists carrying equipment"]],
        ["Why did the ranger act quietly?","She did not want to disturb the animals.",["She was closing the beach forever.","She had forgotten the signs.","She was avoiding a storm.","She was waiting for a bus."]],
        ["The word 'marked' most nearly means:","Identified or indicated with a sign.",["Erased completely","Hidden underground","Painted a picture","Measured with a ruler"]],
        ["What can be inferred about the area?","It may be an important habitat.",["It is a busy car park.","It is a shopping centre.","It is used for road races.","It has no wildlife."]]
      ]
    },
    {
      p:"Priya had expected the new student to be unfriendly because he rarely spoke. During group work, however, he quietly noticed that another student had been left without a partner and invited her to join his group.",
      qs:[
        ["What does the event reveal?","His quietness did not mean he was unkind.",["Priya was correct about him.","He disliked group work.","He wanted to leave school.","He refused to help others."]],
        ["Why had Priya formed her first impression?","The student rarely spoke.",["He had argued with a teacher.","He arrived late every day.","He refused to study.","He changed schools twice."]],
        ["What action changed Priya's view?","He invited another student into his group.",["He answered a difficult question.","He left the room.","He criticised the teacher.","He spoke loudly to the class."]],
        ["The word 'unfriendly' in the passage most nearly means:","Not welcoming or kind.",["Very talented","Extremely quiet","Highly organised","Always cheerful"]],
        ["What lesson is suggested by the passage?","A person's actions can be more revealing than first impressions.",["Quiet people never cooperate.","First impressions are always correct.","Group work should be avoided.","Speaking often proves kindness."]]
      ]
    },
    {
      p:"The town council proposed removing several old trees to widen a road. Residents objected, arguing that the trees provided shade and habitat. After reviewing traffic data, the council revised the plan so that fewer trees would need to be removed.",
      qs:[
        ["What changed the final decision?","The council considered evidence and revised its plan.",["The residents moved away.","The road became unnecessary.","The trees were already gone.","The weather became colder."]],
        ["Why did residents object?","They valued the trees' shade and habitat.",["They wanted a new library.","They disliked traffic lights.","They wanted to close the road.","They planned to move the town."]],
        ["What did the revised plan achieve?","Fewer trees would be removed.",["All traffic was stopped.","The road became longer and narrower.","Every tree was removed.","The project was cancelled completely."]],
        ["The word 'revised' most nearly means:","Changed after reconsideration.",["Copied exactly","Forgotten quickly","Measured precisely","Hidden from view"]],
        ["What can be inferred about the council?","It was willing to change its plan after reviewing information.",["It ignored all evidence.","It had already removed the trees.","It refused to listen.","It cancelled every road project."]]
      ]
    },
    {
      p:"Nina opened the cupboard and found three identical jars. One contained salt, one sugar and one flour. None was labelled. She remembered that sugar felt slightly grainy while flour was much softer, and decided to identify them by texture before tasting anything.",
      qs:[
        ["Why did Nina use texture?","She wanted to avoid tasting unknown substances.",["She could not see the jars.","She had forgotten what sugar was.","She wanted to mix them together.","She disliked all cooking."]],
        ["What problem did Nina face?","The jars were unlabelled.",["The cupboard was empty.","The flour had spilled.","The sugar was wet.","The labels were too large."]],
        ["What distinction did Nina remember?","Sugar felt grainier than flour.",["Salt was softer than sugar.","Flour felt harder than salt.","All three substances felt identical.","Sugar was always warm."]],
        ["The word 'texture' most nearly refers to:","How a material feels to touch.",["How loudly it sounds","How quickly it moves","How brightly it shines","How strongly it smells"]],
        ["What can be inferred about Nina's approach?","She used an available observation before taking a risk.",["She always tastes unknown substances.","She ignored the differences between the jars.","She wanted to waste the ingredients.","She avoided solving the problem."]]
      ]
    },
    {
      p:"Although the painting appeared unfinished at first glance, the artist had intentionally left large areas of blank canvas. These spaces drew attention to the small, brightly detailed figure at the centre.",
      qs:[
        ["What is the purpose of the blank areas?","They make the central figure more noticeable.",["They indicate the artist ran out of paint.","They hide a second figure.","They show that the canvas was damaged.","They make the painting harder to understand."]],
        ["Why might the painting appear unfinished at first?","Large areas of canvas are deliberately left blank.",["The frame was missing.","The colours had faded.","The figure had been erased.","The museum lights were off."]],
        ["Where is the most detailed figure?","At the centre.",["In the top corner","Near the frame","At the bottom edge","Outside the canvas"]],
        ["The word 'intentionally' most nearly means:","Deliberately.",["Accidentally","Immediately","Quietly","Rarely"]],
        ["What can be inferred about the artist's method?","The use of empty space is part of the design.",["The artist forgot to finish the work.","The canvas was damaged before painting.","The figure was added by someone else.","The painting was completed by accident."]]
      ]
    },
    {
      p:"Sam kept a notebook beside his bed. Whenever he woke with an idea, he wrote it down immediately. Months later, he found several of those notes useful when planning a school project.",
      qs:[
        ["What was the main benefit of the notebook?","It helped him remember ideas.",["It stopped him sleeping.","It replaced his school books.","It helped him wake earlier.","It made the project disappear."]],
        ["Why did Sam write notes immediately?","He wanted to preserve ideas before forgetting them.",["He was asked to copy homework.","The notebook was being tested.","He disliked planning.","He wanted to fill the pages."]],
        ["When did the notes become useful?","Months later, during project planning.",["Only before breakfast","During a sports lesson","Before he bought the notebook","On the first night"]],
        ["The word 'useful' most nearly means:","Helpful for a purpose.",["Difficult to read","Expensive to replace","Impossible to understand","Too large to carry"]],
        ["What can be inferred about Sam?","He values recording ideas for later use.",["He never plans ahead.","He dislikes writing.","He throws away his ideas.","He avoids school projects."]]
      ]
    },
    {
      p:"A council library introduced a shelf labelled 'Take One, Leave One'. Visitors could borrow a book without registering it, provided they later returned a different book of their own. After three months, the shelf contained twice as many books as when it began.",
      qs:[
        ["What was the purpose of the shelf?","To encourage readers to exchange books.",["To store library equipment.","To sell new textbooks.","To display rare paintings.","To collect school uniforms."]],
        ["What happened after three months?","The shelf had twice as many books.",["The shelf was removed.","No one used it.","Every book was damaged.","The library closed."]],
        ["What rule did visitors follow?","Take a book and later leave a different one.",["Borrow two books and keep both.","Pay for every book.","Return the same book the next day.","Only staff could use the shelf."]],
        ["The word 'introduced' most nearly means:","Started or brought into use.",["Removed from display","Hidden from visitors","Copied from another shelf","Repaired after damage"]],
        ["What can be inferred about visitors?","Enough people contributed books for the collection to grow.",["No one read the books.","Visitors refused to share.","Only staff donated books.","The shelf was never opened."]]
      ]
    }
  ];

  const item = pick(passages);
  const q = pick(item.qs);
  const result = withAnswer(q[1], q[2]);
  return {
    section:"reading",
    difficulty:pick(["medium","hard"]),
    time:80,
    passage:item.p,
    question_text:q[0],
    answer_options:result.options,
    correct_answer:result.index,
    explanation:"The passage provides the evidence needed to choose the best answer."
  };
}
function makeQuestion(section) {
  if (section === "maths") return makeMathQuestion();
  if (section === "numerical") return makeNumericalQuestion();
  if (section === "verbal") return makeVerbalQuestion();
  return makeReadingQuestion();
}

async function releaseStaleQuestionBankClaims() {
  if (!supabase) return;

  const cutoff = new Date(Date.now() - assessmentTtlMs).toISOString();
  const [
    { data: completedAttempts, error: completedError },
    { data: expiredAttempts, error: expiredError }
  ] = await Promise.all([
    supabase
      .from("quiz_attempts")
      .select("session_id")
      .eq("year_level", "10")
      .not("completed_at", "is", null)
      .limit(1000),
    supabase
      .from("quiz_attempts")
      .select("session_id")
      .eq("year_level", "10")
      .is("completed_at", null)
      .lt("started_at", cutoff)
      .limit(1000)
  ]);

  if (completedError || expiredError) {
    console.error("Question bank cleanup lookup failed", completedError || expiredError);
    return;
  }

  const sessionIds = [...new Set([
    ...(completedAttempts || []).map(row => row.session_id),
    ...(expiredAttempts || []).map(row => row.session_id)
  ].filter(Boolean))];

  if (!sessionIds.length) return;

  const { error } = await supabase
    .from("generated_questions")
    .update({ session_id: null })
    .eq("year_level", "10")
    .eq("is_bank", true)
    .in("session_id", sessionIds);

  if (error) console.error("Question bank cleanup failed", error);
}

async function generateQuestions(req, sessionId, config, targetSection = null) {
  if (!supabase) return [];

  try {
    await releaseStaleQuestionBankClaims();
  } catch (error) {
    console.error("Question bank cleanup failed", error);
  }

  const quotas = targetSection
    ? [[targetSection, Number(config.sectionCounts[targetSection]) || 0]]
    : [
        ["humanities", Number(config.sectionCounts.humanities) || 0],
        ["mathematics_science", Number(config.sectionCounts.mathematics_science) || 0]
      ];
  const total = Number(config.totalQuestionCount) || 0;
  const targetTotal = targetSection
    ? Number(config.sectionCounts[targetSection]) || 0
    : total;

  const { data: sessionRows, error: sessionError } = await supabase
    .from("generated_questions")
    .select("id,session_id,section,difficulty,time,question_text,passage,stimulus_group,stimulus_image,answer_options,correct_answer,explanation")
    .eq("session_id", sessionId)
    .eq("year_level", config.yearLevel);

  if (sessionError) {
    console.error("Session question lookup failed", sessionError);
    return [];
  }

  const counts = { humanities: 0, mathematics_science: 0 };
  const used = new Set();
  for (const row of sessionRows || []) {
    if (counts[row.section] !== undefined) counts[row.section] += 1;
    used.add(questionFingerprint(row));
  }

  const currentTotal = targetSection
    ? counts[targetSection]
    : Object.values(counts).reduce((sum, value) => sum + value, 0);
  const neededTotal = Math.max(0, targetTotal - currentTotal);
  if (!neededTotal) return sessionRows || [];

  const pending = [];
  const pendingIds = new Set();
  const claimedBankIds = new Set();

  // Prefer the persistent question bank for the grouped Year 10 MCQ sections.
  // Bank rows are claimed by attaching them to the new session, then released
  // after completion or expiry so the bank does not permanently deplete.
  for (const [section, quota] of quotas) {
    const needed = Math.max(
      0,
      quota - counts[section] - pending.filter(item => item.section === section).length
    );
    if (!needed) continue;

    const { data: rawBankRows, error: bankError } = await supabase
      .from("generated_questions")
      .select("id,session_id,section,subject,difficulty,time,question_text,passage,stimulus_group,stimulus_image,answer_options,correct_answer,explanation,is_bank")
      .eq("year_level", config.yearLevel)
      .eq("is_bank", true)
      .is("session_id", null)
      .limit(5000);

    const bankRows = (rawBankRows || []).filter(row =>
      section === "mathematics_science"
        ? row.section === "mathematics_science" || ["mathematics", "science"].includes(row.subject)
        : row.section === section || row.subject === section
    );

    if (bankError) {
      console.error("Question bank lookup failed", bankError);
      continue;
    }

    const bankCount = Math.min(needed, neededTotal - pending.length);
    let selected = pickStimulusGroups(bankRows || [], bankCount, used, 5);

    // Dynamically generated questions are individual bank rows rather than
    // multi-question stimulus pages. Select those directly when grouped
    // pages cannot fill the remaining quota.
    if (selected.length < bankCount) {
      const selectedIds = new Set(selected.map(row => row.id));
      const individualRows = (bankRows || []).filter(row => !selectedIds.has(row.id));
      selected = selected.concat(
        pickDiverseQuestions(
          individualRows,
          bankCount - selected.length,
          used
        )
      );
    }

    if (!selected.length) continue;

    const selectedIds = selected.map(source => source.id);
    const { data: claimedRows, error: claimError } = await supabase
      .from("generated_questions")
      .update({
        session_id: sessionId,
        ip_hash: ipHash(req),
        section: section === "mathematics_science" ? "mathematics_science" : section
      })
      .in("id", selectedIds)
      .eq("is_bank", true)
      .is("session_id", null)
      .select("id");

    if (claimError) {
      console.error("Question bank claim failed", claimError);
      continue;
    }

    const claimedIdSet = new Set((claimedRows || []).map(row => row.id));
    if (claimedIdSet.size !== selectedIds.length) {
      if (claimedIdSet.size) {
        await supabase
          .from("generated_questions")
          .update({ session_id: null })
          .eq("is_bank", true)
          .in("id", [...claimedIdSet])
          .eq("session_id", sessionId);
      }
      continue;
    }

    for (const source of selected) {
      if (pending.length >= neededTotal) break;

      const question = {
        id: source.id,
        year_level: config.yearLevel,
        session_id: sessionId,
        ip_hash: ipHash(req),
        section: section === "mathematics_science" ? "mathematics_science" : source.section,
        subject: source.subject || (source.section === "mathematics_science" ? "mathematics_science" : source.section),
        difficulty: source.difficulty || "hard",
        time: Number(source.time) || 60,
        question_text: source.question_text,
        passage: source.passage || "",
        stimulus_group: source.stimulus_group || null,
        stimulus_image: source.stimulus_image || null,
        answer_options: source.answer_options,
        correct_answer: source.correct_answer,
        explanation: source.explanation || "",
        reasoning_type: source.reasoning_type
      };

      const fp = questionFingerprint(question);
      if (used.has(fp) || pendingIds.has(question.id)) continue;

      pending.push(question);
      pendingIds.add(question.id);
      claimedBankIds.add(question.id);
      used.add(fp);
    }
  }

  // Runtime assessments are database-only. The hourly question-pool job is
  // responsible for keeping the persistent bank populated. Never generate a
  // question synchronously for a student session.
  if (pending.length < neededTotal) {
    for (const [section, quota] of quotas) {
      if (pending.length >= neededTotal) break;

      const needed = Math.max(
        0,
        quota - counts[section] - pending.filter(item => item.section === section).length
      );
      if (!needed) continue;

      const { data: rawBankRows, error } = await supabase
        .from("generated_questions")
        .select("id,session_id,section,subject,difficulty,time,question_text,passage,stimulus_group,stimulus_image,answer_options,correct_answer,explanation,is_bank")
        .eq("year_level", config.yearLevel)
        .eq("is_bank", true)
        .is("session_id", null)
        .limit(5000);

      const bankRows = (rawBankRows || []).filter(row =>
        section === "mathematics_science"
          ? row.section === "mathematics_science" || ["mathematics", "science"].includes(row.subject)
          : row.section === section || row.subject === section
      );

      if (error) {
        console.error("Question bank lookup failed", error);
        continue;
      }

      const remaining = Math.min(needed, neededTotal - pending.length);
      const selected = pickDiverseQuestions(bankRows || [], remaining, used);

      if (!selected.length) continue;

      const selectedIds = selected.map(source => source.id);
      const { data: claimedRows, error: claimError } = await supabase
        .from("generated_questions")
        .update({
          session_id: sessionId,
          ip_hash: ipHash(req),
          section: section === "mathematics_science" ? "mathematics_science" : section
        })
        .in("id", selectedIds)
        .eq("is_bank", true)
        .is("session_id", null)
        .select("id");

      if (claimError) {
        console.error("Question bank fallback claim failed", claimError);
        continue;
      }

      const claimedIdSet = new Set((claimedRows || []).map(row => row.id));
      for (const source of selected) {
        if (pending.length >= neededTotal || !claimedIdSet.has(source.id)) break;

        const question = {
          id: source.id,
          year_level: config.yearLevel,
          session_id: sessionId,
          ip_hash: ipHash(req),
          section: source.section,
          difficulty: source.difficulty || "hard",
          time: Number(source.time) || 60,
          question_text: source.question_text,
          passage: source.passage || "",
          stimulus_group: source.stimulus_group || null,
          stimulus_image: source.stimulus_image || null,
          answer_options: source.answer_options,
          correct_answer: source.correct_answer,
          explanation: source.explanation || ""
        };

        const fp = questionFingerprint(question);
        if (used.has(fp) || pendingIds.has(question.id)) continue;

        pending.push(question);
        pendingIds.add(question.id);
        claimedBankIds.add(question.id);
        used.add(fp);
      }
    }
  }

  if (pending.length < neededTotal) {
    console.error("Year 10 assessment pool could not satisfy the configured size", {
      sessionId, generated: pending.length, target: neededTotal
    });
    return [];
  }

  const rowsToInsert = pending
    .filter(question => !claimedBankIds.has(question.id))
    .map(question => ({
    id: question.id,
    session_id: question.session_id,
    ip_hash: question.ip_hash,
    year_level: config.yearLevel,
    section: question.section,
    difficulty: question.difficulty,
    time: question.time,
    question_text: question.question_text,
    passage: question.passage || null,
    stimulus_group: question.stimulus_group || null,
    stimulus_image: question.stimulus_image || null,
    answer_options: question.answer_options,
    correct_answer: question.correct_answer,
    explanation: question.explanation || ""
  }));

  for (let i = 0; i < rowsToInsert.length; i += 25) {
    const { error } = await supabase
      .from("generated_questions")
      .insert(rowsToInsert.slice(i, i + 25));
    if (error) {
      console.error("Question batch insert failed", error);
      return [];
    }
  }

  return pending;
}

async function ensureQuestionsGenerated(req, sessionId, config, targetSection = null) {
  const lockKey = targetSection ? sessionId + ":" + targetSection : sessionId;
  const existing = generationLocks.get(lockKey);
  if (existing) {
    await existing;
    return;
  }

  const promise = generateQuestions(req, sessionId, config, targetSection)
    .catch(error => {
      console.error("Question generation failed", error);
      return [];
    })
    .finally(() => generationLocks.delete(lockKey));

  generationLocks.set(lockKey, promise);
  await promise;
}

app.get("/health", (req, res) => res.json({ ok: true }));

app.post("/api/admin/login", (req,res) => {
  if (!adminEmail || !adminPassword) return res.status(503).json({ error:"Admin login is not configured" });
  const { email, password } = req.body || {};
  if (email !== adminEmail || password !== adminPassword) return res.status(401).json({ error:"Incorrect email or password" });
  const token = signSession({ email, exp: Date.now() + 8 * 60 * 60 * 1000 });
  res.setHeader("Set-Cookie", cookieName+"="+token+"; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800");
  res.json({ ok:true });
});

app.post("/api/admin/logout", (req,res) => {
  res.setHeader("Set-Cookie", cookieName+"=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
  res.json({ ok:true });
});

app.get("/api/admin/me", requireAdmin, (req,res) => res.json({ ok:true }));

app.get("/api/admin/attempts/summary", requireAdmin, async (req,res) => {
  if (!supabase) return res.status(503).json({ error:"Supabase is not configured" });

  const { count: totalAttempts, error: attemptCountError } = await supabase
    .from("quiz_attempts")
    .select("id", { count:"exact", head:true });

  const { count: totalResponses, error: responseCountError } = await supabase
    .from("quiz_responses")
    .select("id", { count:"exact", head:true });

  if (attemptCountError || responseCountError) {
    return res.status(400).json({ error:(attemptCountError || responseCountError).message });
  }

  const scores = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data: page, error } = await supabase
      .from("quiz_attempts")
      .select("score")
      .not("score","is",null)
      .range(from, from + pageSize - 1);
    if (error) return res.status(400).json({ error:error.message });
    scores.push(...(page || []).map(row => Number(row.score)).filter(Number.isFinite));
    if (!page || page.length < pageSize) break;
  }

  res.json({
    total_attempts:Number(totalAttempts || 0),
    total_responses:Number(totalResponses || 0),
    average_score:scores.length
      ? Math.round(scores.reduce((sum,score) => sum + score, 0) / scores.length)
      : 0,
    best_score:scores.length ? Math.max(...scores) : 0
  });
});

app.get("/api/admin/attempts", requireAdmin, async (req,res) => {
  if (!supabase) return res.status(503).json({ error:"Supabase is not configured" });

  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(50, Math.max(10, Number.parseInt(req.query.page_size, 10) || 25));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data: attempts, error: attemptsError, count: total } = await supabase
    .from("quiz_attempts")
    .select("*", { count:"exact" })
    .order("started_at",{ascending:false})
    .order("id",{ascending:false})
    .range(from, to);

  if (attemptsError) return res.status(400).json({ error:attemptsError.message });

  const attemptIds = (attempts || []).map(attempt => attempt.id);
  const aggregates = new Map();

  if (attemptIds.length) {
    const responsePageSize = 1000;
    for (let responseFrom = 0; ; responseFrom += responsePageSize) {
      const { data: responsePage, error: responseError } = await supabase
        .from("quiz_responses")
        .select("attempt_id,is_correct,timed_out,response_seconds,difficulty")
        .in("attempt_id", attemptIds)
        .range(responseFrom, responseFrom + responsePageSize - 1);

      if (responseError) return res.status(400).json({ error:responseError.message });

      for (const response of responsePage || []) {
        const current = aggregates.get(response.attempt_id) || {
          answered_count:0,
          correct_count:0,
          wrong_count:0,
          timeout_count:0,
          total_response_seconds:0,
          weighted_earned:0,
          weighted_possible:0
        };

        current.answered_count += 1;
        if (response.timed_out) current.timeout_count += 1;
        else if (response.is_correct) current.correct_count += 1;
        else current.wrong_count += 1;
        current.total_response_seconds += Number(response.response_seconds || 0);
        const weight = difficultyWeight(response.difficulty);
        current.weighted_possible += weight;
        if (response.is_correct && !response.timed_out) current.weighted_earned += weight;
        aggregates.set(response.attempt_id, current);
      }

      if (!responsePage || responsePage.length < responsePageSize) break;
    }
  }

  const enriched = (attempts || []).map(attempt => {
    const aggregate = aggregates.get(attempt.id);
    if (!aggregate || aggregate.answered_count === 0) {
      return {
        ...attempt,
        answered_count:0,
        correct_count:0,
        wrong_count:0,
        timeout_count:0
      };
    }

    const score = aggregate.weighted_possible
      ? Math.round((aggregate.weighted_earned / aggregate.weighted_possible) * 100)
      : 0;
    const average = aggregate.total_response_seconds / aggregate.answered_count;

    return {
      ...attempt,
      score,
      correct_count:aggregate.correct_count,
      wrong_count:aggregate.wrong_count,
      timeout_count:aggregate.timeout_count,
      average_response_seconds:Number(average.toFixed(3)),
      answered_count:aggregate.answered_count
    };
  });

  res.json({
    attempts:enriched,
    page,
    page_size:pageSize,
    total:Number(total || 0),
    has_more:to + 1 < Number(total || 0)
  });
});

app.delete("/api/admin/attempts/:id", requireAdmin, async (req,res) => {
  if (!supabase) return res.status(503).json({ error:"Supabase is not configured" });

  const id=String(req.params.id || "").trim();
  if (!validUuid(id)) return res.status(400).json({ error:"Invalid attempt id" });

  const { data, error } = await supabase.rpc("admin_delete_quiz_attempt", {
    p_attempt_id:id
  });

  if (error) return res.status(400).json({ error:error.message });
  if (!data?.deleted) return res.status(404).json({ error:"Assessment not found" });

  res.json({ ok:true, deleted_id:id });
});

app.get("/api/admin/attempts/:id/responses", requireAdmin, async (req,res) => {
  if (!supabase) return res.status(503).json({ error:"Supabase is not configured" });

  const { data: attempt, error: attemptError } = await supabase
    .from("quiz_attempts")
    .select("*")
    .eq("id", req.params.id)
    .maybeSingle();

  if (attemptError) return res.status(400).json({ error:attemptError.message });
  if (!attempt) return res.status(404).json({ error:"Attempt not found" });

  const [
    { data: questions, error:questionError },
    { data: responses, error:responseError },
    { data: writingResponses, error:writingError }
  ] = await Promise.all([
    supabase
      .from("generated_questions")
      .select("id,section,difficulty,time,question_text,answer_options,correct_answer,explanation,passage,stimulus_group,stimulus_image")
      .eq("session_id", attempt.session_id)
      .eq("year_level", attempt.year_level || "10"),
    supabase
      .from("quiz_responses")
      .select("*")
      .eq("attempt_id", req.params.id)
      .order("answered_at",{ascending:true}),
    supabase
      .from("quiz_writing_responses")
      .select("*")
      .eq("attempt_id", req.params.id)
      .order("submitted_at",{ascending:true})
  ]);

  if (questionError || responseError || writingError) {
    return res.status(400).json({ error:(questionError || responseError || writingError).message });
  }

  const sectionOrder = { humanities: 0, mathematics_science: 1 };
  const orderedQuestions = [...(questions || [])].sort((a,b) =>
    (sectionOrder[a.section] ?? 99) - (sectionOrder[b.section] ?? 99) ||
    String(a.stimulus_group || "").localeCompare(String(b.stimulus_group || "")) ||
    String(a.id).localeCompare(String(b.id))
  );

  const responseByQuestion = new Map((responses || []).map(response => [response.question_id, response]));
  const detailedResponses = orderedQuestions.map(question => ({
    ...question,
    ...(responseByQuestion.get(question.id) || {}),
    answered: responseByQuestion.has(question.id)
  }));

  res.json({
    attempt,
    responses:detailedResponses,
    writing_responses:writingResponses || []
  });
});

app.post("/api/assessments/start", async (req,res) => {
  try {
    if (!supabase) return res.status(503).json({ error:"Supabase is not configured" });

    const { session_name, year_level } = req.body || {};
    const name = String(session_name || "").trim();
    if (!name) return res.status(400).json({ error:"Student name is required" });
    if (name.length > 80) return res.status(400).json({ error:"Student name is too long" });
    if (String(year_level) !== "10") {
      return res.status(400).json({ error:"Only Year 10 Level 2 practice is available" });
    }

    if (!rateLimit("assessment-start:" + clientIp(req), 30, 15 * 60 * 1000)) {
      return res.status(429).json({ error:"Too many assessment starts. Please wait a few minutes and try again." });
    }

    const config = await getAssessmentConfig();
    const sessionId = crypto.randomUUID();
    const expiresAt = Date.now() + assessmentTtlMs;

    const { data: attempt, error: attemptError } = await supabase
      .from("quiz_attempts")
      .insert({
        session_id:sessionId,
        session_name:name,
        year_level:"10",
        section:"Written Expression, Humanities, Mathematics & Science, Written Expression",
        difficulty:"all",
        question_count:config.totalQuestionCount,
        section_counts:config.sectionCounts
      })
      .select("id")
      .single();

    if (attemptError) {
      console.error("Assessment attempt creation failed", attemptError);
      return res.status(400).json({ error:"Could not create assessment" });
    }

    setAssessmentCookie(req, res, signAssessmentToken(sessionId, expiresAt), Math.floor(assessmentTtlMs / 1000));

    res.json({
      session_id:sessionId,
      attempt_id:attempt.id,
      total:config.totalQuestionCount,
      section_counts:config.sectionCounts,
      ready:true,
      manifest:[],
      writing_tasks:await getAssessmentWritingTasks(),
      questions:[]
    });
  } catch(error) {
    console.error(error);
    res.status(500).json({ error:"Assessment could not be started" });
  }
});

app.post("/api/assessments/:sessionId/prepare-section", async (req,res) => {
  const sessionId = String(req.params.sessionId || "");
  if (!requireAssessmentAccess(req, res, sessionId, "assessment-prepare:" + sessionId)) return;

  try {
    if (!supabase) return res.status(503).json({ error:"Supabase is not configured" });
    const section = String(req.body?.section || "");
    if (!["humanities","mathematics_science"].includes(section)) {
      return res.status(400).json({ error:"Invalid subject selection" });
    }

    const config = await getAssessmentConfig();
    await ensureQuestionsGenerated(req, sessionId, config, section);

    const expected = Number(config.sectionCounts[section]) || 0;
    const { count, error } = await supabase
      .from("generated_questions")
      .select("id", { count: "exact", head: true })
      .eq("session_id", sessionId)
      .eq("year_level", config.yearLevel)
      .eq("section", section);

    if (error || Number(count) < expected) {
      console.error("Selected section is not ready", { section, count, expected, error });
      return res.status(503).json({ error:"Could not prepare the selected test" });
    }

    res.json({ ok:true, section, count:Number(count) });
  } catch (error) {
    console.error("Section preparation failed", error);
    res.status(500).json({ error:"Could not prepare the selected test" });
  }
});

app.get("/api/assessments/:sessionId/questions", async (req,res) => {
  const sessionId = String(req.params.sessionId || "");
  if (!requireAssessmentAccess(req, res, sessionId, "assessment-questions:" + sessionId)) return;

  try {
    if (!supabase) return res.status(503).json({ error:"Supabase is not configured" });
    const config = await getAssessmentConfig();
    const offset = Number.isInteger(Number(req.query.offset)) ? Number(req.query.offset) : 0;
    const limit = Number.isInteger(Number(req.query.limit)) ? Number(req.query.limit) : 10;
    const requestedSection = String(req.query.section || "").trim();

    if (offset < 0 || offset >= config.totalQuestionCount || limit < 1 || limit > 10) {
      return res.status(400).json({ error:"Invalid question range" });
    }
    if (requestedSection && !["humanities","mathematics_science"].includes(requestedSection)) {
      return res.status(400).json({ error:"Invalid subject" });
    }

    const { data: rows, error } = await supabase
      .from("generated_questions")
      .select("id,section,difficulty,time,question_text,answer_options,passage,stimulus_group,stimulus_image")
      .eq("session_id", sessionId)
      .eq("year_level", config.yearLevel);

    if (error || !rows) {
      return res.status(409).json({ error:"Assessment questions are not ready" });
    }

    const sectionOrder = { humanities: 0, mathematics_science: 1 };
    const allOrderedRows = [...rows].sort((a, b) =>
      (sectionOrder[a.section] ?? 99) - (sectionOrder[b.section] ?? 99) ||
      (a.section === "humanities"
        ? String(a.stimulus_group || "").localeCompare(String(b.stimulus_group || ""))
        : String(a.id).localeCompare(String(b.id))) ||
      String(a.id).localeCompare(String(b.id))
    );

    const orderedRows = requestedSection
      ? allOrderedRows.filter(row => row.section === requestedSection)
      : allOrderedRows;

    if (!requestedSection && orderedRows.length < config.totalQuestionCount) {
      return res.status(409).json({ error:"Assessment questions are not ready" });
    }

    const sectionStart = requestedSection === "mathematics_science"
      ? Number(config.sectionCounts.humanities) || 0
      : 0;
    const localOffset = requestedSection ? offset - sectionStart : offset;
    const expected = requestedSection ? Number(config.sectionCounts[requestedSection]) || 0 : config.totalQuestionCount;

    if (localOffset < 0 || localOffset >= expected || orderedRows.length < expected) {
      return res.status(409).json({ error:"Selected subject questions are not ready" });
    }

    const manifest = orderedRows.slice(0,expected).map((q,index)=>({
      number:sectionStart + index + 1,
      id:q.id,section:q.section,difficulty:q.difficulty,time:q.time||60
    }));
    const selectedRows = orderedRows.slice(localOffset, Math.min(localOffset+limit, expected));

    res.json({
      total: requestedSection ? expected : config.totalQuestionCount,
      offset,limit,section_counts:config.sectionCounts,manifest,
      questions:selectedRows.map(q=>({
        id:q.id,section:q.section,difficulty:q.difficulty,time:q.time||60,
        q:q.question_text,o:q.answer_options,passage:q.passage||"",stimulus_group:q.stimulus_group||null,stimulus_image:q.stimulus_image||null
      }))
    });
  } catch(error) {
    console.error(error);
    res.status(500).json({ error:"Could not load assessment questions" });
  }
});

app.get("/api/questions", (req,res) => {
  res.status(404).json({ error:"Not found" });
});

app.post("/api/responses", async (req,res) => {
  if (!supabase) return res.status(503).json({ error:"Supabase is not configured" });
  const { attempt_id, session_id, question_id, selected_answer, timed_out, response_seconds } = req.body || {};

  if (!validUuid(session_id) || !attempt_id || !question_id) return res.status(400).json({ error:"Invalid response data" });
  if (!verifyAssessmentToken(req, session_id)) return res.status(401).json({ error:"Assessment access required" });
  if (!rateLimit("assessment-response:" + session_id, 300, 60 * 60 * 1000)) {
    return res.status(429).json({ error:"Too many response requests. Please wait and try again." });
  }

  const { data: attempt } = await supabase
    .from("quiz_attempts")
    .select("id,completed_at")
    .eq("id", attempt_id)
    .eq("session_id", session_id)
    .maybeSingle();

  if (!attempt || attempt.completed_at) return res.status(400).json({ error:"Attempt not found or already completed" });

  const { data: question, error:questionError } = await supabase
    .from("generated_questions")
    .select("*")
    .eq("id", question_id)
    .eq("session_id", session_id)
    .maybeSingle();

  if (questionError || !question) return res.status(400).json({ error:"Question not found" });

  const chosen = selected_answer === null || selected_answer === undefined ? null : Number(selected_answer);
  const timedOut = Boolean(timed_out);
  const correct = !timedOut && chosen !== null && chosen === question.correct_answer;

  const { data: existing } = await supabase
    .from("quiz_responses")
    .select("id")
    .eq("attempt_id", attempt_id)
    .eq("question_id", question_id)
    .maybeSingle();

  if (existing) return res.status(409).json({ error:"This response is already locked" });

  const payload = {
    attempt_id,
    session_id,
    question_id,
    section: question.section,
    difficulty: question.difficulty,
    selected_answer: chosen,
    correct_answer: question.correct_answer,
    is_correct: correct,
    timed_out: timedOut,
    response_seconds: Number(response_seconds || 0),
    answered_at: new Date().toISOString(),
    question_text: question.question_text,
    answer_options: question.answer_options
  };

  const { error } = await supabase.from("quiz_responses").insert(payload);

  if (error?.code === "23505") {
    return res.status(409).json({ error:"This response is already locked" });
  }
  if (error) return res.status(400).json({ error:error.message });
  res.status(200).json({
    ok:true,
    correct,
    correct_answer:question.correct_answer,
    explanation:question.explanation,
    difficulty_weight:difficultyWeight(question.difficulty)
  });
});

app.post("/api/writing-responses", async (req,res) => {
  if (!supabase) return res.status(503).json({ error:"Supabase is not configured" });
  const { attempt_id, session_id, task_id, response_text } = req.body || {};
  if (!validUuid(session_id) || !attempt_id || !task_id || !verifyAssessmentToken(req, session_id)) {
    return res.status(401).json({ error:"Assessment access required" });
  }
  if (!rateLimit("assessment-writing:" + session_id, 20, 4 * 60 * 60 * 1000)) {
    return res.status(429).json({ error:"Too many writing submissions." });
  }
  const text = String(response_text || "").trim();
  if (!text || text.length > 20000) return res.status(400).json({ error:"Writing response is empty or too long" });
  if (!getWritingTasks().some(task => task.id === task_id)) {
    return res.status(400).json({ error:"Invalid writing task" });
  }

  const { data: attempt } = await supabase
    .from("quiz_attempts")
    .select("id,completed_at")
    .eq("id",attempt_id)
    .eq("session_id",session_id)
    .maybeSingle();
  if (!attempt || attempt.completed_at) return res.status(400).json({ error:"Attempt not found or already completed" });

  const { data: existing } = await supabase
    .from("quiz_writing_responses")
    .select("id")
    .eq("attempt_id",attempt_id)
    .eq("task_id",task_id)
    .maybeSingle();
  if (existing) return res.status(409).json({ error:"This writing response is already locked" });

  const { error } = await supabase.from("quiz_writing_responses").insert({
    attempt_id,session_id,task_id,response_text:text,submitted_at:new Date().toISOString()
  });
  if (error) return res.status(400).json({ error:error.message });
  res.json({ ok:true });
});

app.patch("/api/attempts/:id", async (req,res) => {
  if (!supabase) return res.status(503).json({ error:"Supabase is not configured" });
  const { session_id } = req.body || {};
  if (!validUuid(session_id) || !verifyAssessmentToken(req, session_id)) {
    return res.status(401).json({ error:"Assessment access required" });
  }
  if (!rateLimit("assessment-finish:" + session_id, 10, 60 * 60 * 1000)) {
    return res.status(429).json({ error:"Too many assessment requests. Please wait and try again." });
  }

  const { data: attempt, error: attemptError } = await supabase
    .from("quiz_attempts")
    .select("id,session_id")
    .eq("id", req.params.id)
    .eq("session_id", session_id)
    .maybeSingle();

  if (attemptError) return res.status(400).json({ error:attemptError.message });
  if (!attempt) return res.status(404).json({ error:"Attempt not found" });

  const { data: responseRows, error: responseError } = await supabase
    .from("quiz_responses")
    .select("is_correct,timed_out,response_seconds,difficulty")
    .eq("attempt_id", req.params.id);

  if (responseError) return res.status(400).json({ error:responseError.message });

  let correctCount = 0;
  let wrongCount = 0;
  let timeoutCount = 0;
  let totalResponseSeconds = 0;

  for (const row of responseRows || []) {
    if (row.timed_out) timeoutCount += 1;
    else if (row.is_correct) correctCount += 1;
    else wrongCount += 1;
    totalResponseSeconds += Number(row.response_seconds || 0);
  }

  const answeredCount = correctCount + wrongCount + timeoutCount;
  const weightedScore = calculateWeightedScore(responseRows || []);
  const score = weightedScore.score;
  const averageResponseSeconds = answeredCount
    ? Number((totalResponseSeconds / answeredCount).toFixed(3))
    : 0;

  const patch = {
    completed_at: new Date().toISOString(),
    score,
    correct_count: correctCount,
    wrong_count: wrongCount,
    timeout_count: timeoutCount,
    average_response_seconds: averageResponseSeconds
  };

  const { error } = await supabase
    .from("quiz_attempts")
    .update(patch)
    .eq("id", req.params.id)
    .eq("session_id", session_id);

  if (error) return res.status(400).json({ error:error.message });

  res.json({ ok:true, score, correct_count:correctCount, wrong_count:wrongCount, timeout_count:timeoutCount, average_response_seconds:averageResponseSeconds });
});


// Written Expression topic administration.
app.get("/api/admin/writing-topics", requireAdmin, async (req,res) => {
  if (!supabase) return res.status(503).json({ error:"Supabase is not configured" });

  const { data, error } = await supabase
    .from("writing_topics")
    .select("id,task_slot,topic,active,created_at,updated_at")
    .in("task_slot",[1,2])
    .order("task_slot",{ascending:true})
    .order("created_at",{ascending:true});

  if (error) return res.status(400).json({ error:error.message });
  res.json({ topics:data||[] });
});

app.post("/api/admin/writing-topics", requireAdmin, async (req,res) => {
  if (!supabase) return res.status(503).json({ error:"Supabase is not configured" });

  const taskSlot=Number(req.body?.task_slot);
  const topic=String(req.body?.topic||"").trim();
  if (![1,2].includes(taskSlot)) return res.status(400).json({ error:"Invalid Written Expression task" });
  if (!topic || topic.length>2000) return res.status(400).json({ error:"Topic is required and must be 2000 characters or fewer" });

  const id="WT-"+taskSlot+"-"+crypto.randomUUID();
  const row={id,task_slot:taskSlot,topic,active:true};
  const { error }=await supabase.from("writing_topics").insert(row);
  if(error) return res.status(400).json({ error:error.message });
  res.status(201).json({ ok:true,topic:row });
});

app.put("/api/admin/writing-topics/:id", requireAdmin, async (req,res) => {
  if (!supabase) return res.status(503).json({ error:"Supabase is not configured" });

  const id=String(req.params.id||"").trim();
  const topic=String(req.body?.topic||"").trim();
  if(!id) return res.status(400).json({ error:"Topic id is required" });
  if(!topic || topic.length>2000) return res.status(400).json({ error:"Topic is required and must be 2000 characters or fewer" });

  const { data: existing, error:lookupError }=await supabase
    .from("writing_topics")
    .select("id,task_slot")
    .eq("id",id)
    .maybeSingle();

  if(lookupError) return res.status(400).json({ error:lookupError.message });
  if(!existing) return res.status(404).json({ error:"Writing topic not found" });

  const { error }=await supabase
    .from("writing_topics")
    .update({topic,updated_at:new Date().toISOString()})
    .eq("id",id);

  if(error) return res.status(400).json({ error:error.message });
  res.json({ ok:true,id });
});

app.delete("/api/admin/writing-topics/:id", requireAdmin, async (req,res) => {
  if (!supabase) return res.status(503).json({ error:"Supabase is not configured" });

  const id=String(req.params.id||"").trim();
  const { data: existing, error:lookupError }=await supabase
    .from("writing_topics")
    .select("id,task_slot")
    .eq("id",id)
    .maybeSingle();

  if(lookupError) return res.status(400).json({ error:lookupError.message });
  if(!existing) return res.status(404).json({ error:"Writing topic not found" });

  const { count, error:countError }=await supabase
    .from("writing_topics")
    .select("id",{count:"exact",head:true})
    .eq("task_slot",existing.task_slot)
    .eq("active",true);

  if(countError) return res.status(400).json({ error:countError.message });
  if(Number(count)<=1) return res.status(409).json({ error:"Keep at least one active topic for this Written Expression task." });

  const { error }=await supabase
    .from("writing_topics")
    .delete()
    .eq("id",id);

  if(error) return res.status(400).json({ error:error.message });
  res.json({ ok:true,id });
});

// Question-bank administration.
const ADMIN_BANK_SECTIONS = new Set(["humanities","mathematics_science"]);

function normalizeQuestionBankPayload(body, fallback = {}) {
  const section = String(body?.section ?? fallback.section ?? "").trim();
  const subject = String(body?.subject ?? fallback.subject ?? (section === "humanities" ? "humanities" : section)).trim();
  const questionText = String(body?.question_text ?? fallback.question_text ?? "").trim();
  const passage = String(body?.passage ?? fallback.passage ?? "").trim();
  const stimulusGroup = String(body?.stimulus_group ?? fallback.stimulus_group ?? "").trim();
  const stimulusImage = String(body?.stimulus_image ?? fallback.stimulus_image ?? "").trim();
  const explanation = String(body?.explanation ?? fallback.explanation ?? "").trim();
  const difficulty = String(body?.difficulty ?? fallback.difficulty ?? "medium").trim().toLowerCase();
  const time = Number(body?.time ?? fallback.time ?? 60);
  const options = Array.isArray(body?.answer_options)
    ? body.answer_options.map(value => String(value ?? "").trim())
    : Array.isArray(fallback.answer_options)
      ? fallback.answer_options.map(value => String(value ?? "").trim())
      : [];
  const correctAnswer = Number(body?.correct_answer ?? fallback.correct_answer);

  if (!ADMIN_BANK_SECTIONS.has(section)) throw new Error("Invalid question-bank section");
  if (!["humanities","mathematics_science","mathematics","science"].includes(subject)) {
    throw new Error("Invalid question subject");
  }
  if (!questionText || questionText.length > 12000) throw new Error("Question text is required and must be 12000 characters or fewer");
  if (!stimulusGroup || stimulusGroup.length > 200) throw new Error("Stimulus group is required");
  if (options.length !== 4 || options.some(value => !value) || new Set(options.map(value => value.toLowerCase())).size !== 4) {
    throw new Error("Exactly 4 unique answer options are required");
  }
  if (!Number.isInteger(correctAnswer) || correctAnswer < 0 || correctAnswer > 3) {
    throw new Error("Correct answer must be A, B, C or D");
  }
  if (!Number.isFinite(time) || time < 10 || time > 600) {
    throw new Error("Time must be between 10 and 600 seconds");
  }
  if (!["easy","medium","hard"].includes(difficulty)) {
    throw new Error("Difficulty must be easy, medium or hard");
  }
  if (passage.length > 30000 || explanation.length > 10000 || stimulusImage.length > 2000) {
    throw new Error("Stimulus or explanation is too long");
  }

  return {
    section,
    subject,
    question_text: questionText,
    passage,
    stimulus_group: stimulusGroup,
    stimulus_image: stimulusImage || null,
    explanation,
    difficulty,
    time: Math.round(time),
    answer_options: options,
    correct_answer: correctAnswer
  };
}

app.get("/api/admin/question-bank", requireAdmin, async (req,res) => {
  if (!supabase) return res.status(503).json({ error:"Supabase is not configured" });
  const section = String(req.query.section || "").trim();
  if (!ADMIN_BANK_SECTIONS.has(section)) return res.status(400).json({ error:"Invalid question-bank section" });

  const { data, error } = await supabase
    .from("generated_questions")
    .select("id,year_level,section,subject,difficulty,time,question_text,answer_options,correct_answer,explanation,passage,stimulus_group,stimulus_image,is_bank,session_id,created_at")
    .eq("year_level","10")
    .eq("section",section)
    .eq("is_bank",true)
    .order("stimulus_group",{ascending:true})
    .order("id",{ascending:true});

  if (error) return res.status(400).json({ error:error.message });

  const activeCount = (data || []).filter(row => row.session_id).length;
  res.json({ section, questions:data || [], count:(data || []).length, active_count:activeCount });
});

app.put("/api/admin/question-bank/group", requireAdmin, async (req,res) => {
  if (!supabase) return res.status(503).json({ error:"Supabase is not configured" });
  const section = String(req.body?.section || "").trim();
  const stimulusGroup = String(req.body?.stimulus_group || "").trim();
  const passage = String(req.body?.passage || "").trim();
  const stimulusImage = String(req.body?.stimulus_image || "").trim();
  if (!ADMIN_BANK_SECTIONS.has(section) || !stimulusGroup) return res.status(400).json({ error:"Section and stimulus group are required" });
  if (passage.length > 30000 || stimulusImage.length > 2000) return res.status(400).json({ error:"Stimulus is too long" });

  const { data: rows, error: lookupError } = await supabase
    .from("generated_questions")
    .select("id,session_id")
    .eq("year_level","10")
    .eq("section",section)
    .eq("stimulus_group",stimulusGroup)
    .eq("is_bank",true);

  if (lookupError) return res.status(400).json({ error:lookupError.message });
  if (!(rows || []).length) return res.status(404).json({ error:"Stimulus group not found" });
  if ((rows || []).some(row => row.session_id)) {
    return res.status(409).json({ error:"This stimulus is currently assigned to an active assessment. It can be edited after that assessment is released." });
  }

  const { error } = await supabase
    .from("generated_questions")
    .update({ passage, stimulus_image: stimulusImage || null })
    .eq("year_level","10")
    .eq("section",section)
    .eq("stimulus_group",stimulusGroup)
    .eq("is_bank",true)
    .is("session_id",null);

  if (error) return res.status(400).json({ error:error.message });
  res.json({ ok:true });
});

app.put("/api/admin/question-bank/:id", requireAdmin, async (req,res) => {
  if (!supabase) return res.status(503).json({ error:"Supabase is not configured" });
  const id = String(req.params.id || "").trim();
  if (!id) return res.status(400).json({ error:"Question id is required" });

  const { data: existing, error: lookupError } = await supabase
    .from("generated_questions")
    .select("*")
    .eq("id",id)
    .eq("year_level","10")
    .eq("is_bank",true)
    .maybeSingle();

  if (lookupError) return res.status(400).json({ error:lookupError.message });
  if (!existing) return res.status(404).json({ error:"Question not found in the question bank" });
  if (existing.session_id) return res.status(409).json({ error:"This question is currently assigned to an active assessment. It can be edited after that assessment is released." });

  let payload;
  try {
    payload = normalizeQuestionBankPayload(req.body, existing);
  } catch (error) {
    return res.status(400).json({ error:error.message });
  }

  const { error } = await supabase
    .from("generated_questions")
    .update(payload)
    .eq("id",id)
    .eq("year_level","10")
    .eq("is_bank",true)
    .is("session_id",null);

  if (error) return res.status(400).json({ error:error.message });
  res.json({ ok:true, id });
});

app.post("/api/admin/question-bank", requireAdmin, async (req,res) => {
  if (!supabase) return res.status(503).json({ error:"Supabase is not configured" });

  let payload;
  try {
    payload = normalizeQuestionBankPayload(req.body);
  } catch (error) {
    return res.status(400).json({ error:error.message });
  }

  let passage = payload.passage;
  let stimulusImage = payload.stimulus_image;
  if (!passage || !stimulusImage) {
    const { data: sibling, error: siblingError } = await supabase
      .from("generated_questions")
      .select("passage,stimulus_image")
      .eq("year_level","10")
      .eq("section",payload.section)
      .eq("stimulus_group",payload.stimulus_group)
      .eq("is_bank",true)
      .order("id",{ascending:true})
      .limit(1)
      .maybeSingle();
    if (siblingError) return res.status(400).json({ error:siblingError.message });
    if (sibling) {
      if (!passage) passage = sibling.passage || "";
      if (!stimulusImage) stimulusImage = sibling.stimulus_image || "";
    }
  }

  const id = "QB-" + (payload.section === "humanities" ? "HUM" : "MS") + "-" + crypto.randomUUID();
  const row = {
    id,
    session_id:null,
    ip_hash:crypto.createHash("sha256").update("admin-question-bank|" + id).digest("hex"),
    year_level:"10",
    section:payload.section,
    subject:payload.subject,
    difficulty:payload.difficulty,
    time:payload.time,
    question_text:payload.question_text,
    answer_options:payload.answer_options,
    correct_answer:payload.correct_answer,
    explanation:payload.explanation,
    passage,
    stimulus_group:payload.stimulus_group,
    stimulus_image:stimulusImage || null,
    is_bank:true
  };

  const { error } = await supabase.from("generated_questions").insert(row);
  if (error) return res.status(400).json({ error:error.message });
  res.status(201).json({ ok:true, question:row });
});

app.get("/admin", (req,res) => res.sendFile(path.join(publicDir,"admin.html")));
app.get("/admin/responses", (req,res) => res.sendFile(path.join(publicDir,"admin-responses.html")));
app.get("/", (req,res) => res.sendFile(path.join(studentDir,"index.html")));
app.use((req,res) => {
  if (req.path.startsWith("/api/")) return res.status(404).json({ error:"Not found" });
  res.sendFile(path.join(studentDir,"index.html"));
});

const port = process.env.PORT || 10000;
app.listen(port, () => console.log("Quiz app listening on " + port));