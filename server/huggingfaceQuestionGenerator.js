const DEFAULT_MODEL = "openrouter/free";
const API_URL = "https://openrouter.ai/api/v1/chat/completions";

function fail(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalise(value, limit = 4000) {
  return String(value ?? "").normalize("NFKC").trim().replace(/\s+/g, " ").slice(0, limit);
}

function normaliseStimulus(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map(line => line.trim())
    .filter((line, index, lines) => line || (index > 0 && lines[index - 1]))
    .join("\n")
    .trim()
    .slice(0, 12000);
}

function extractJson(content) {
  const raw = Array.isArray(content)
    ? content.map(part => typeof part === "string" ? part : part && part.text || "").join("\n")
    : String(content || "");
  const cleaned = raw.trim().replace(/^\x60{3}(?:json)?\s*/i, "").replace(/\s*\x60{3}$/, "");
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first < 0 || last <= first) throw fail("OpenRouter returned no JSON question data.", 502);
  try {
    return JSON.parse(cleaned.slice(first, last + 1));
  } catch {
    throw fail("OpenRouter returned malformed JSON. No questions were saved.", 502);
  }
}

function answerIndex(value) {
  if (Number.isInteger(value) && value >= 0 && value <= 3) return value;
  if (typeof value === "string" && /^[A-D]$/i.test(value.trim())) return value.trim().toUpperCase().charCodeAt(0) - 65;
  return -1;
}

function validatePages(document, section, pageCount) {
  const perPage = section === "humanities" ? 5 : 4;
  const pages = Array.isArray(document && document.pages) ? document.pages : [];
  if (pages.length !== pageCount) throw fail("The model did not return the requested number of pages. No questions were saved.", 502);

  return pages.map((page, pageIndex) => {
    const stimulus = normaliseStimulus(page && page.stimulus);
    const sourceQuestions = Array.isArray(page && page.questions) ? page.questions : [];
    if (stimulus.length < 80) throw fail("Generated page " + (pageIndex + 1) + " has an incomplete stimulus. No questions were saved.", 502);
    if (sourceQuestions.length !== perPage) throw fail("Each " + section.replace("_", " ") + " page must contain exactly " + perPage + " questions. No questions were saved.", 502);

    const questions = sourceQuestions.map((item, questionIndex) => {
      const questionText = normalise(item && item.question_text, 1500);
      const options = Array.isArray(item && item.answer_options) ? item.answer_options.map(option => normalise(option, 700)) : [];
      const answer = answerIndex(item && item.correct_answer);
      const explanation = normalise(item && item.explanation, 3000);
      const difficulty = normalise(item && item.difficulty, 20).toLowerCase();
      const seconds = Number(item && item.time);
      if (!questionText || questionText.length < 12) throw fail("A generated question has incomplete wording.", 502);
      if (options.length !== 4 || options.some(option => !option) || new Set(options.map(option => option.toLowerCase())).size !== 4) {
        throw fail("A generated question does not have four unique answer choices.", 502);
      }
      if (answer < 0) throw fail("A generated question has an invalid correct-answer index.", 502);
      if (!explanation || !["easy", "medium", "hard"].includes(difficulty)) throw fail("A question is missing its explanation or difficulty.", 502);
      return {
        question_text: questionText,
        answer_options: options,
        correct_answer: answer,
        explanation,
        difficulty,
        time: Number.isFinite(seconds) ? Math.max(30, Math.min(180, Math.round(seconds))) : difficulty === "hard" ? 75 : 60
      };
    });
    return { stimulus, questions };
  });
}

function makePrompt(section, pageCount, avoidStems) {
  const humanities = section === "humanities";
  const perPage = humanities ? 5 : 4;
  const description = humanities
    ? "Humanities comprehension and interpretation: viewpoint, inference, purpose, tone, comparison, evidence quality, conclusions, and interpreting original written sources or compact data displays."
    : "Mathematics and Science reasoning: multi-step quantitative reasoning, interpreting tables, proportional reasoning, probability, measurement, scientific investigations, variables, evidence, and best-supported conclusions.";

  return {
    system: [
      "You author original scholarship-style practice questions for Year 10 entry.",
      "Never copy or closely imitate existing published questions, passages, datasets, charts, or answer choices.",
      "Do not mention test publishers, trademarks, or affiliations.",
      "Solve every question carefully; exactly one option must be correct, and the answer key must agree with the explanation.",
      "Return only valid JSON, with no Markdown fences or commentary."
    ].join(" "),
    user: {
      task: "Generate " + pageCount + " new " + (humanities ? "Humanities" : "Mathematics and Science") + " stimulus pages.",
      description,
      page_rules: [
        "Every page has one shared stimulus used by all its questions.",
        "The stimulus contains all information required; no external knowledge is required.",
        "Use varied, unfamiliar contexts and reasoning rather than repeated arithmetic templates.",
        "Stimuli may be original short reports, source excerpts, compact plain-text tables, data displays, or descriptions of investigations.",
        "Include all values, units and conditions in the stimulus. No image is required.",
        "Do not reuse a context across pages in this batch."
      ],
      question_rules: [
        "Each page contains exactly " + perPage + " questions.",
        "Every question has exactly four distinct non-empty answer choices.",
        "Use medium and hard items, with difficulty labelled independently based on reasoning demand, not position on the page.",
        "At least two questions per page require interpretation, inference, or multiple reasoning steps.",
        "correct_answer is an integer from 0 to 3, indexing answer_options.",
        "Include difficulty (easy, medium, hard), estimated time in seconds, and a concise explanation.",
        "Avoid these recently-used stems: " + JSON.stringify((avoidStems || []).slice(0, 40))
      ],
      output_schema: {
        pages: [{
          stimulus: "string",
          questions: [{
            question_text: "string",
            answer_options: ["option A", "option B", "option C", "option D"],
            correct_answer: 0,
            explanation: "string",
            difficulty: "medium",
            time: 60
          }]
        }]
      }
    }
  };
}

async function generateQuestionPages({ section, pageCount = 1, avoidStems = [] } = {}) {
  if (!["humanities", "mathematics_science"].includes(section)) throw fail("Choose Humanities or Mathematics & Science.");
  const count = Number(pageCount);
  if (!Number.isInteger(count) || count < 1 || count > 5) throw fail("Choose between 1 and 5 pages.");

  const token = process.env.OPENROUTER_API_KEY;
  if (!token) throw fail("OpenRouter is not configured. Add OPENROUTER_API_KEY to the Render service environment.", 503);
  const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
  const prompt = makePrompt(section, count, avoidStems);
  let response;
  try {
    response = await fetch(API_URL, {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json", "HTTP-Referer": "https://quiz-tv23.onrender.com", "X-Title": "Academic Test Question Bank" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: prompt.system },
          { role: "user", content: JSON.stringify(prompt.user) }
        ],
        temperature: 0.45,
        max_tokens: Math.min(12000, count * 2400),
        stream: false
      }),
      signal: AbortSignal.timeout(120000)
    });
  } catch (error) {
    throw fail(error && (error.name === "TimeoutError" || error.name === "AbortError")
      ? "OpenRouter took too long. Try generating fewer pages."
      : "Could not reach OpenRouter. Please try again.", 502);
  }

  const raw = await response.text();
  let payload = {};
  try { payload = raw ? JSON.parse(raw) : {}; } catch {}
  if (!response.ok) {
    const detail = normalise(payload && (payload.error && payload.error.message || payload.error || payload.message) || "", 300);
    const status = response.status === 401 || response.status === 403 ? 503 : 502;
    throw fail("OpenRouter request failed (" + response.status + ")" + (detail ? ": " + detail : ". Check OPENROUTER_API_KEY and model availability."), status);
  }
  const content = payload && payload.choices && payload.choices[0] && payload.choices[0].message && payload.choices[0].message.content;
  if (!content) throw fail("OpenRouter returned an empty response. No questions were saved.", 502);
  return { model, pages: validatePages(extractJson(content), section, count) };
}

module.exports = { generateQuestionPages, validatePages, extractJson, DEFAULT_MODEL };
