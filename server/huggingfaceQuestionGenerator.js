const DEFAULT_MODEL = "google/gemma-4-31b-it:free";
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const XAI_API_URL = "https://api.x.ai/v1/chat/completions";
const DEFAULT_XAI_MODEL = "grok-3-mini";
const FALLBACK_MODELS = [
  "google/gemma-4-26b-a4b-it:free",
  "nvidia/nemotron-3-super-120b-a12b:free"
];

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
  if (first < 0 || last <= first) throw fail("AI provider returned no JSON question data.", 502);
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
        "Keep each stimulus concise: 120–180 words maximum, with only the facts needed to answer the questions.",
        "The stimulus contains all information required; no external knowledge is required.",
        "Use varied, unfamiliar contexts and reasoning rather than repeated arithmetic templates.",
        "Stimuli may be original short reports, source excerpts, compact plain-text tables, data displays, or descriptions of investigations.",
        "Include all values, units and conditions in the stimulus. No image is required. Keep tables compact.",
        "Do not reuse a context across pages in this batch."
      ],
      question_rules: [
        "Each page contains exactly " + perPage + " questions.",
        "Keep question wording concise (normally under 35 words), and keep each answer choice under 15 words.",
        "Every question has exactly four distinct non-empty answer choices.",
        "Keep each explanation to 1–2 concise sentences.",
        "Use medium and hard items, with difficulty labelled independently based on reasoning demand, not position on the page.",
        "At least two questions per page require interpretation, inference, or multiple reasoning steps. Be concise; do not add commentary outside the JSON.",
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

async function generateWithProvider({ section, pageCount = 1, avoidStems = [], provider = "openrouter", onTelemetry = () => {} } = {}) {
  if (!["humanities", "mathematics_science"].includes(section)) throw fail("Choose Humanities or Mathematics & Science.");
  const count = Number(pageCount);
  if (!Number.isInteger(count) || count < 1 || count > 5) throw fail("Choose between 1 and 5 pages.");

  const isGrok = provider === "grok";
  const token = isGrok ? process.env.XAI_API_KEY : process.env.OPENROUTER_API_KEY;
  if (!token) { onTelemetry({ provider, model: isGrok ? (process.env.XAI_MODEL || DEFAULT_XAI_MODEL) : (process.env.OPENROUTER_MODEL || DEFAULT_MODEL), event: "not_configured", configured: false, http_status: null, error: isGrok ? "XAI_API_KEY is not configured" : "OPENROUTER_API_KEY is not configured" }); throw fail(isGrok ? "Grok is not configured. Add XAI_API_KEY to the Render service environment." : "OpenRouter is not configured. Add OPENROUTER_API_KEY to the Render service environment.", 503); }
  const model = isGrok ? (process.env.XAI_MODEL || DEFAULT_XAI_MODEL) : (process.env.OPENROUTER_MODEL || DEFAULT_MODEL);
  const apiUrl = isGrok ? XAI_API_URL : OPENROUTER_API_URL;
  const prompt = makePrompt(section, count, avoidStems);\n  const requestStartedAt = Date.now();\n  const requestBody = {\n    ...(isGrok ? { model } : { models: [...new Set([model, ...FALLBACK_MODELS])] }),\n    messages: [\n      { role: "system", content: prompt.system },\n      { role: "user", content: JSON.stringify(prompt.user) }\n    ],\n    temperature: 0.35,\n    max_tokens: Math.min(12000, count * 8000),\n    ...(!isGrok ? { reasoning: { effort: "low", exclude: true } } : {}),\n    response_format: { type: "json_object" },\n    stream: false\n  };
  let response;
  try {
    response = await fetch(apiUrl, {
      method: "POST",
      headers: isGrok ? { Authorization: "Bearer " + token, "Content-Type": "application/json" } : { Authorization: "Bearer " + token, "Content-Type": "application/json", "HTTP-Referer": "https://quiz-tv23.onrender.com", "X-Title": "Academic Test Question Bank" },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(120000)
    });
  } catch (error) {
    const message = error && (error.name === "TimeoutError" || error.name === "AbortError")
      ? (isGrok ? "Grok took too long. Try generating fewer pages." : "OpenRouter took too long. Try generating fewer pages.")
      : (isGrok ? "Could not reach Grok. Please try again." : "Could not reach OpenRouter. Please try again.");
    onTelemetry({ provider, model, event: "network_error", configured: true, duration_ms: Date.now() - requestStartedAt, request_url: apiUrl, request_body: { model: isGrok ? model : [...new Set([model, ...FALLBACK_MODELS])], temperature: requestBody.temperature, max_tokens: requestBody.max_tokens, response_format: requestBody.response_format, stream: requestBody.stream, reasoning: requestBody.reasoning || null, prompt_system_chars: prompt.system.length, prompt_user_chars: JSON.stringify(prompt.user).length, avoid_stems_count: (avoidStems || []).length }, prompt_sent: { system: prompt.system, user: prompt.user }, error: String(error && (error.message || error) || "unknown").slice(0, 800) });
    throw fail(message, 502);
  }

  const raw = await response.text();
  let payload = {};
  try { payload = raw ? JSON.parse(raw) : {}; } catch {}
  const choice = payload && payload.choices && payload.choices[0] || {};
  onTelemetry({ provider, model: normalise(payload && payload.model || model, 120), event: response.ok ? "http_response" : "http_error", configured: true, duration_ms: Date.now() - requestStartedAt, request_url: apiUrl, request_body: { model: isGrok ? model : [...new Set([model, ...FALLBACK_MODELS])], temperature: requestBody.temperature, max_tokens: requestBody.max_tokens, response_format: requestBody.response_format, stream: requestBody.stream, reasoning: requestBody.reasoning || null, prompt_system_chars: prompt.system.length, prompt_user_chars: JSON.stringify(prompt.user).length, avoid_stems_count: (avoidStems || []).length }, prompt_sent: { system: prompt.system, user: prompt.user }, http_status: response.status, finish_reason: choice.finish_reason || null, token_usage: payload.usage || null, response_preview: raw.slice(0, 2200), error: !response.ok ? normalise(payload && (payload.error && payload.error.message || payload.error || payload.message) || "", 800) : null });
  if (!response.ok) {
    const detail = normalise(payload && (payload.error && payload.error.message || payload.error || payload.message) || "", 300);
    const status = response.status === 401 || response.status === 403 ? 503 : 502;
    throw fail((isGrok ? "Grok" : "OpenRouter") + " request failed (" + response.status + ")" + (detail ? ": " + detail : ". Check the provider API key and model availability."), status);
  }
  const content = payload && payload.choices && payload.choices[0] && payload.choices[0].message && payload.choices[0].message.content;
  if (!content) {
    const finishReason = normalise(payload && payload.choices && payload.choices[0] && payload.choices[0].finish_reason || "unknown", 40);
    throw fail((isGrok ? "Grok" : "OpenRouter") + " returned an empty response (finish reason: " + finishReason + "). No questions were saved. Try again or use a different model.", 502);
  }
  let document;
  try {
    document = extractJson(content);
  } catch (error) {
    const preview = normalise(content, 500);
    const finishReason = normalise(payload && payload.choices && payload.choices[0] && payload.choices[0].finish_reason || "unknown", 40);
    const actualModel = normalise(payload && payload.model || model, 120);
    throw fail((isGrok ? "Grok" : "OpenRouter") + " model " + actualModel + " did not return JSON (finish reason: " + finishReason + "). Preview: " + preview, 502);
  }
  return { provider, model: normalise(payload && payload.model || model, 120), pages: validatePages(document, section, count) };
}

async function generateQuestionPages({ section, pageCount = 1, avoidStems = [], provider = "openrouter", onTelemetry = () => {} } = {}) {
  const preferred = provider === "grok" ? "grok" : "openrouter";
  const alternate = preferred === "grok" ? "openrouter" : "grok";
  const configured = name => Boolean(name === "grok" ? process.env.XAI_API_KEY : process.env.OPENROUTER_API_KEY);
  const errors = [];
  const generatedPages = [];
  const seenStems = [...(avoidStems || [])];
  let usedProvider = preferred;

  // Generate one page per request. Large multi-page JSON responses can exhaust a
  // model's output budget and return finish_reason=length with no usable content.
  for (let pageIndex = 0; pageIndex < Number(pageCount); pageIndex++) {
    let pageResult = null;
    for (const name of [preferred, alternate]) {
      if (!configured(name)) {
        if (pageIndex === 0 && name === preferred) {
          errors.push(name === "grok" ? "Grok is not configured (XAI_API_KEY)." : "OpenRouter is not configured (OPENROUTER_API_KEY).");
        }
        continue;
      }
      try {
        const result = await generateWithProvider({
          section,
          pageCount: 1,
          avoidStems: seenStems.slice(-40),
          provider: name,
          onTelemetry
        });
        pageResult = result;
        if (name !== preferred) usedProvider = name;
        break;
      } catch (error) {
        errors.push((name === "grok" ? "Grok" : "OpenRouter") + " (page " + (pageIndex + 1) + "): " + error.message);
      }
    }
    if (!pageResult) {
      throw fail("Could not generate all requested pages. No questions were saved. " + errors.join(" | "), 502);
    }
    generatedPages.push(pageResult.pages[0]);
    pageResult.pages[0].questions.forEach(question => seenStems.push(question.question_text));
    if (pageResult.provider !== preferred) usedProvider = pageResult.provider;
  }

  return {
    provider: usedProvider,
    model: "multiple page requests",
    pages: generatedPages,
    fallbackUsed: usedProvider !== preferred
  };
}

module.exports = { generateQuestionPages, validatePages, extractJson, DEFAULT_MODEL, DEFAULT_XAI_MODEL };
