const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");
const {
  humanitiesQuestion,
  mathematicsScienceQuestion,
  questionFingerprint
} = require("../server/year10Level2Generators");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
}

const supabase = createClient(supabaseUrl, supabaseKey);

const TARGETS = {
  humanities: 20,
  mathematics: 20,
  science: 20
};

function normaliseQuestion(question, section, id, batchKey) {
  const options = Array.isArray(question.answer_options)
    ? question.answer_options.map(value => String(value))
    : [];

  if (
    !question.question_text ||
    options.length !== 4 ||
    new Set(options.map(value => value.trim())).size !== 4 ||
    !Number.isInteger(Number(question.correct_answer)) ||
    Number(question.correct_answer) < 0 ||
    Number(question.correct_answer) > 3
  ) {
    return null;
  }

  return {
    id,
    session_id: null,
    ip_hash: crypto.createHash("sha256").update("question-pool|" + id).digest("hex"),
    year_level: "10",
    section,
    subject: section,
    difficulty: question.difficulty || "medium",
    time: Number(question.time) || 60,
    question_text: String(question.question_text),
    passage: question.passage || null,
    stimulus_group: question.stimulus_group || batchKey + "-" + id,
    stimulus_image: question.stimulus_image || null,
    answer_options: options,
    correct_answer: Number(question.correct_answer),
    explanation: question.explanation || "",
    is_bank: true
  };
}

async function loadExistingFingerprints() {
  const fingerprints = new Set();
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from("generated_questions")
      .select("section,question_text,passage")
      .eq("year_level", "10")
      .eq("is_bank", true)
      .range(from, from + pageSize - 1);

    if (error) throw error;

    for (const row of data || []) fingerprints.add(questionFingerprint(row));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }

  return fingerprints;
}

async function generateSection(section, count, existingFingerprints, batchKey) {
  const rows = [];
  const localFingerprints = new Set();
  let attempts = 0;
  const maxAttempts = count * 1000;

  while (rows.length < count && attempts < maxAttempts) {
    attempts += 1;

    const generated = section === "humanities"
      ? humanitiesQuestion()
      : mathematicsScienceQuestion();

    if (!generated) continue;

    let actualSection = section;
    if (section === "mathematics") {
      if (!String(generated.reasoning_type || "").startsWith("math:")) continue;
      actualSection = "mathematics";
    } else if (section === "science") {
      if (!String(generated.reasoning_type || "").startsWith("science:")) continue;
      actualSection = "science";
    }

    generated.section = actualSection;
    const fingerprint = questionFingerprint(generated);

    if (existingFingerprints.has(fingerprint) || localFingerprints.has(fingerprint)) continue;

    const idPrefix = actualSection === "humanities"
      ? "HUM-ACAM-D"
      : actualSection === "mathematics"
        ? "MAT-DYN"
        : "SCI-DYN";

    const id = idPrefix + "-" + batchKey + "-" + String(rows.length + 1).padStart(2, "0") + "-" + crypto.randomUUID();
    const row = normaliseQuestion(generated, actualSection, id, batchKey);

    if (!row) continue;

    rows.push(row);
    localFingerprints.add(fingerprint);
    existingFingerprints.add(fingerprint);
  }

  if (rows.length !== count) {
    throw new Error(
      "Could only generate " + rows.length + " unique " + section +
      " questions after " + attempts + " attempts; expected " + count
    );
  }

  return rows;
}

async function main() {
  const batchKey = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 12);
  const fingerprints = await loadExistingFingerprints();

  const allRows = [];
  for (const [section, count] of Object.entries(TARGETS)) {
    const rows = await generateSection(section, count, fingerprints, batchKey);
    allRows.push(...rows);
  }

  for (let i = 0; i < allRows.length; i += 25) {
    const { error } = await supabase
      .from("generated_questions")
      .insert(allRows.slice(i, i + 25));

    if (error) throw error;
  }

  const counts = allRows.reduce((result, row) => {
    result[row.section] = (result[row.section] || 0) + 1;
    return result;
  }, {});

  console.log(JSON.stringify({
    ok: true,
    batch: batchKey,
    generated: counts,
    total: allRows.length
  }));
}

main().catch(error => {
  console.error("Question pool generation failed:", error);
  process.exitCode = 1;
});
