const express = require("express");
const path = require("path");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const publicDir = path.join(__dirname, "public");
const studentDir = path.join(publicDir, "student");

app.use(express.json({ limit: "100kb" }));
app.use(express.static(publicDir, { index: false }));

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;
const cookieName = "quiz_admin";

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
    const pair = pick([["brief","concise"],["rapid","swift"],["accurate","precise"],["cautious","careful"],["observe","notice"]]);
    const result = withAnswer(pair[1],["noisy","ancient","fragile","distant"]);
    return { section:"verbal", difficulty:"medium", time:50, question_text:"Which word is closest in meaning to '" + pair[0] + "'?", answer_options:result.options, correct_answer:result.index, explanation:"'" + pair[1] + "' is the closest synonym." };
  }

  if (type === 1) {
    const pair = pick([["reluctant","eager"],["ancient","modern"],["scarce","abundant"],["temporary","permanent"],["expand","contract"]]);
    const result = withAnswer(pair[1],[pair[0],"fragile","curious","silent"]);
    return { section:"verbal", difficulty:"medium", time:50, question_text:"Which word is most nearly opposite in meaning to '" + pair[0] + "'?", answer_options:result.options, correct_answer:result.index, explanation:"'" + pair[1] + "' is the closest antonym." };
  }

  if (type === 2) {
    const pair = pick([["SCULPTOR","STATUE","CARTOGRAPHER","MAP"],["AUTHOR","BOOK","COMPOSER","MUSIC"],["ARCHITECT","BUILDING","CHEF","MEAL"],["PAINTER","PORTRAIT","PHOTOGRAPHER","PHOTO"]]);
    const result = withAnswer(pair[3],[pair[2],"journey","tool","theatre"]);
    return { section:"verbal", difficulty:"hard", time:55, question_text:pair[0]+" is to "+pair[1]+" as "+pair[2]+" is to:", answer_options:result.options, correct_answer:result.index, explanation:"The first pair shows a creator and what that creator produces." };
  }

  if (type === 3) {
    const group = pick([["generous","charitable","benevolent","selfish"],["rapid","swift","brisk","sluggish"],["fragile","delicate","breakable","durable"],["silent","quiet","soundless","noisy"]]);
    const result = withAnswer(group[3],group.slice(0,3));
    return { section:"verbal", difficulty:"medium", time:50, question_text:"Which word is the odd one out?", answer_options:result.options, correct_answer:result.index, explanation:"The other words share a closer meaning or characteristic." };
  }

  if (type === 4) {
    const code = pick([["nems","tavs","lorps"],["daxs","mivs","sorns"],["pels","rins","vorts"]]);
    return { section:"verbal", difficulty:"hard", time:60, question_text:"If all "+code[0]+" are "+code[1]+" and no "+code[1]+" are "+code[2]+", which statement must be true?", answer_options:["No "+code[0]+" are "+code[2],"All "+code[2]+" are "+code[0],"Some "+code[1]+" are "+code[2],"All "+code[0]+" are "+code[2],"No "+code[0]+" exist"], correct_answer:0, explanation:"Anything that is a "+code[0]+" must be a "+code[1]+", and no "+code[1]+" can be a "+code[2]+"." };
  }

  const context = pick([
    ["The engineer remained ___ when the first model failed.","composed"],
    ["The witness gave a ___ account of the events, avoiding unnecessary detail.","succinct"],
    ["The student made a ___ decision after considering the evidence carefully.","prudent"],
    ["The explanation was ___ enough to be accepted by the panel.","plausible"]
  ]);
  const result = withAnswer(context[1],["reckless","fragile","hostile","lengthy"]);
  return { section:"verbal", difficulty:"medium", time:50, question_text:context[0], answer_options:result.options, correct_answer:result.index, explanation:"The context requires the word '"+context[1]+"'." };
}

function makeReadingQuestion() {
  const items = [
    ["Nadia compared two maps of her town. The newer map showed a footbridge that did not appear on the older map. She became curious about when the bridge had been built.","What prompted Nadia's curiosity?","The bridge appeared only on the newer map.",["The maps were identical.","The town had moved.","She lost one map.","The bridge was closed."]],
    ["The school garden began as a bare patch beside the library. Students planted herbs and native flowers. Months later, bees returned and the science teacher began using the garden during lessons.","What is the main idea?","Students transformed an unused area into a useful garden.",["The library was moved.","Bees damaged the garden.","The science teacher stopped teaching.","The garden was removed."]],
    ["When the microphone failed during Leo's presentation, he moved closer to the audience and continued. His voice became steadier as he went on.","What can be inferred about Leo?","He adapted when something unexpected went wrong.",["He had forgotten the topic.","He refused to continue.","He was not prepared.","He left the room."]],
    ["A council planned to remove several trees to widen a road. After examining traffic data, it changed the design so that fewer trees were removed.","Why did the council change the plan?","New evidence influenced the decision.",["The road was cancelled.","The residents left town.","The trees had already fallen.","The weather became colder."]],
    ["Mia kept a notebook beside her bed. Whenever an idea came to her, she wrote it down. Months later, she used several notes while planning a project.","What was the main benefit of the notebook?","It helped Mia preserve ideas for later use.",["It helped her sleep.","It replaced her textbooks.","It made her work faster.","It stopped her having ideas."]],
    ["The ranger noticed small tracks crossing a quiet beach. She placed signs asking visitors to keep away from the dunes.","What was the most likely purpose of the signs?","To protect an area where wildlife was active.",["To advertise the beach.","To show the shortest route.","To stop the tide.","To direct visitors to the dunes."]],
    ["At first, the museum staff thought a faint mark on a painting was damage. Under different lighting, they noticed a repeated pattern beneath the surface.","What caused the staff to reconsider their first explanation?","The pattern suggested the mark was intentional.",["The frame was replaced.","The painting was sold.","Visitors complained.","The room became darker."]],
    ["A student team tested a bridge design three times. Each version failed at a different joint. They recorded the results and changed only the weak section before testing again.","What approach did the team take?","They used evidence from each test to refine the design.",["They copied another team's bridge.","They stopped testing.","They ignored the failures.","They changed every part at once."]]
  ];
  const item = pick(items), result = withAnswer(item[2],item[3]);
  return { section:"reading", difficulty:pick(["medium","hard"]), time:80, passage:item[0], question_text:item[1], answer_options:result.options, correct_answer:result.index, explanation:"The passage provides the evidence needed to choose the best answer." };
}

function makeQuestion(section) {
  if (section === "maths") return makeMathQuestion();
  if (section === "numerical") return makeNumericalQuestion();
  if (section === "verbal") return makeVerbalQuestion();
  return makeReadingQuestion();
}

async function generateQuestions(req, sessionId, count) {
  if (!supabase) return [];
  const hash = ipHash(req);

  const { data: usedRows } = await supabase
    .from("generated_questions")
    .select("id")
    .eq("ip_hash", hash);

  const usedIds = new Set((usedRows || []).map(row => row.id));
  const sections = shuffle(["maths","numerical","verbal","reading"]);
  const questions = [];
  let attempts = 0;

  while (questions.length < count && attempts < count * 40) {
    attempts += 1;
    const section = sections[questions.length % sections.length];
    const question = makeQuestion(section);
    question.year_level = "9";
    question.session_id = sessionId;
    question.ip_hash = hash;
    question.id = generatedId(question);

    if (usedIds.has(question.id) || questions.some(item => item.id === question.id)) continue;

    const { error } = await supabase.from("generated_questions").insert({
      id: question.id,
      session_id: question.session_id,
      ip_hash: question.ip_hash,
      year_level: "9",
      section: question.section,
      difficulty: question.difficulty,
      time: question.time,
      question_text: question.question_text,
      passage: question.passage || null,
      answer_options: question.answer_options,
      correct_answer: question.correct_answer,
      explanation: question.explanation
    });

    if (error) continue;
    questions.push(question);
    usedIds.add(question.id);
  }

  return questions;
}

app.get("/health", (req, res) => res.json({ ok: true, supabaseConfigured: Boolean(supabase) }));

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

app.get("/api/admin/attempts", requireAdmin, async (req,res) => {
  if (!supabase) return res.status(503).json({ error:"Supabase is not configured" });
  const { data, error } = await supabase.from("quiz_attempts").select("*").order("started_at",{ascending:false}).limit(500);
  if (error) return res.status(400).json({ error:error.message });
  res.json({ attempts:data || [] });
});

app.get("/api/admin/attempts/:id/responses", requireAdmin, async (req,res) => {
  if (!supabase) return res.status(503).json({ error:"Supabase is not configured" });
  const { data, error } = await supabase.from("quiz_responses").select("*").eq("attempt_id",req.params.id).order("answered_at",{ascending:true});
  if (error) return res.status(400).json({ error:error.message });
  res.json({ responses:data || [] });
});

app.get("/api/questions", async (req,res) => {
  try {
    const year = Number(req.query.year);
    const sessionId = String(req.query.session_id || "");

    if (year !== 9) return res.status(400).json({ error:"Only Year 9 is available" });
    if (!validUuid(sessionId)) return res.status(400).json({ error:"Valid session_id is required" });

    const questions = await generateQuestions(req, sessionId, 20);
    if (questions.length !== 20) return res.status(503).json({ error:"Could not generate enough fresh questions" });

    res.json({ questions: questions.map(q => ({
      id:q.id, section:q.section, difficulty:q.difficulty, time:q.time,
      q:q.question_text, o:q.answer_options, passage:q.passage || ""
    })) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error:"Question generation failed" });
  }
});

app.post("/api/attempts", async (req,res) => {
  if (!supabase) return res.status(503).json({ error:"Supabase is not configured" });
  const { session_id, session_name, year_level, section, difficulty, question_count } = req.body || {};

  if (!validUuid(session_id)) return res.status(400).json({ error:"Valid session_id is required" });
  if (String(year_level) !== "9") return res.status(400).json({ error:"Only Year 9 is available" });

  const { data, error } = await supabase.from("quiz_attempts").insert({
    session_id,
    session_name,
    year_level:"9",
    section:section || "mixed",
    difficulty:difficulty || "all",
    question_count:question_count || 20
  }).select("id").single();

  if (error) return res.status(400).json({ error:error.message });
  res.json({ id:data.id });
});

app.post("/api/responses", async (req,res) => {
  if (!supabase) return res.status(503).json({ error:"Supabase is not configured" });
  const { attempt_id, session_id, question_id, selected_answer, timed_out, response_seconds } = req.body || {};

  if (!validUuid(session_id) || !attempt_id || !question_id) return res.status(400).json({ error:"Invalid response data" });

  const { data: attempt } = await supabase.from("quiz_attempts").select("id").eq("id",attempt_id).eq("session_id",session_id).maybeSingle();
  if (!attempt) return res.status(400).json({ error:"Attempt not found" });

  const { data: question, error:questionError } = await supabase
    .from("generated_questions")
    .select("*")
    .eq("id",question_id)
    .eq("session_id",session_id)
    .eq("ip_hash",ipHash(req))
    .maybeSingle();

  if (questionError || !question) return res.status(400).json({ error:"Question not found" });

  const correct = !timed_out && Number(selected_answer) === question.correct_answer;
  const { error } = await supabase.from("quiz_responses").insert({
    attempt_id, session_id, question_id, section:question.section, difficulty:question.difficulty,
    selected_answer:selected_answer ?? null, correct_answer:question.correct_answer, is_correct:correct,
    timed_out:Boolean(timed_out), response_seconds:Number(response_seconds || 0),
    question_text:question.question_text, answer_options:question.answer_options
  });

  if (error) return res.status(400).json({ error:error.message });
  res.status(201).json({ ok:true, correct, correct_answer:question.correct_answer, explanation:question.explanation });
});

app.patch("/api/attempts/:id", async (req,res) => {
  if (!supabase) return res.status(503).json({ error:"Supabase is not configured" });
  const { session_id } = req.body || {};
  if (!validUuid(session_id)) return res.status(400).json({ error:"Valid session_id is required" });

  const allowed = ["completed_at","score","correct_count","wrong_count","timeout_count","average_response_seconds"];
  const patch = {};
  for (const field of allowed) if (req.body[field] !== undefined) patch[field] = req.body[field];

  const { error } = await supabase.from("quiz_attempts").update(patch).eq("id",req.params.id).eq("session_id",session_id);
  if (error) return res.status(400).json({ error:error.message });
  res.json({ ok:true });
});

app.get("/admin", (req,res) => res.sendFile(path.join(publicDir,"admin.html")));
app.get("/", (req,res) => res.sendFile(path.join(studentDir,"index.html")));
app.get("*", (req,res) => {
  if (req.path.startsWith("/api/")) return res.status(404).json({ error:"Not found" });
  res.sendFile(path.join(studentDir,"index.html"));
});

const port = process.env.PORT || 10000;
app.listen(port, () => console.log("Quiz app listening on " + port));