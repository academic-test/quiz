<template>
  <main class="app-shell">
    <header class="topbar">
      <div>
        <div class="eyebrow">SCHOLARSHIP TEST PRACTICE</div>
        <h1>ACER-Style Year 9 Test Practice</h1>
        <p class="subtitle">Original questions designed around publicly described reasoning-test characteristics. The test runs in two timed blocks: Quantitative + Mathematics, then Reading + Verbal.</p>
      </div>
    </header>

    <section v-if="screen === 'restoring'" class="card start-card">
      <div class="hero-icon">⏳</div>
      <div class="eyebrow">ASSESSMENT IN PROGRESS</div>
      <h2>Restoring your test…</h2>
      <p>Your current question, answers and section timer are being restored. Refreshing the page will not start a new assessment.</p>
    </section>

    <StartScreen
      v-else-if="screen === 'start'"
      v-model:student-name="studentName"
      :loading="starting"
      :error="startError"
      @start="startTest"
    />

    <section v-else-if="screen === 'quiz'" class="quiz-screen">
      <div class="quiz-meta">
        <div>
          <span>{{ currentBlock.label }}</span>
          <strong>Question {{ blockQuestionNumber }} of {{ currentBlock.size }}</strong>
        </div>
        <div class="assessment-actions">
          <button class="ghost-btn" type="button" @click="abortAssessment">Abort Assessment</button>
          <Timer :remaining="remaining" />
        </div>
      </div>

      <div class="block-meta">
        <span>{{ currentBlock.subtitle }}</span>
        <span>{{ answeredCount }} answered · {{ skippedCount }} skipped</span>
      </div>

      <div class="progress">
        <div :style="{ width: progressPercent + '%' }"></div>
      </div>

      <QuestionCard
        v-if="currentQuestion"
        :question="currentQuestion"
        :section-label="sectionLabel"
        :selected="selected"
        :locked="Boolean(results[currentQuestion.id])"
        :feedback="feedback"
        :is-first="questionIndex === currentBlock.start"
        :is-last="questionIndex === totalQuestions - 1"
        :is-last-in-block="questionIndex === currentBlock.end"
        :waiting-for-questions="generatingQuestions && questionIndex >= questions.length - 1"
        :saving="savingResponse"
        :section-complete="sectionComplete"
        :unanswered-count="unansweredCount"
        @select="selectAnswer"
        @next="nextQuestion"
        @skip="skipQuestion"
        @previous="previousQuestion"
        @submit="submitBlock"
      />

      <div class="question-grid">
        <button
          v-for="(item, offset) in currentBlockQuestions"
          :key="item.id"
          type="button"
          class="question-nav"
          :class="{
            current: offset + currentBlock.start === questionIndex,
            answered: questionStates[item.id] === 'answered',
            skipped: questionStates[item.id] === 'skipped'
          }"
          :disabled="offset + currentBlock.start >= questions.length"
          @click="goToQuestion(offset + currentBlock.start)"
        >
          {{ offset + 1 }}
        </button>
      </div>

      <p v-if="generationMessage" class="generation-message">{{ generationMessage }}</p>
    </section>

    <ResultsScreen
      v-else
      :title="resultTitle"
      :score="resultStats.score"
      :correct="resultStats.correct"
      :incorrect="resultStats.incorrect"
      :timeouts="resultStats.timeouts"
      :average-time="resultStats.averageTime"
      :breakdown="resultStats.breakdown"
      @restart="restartAssessment"
    />

    <footer>Questions are original and are not ACER questions. This practice tool is not affiliated with ACER.</footer>
  </main>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import StartScreen from "./components/StartScreen.vue";
import Timer from "./components/Timer.vue";
import QuestionCard from "./components/QuestionCard.vue";
import ResultsScreen from "./components/ResultsScreen.vue";

const STORAGE_KEY = "acer-year9-quiz-session-v3";

const labels = {
  maths: "Mathematics",
  numerical: "Quantitative Reasoning",
  verbal: "Verbal Reasoning",
  reading: "Reading Comprehension"
};

const blocks = [
  {
    label: "Block 1 · Quantitative + Mathematics",
    subtitle: "60 minutes · 60 Quantitative/Numerical + 60 Mathematics",
    start: 0,
    end: 119,
    size: 120,
    duration: 60 * 60
  },
  {
    label: "Block 2 · Reading + Verbal",
    subtitle: "55 minutes · 55 Reading + 55 Verbal",
    start: 120,
    end: 229,
    size: 110,
    duration: 55 * 60
  }
];

const totalQuestions = 230;
const screen = ref("start");
const studentName = ref("");
const startError = ref("");
const starting = ref(false);
const restoring = ref(false);
const savingResponse = ref(false);
const sessionId = ref("");
const attemptId = ref("");
const questions = ref([]);
const questionIndex = ref(0);
const answers = ref({});
const questionStates = ref({});
const timeSpent = ref({});
const results = ref({});
const submittedBlocks = ref({});
const remaining = ref(0);
const blockStartedAt = ref(0);
const generatingQuestions = ref(false);
const feedback = ref(null);

let questionPollHandle = null;
let timerHandle = null;
let questionOpenedAt = 0;

const currentQuestion = computed(() => questions.value[questionIndex.value] || null);
const currentBlockIndex = computed(() => questionIndex.value >= blocks[1].start ? 1 : 0);
const currentBlock = computed(() => blocks[currentBlockIndex.value]);
const currentBlockQuestions = computed(() =>
  questions.value.slice(
    currentBlock.value.start,
    Math.min(currentBlock.value.end + 1, questions.value.length)
  )
);
const selected = computed(() => {
  if (!currentQuestion.value) return null;
  return answers.value[currentQuestion.value.id] ?? null;
});
const sectionLabel = computed(() => labels[currentQuestion.value?.section] || "");
const blockQuestionNumber = computed(() => questionIndex.value - currentBlock.value.start + 1);
const progressPercent = computed(() =>
  Math.min(100, (blockQuestionNumber.value / currentBlock.value.size) * 100)
);
const answeredCount = computed(() =>
  currentBlockQuestions.value.filter(q => Boolean(results.value[q.id])).length
);
const skippedCount = computed(() =>
  currentBlockQuestions.value.filter(
    q => questionStates.value[q.id] === "skipped" && !results.value[q.id]
  ).length
);
const sectionComplete = computed(() =>
  currentBlockQuestions.value.length === currentBlock.value.size &&
  answeredCount.value === currentBlock.value.size
);
const unansweredCount = computed(() => currentBlock.value.size - answeredCount.value);
const generationMessage = computed(() =>
  generatingQuestions.value
    ? "More questions are being prepared in the background. You can continue as they become available."
    : ""
);

const resultList = computed(() => Object.values(results.value));
const resultStats = computed(() => {
  const total = resultList.value.length;
  const correct = resultList.value.filter(item => item.correct).length;
  const timeouts = resultList.value.filter(item => item.timeout).length;
  const incorrect = Math.max(0, total - correct - timeouts);
  const score = total ? Math.round((correct / total) * 100) : 0;
  const average = total
    ? resultList.value.reduce((sum, item) => sum + item.time, 0) / total
    : 0;
  const grouped = {};

  resultList.value.forEach(item => {
    const section = item.question.section;
    grouped[section] ||= { correct: 0, total: 0, time: 0 };
    grouped[section].total += 1;
    grouped[section].correct += item.correct ? 1 : 0;
    grouped[section].time += item.time;
  });

  const breakdown = Object.entries(grouped).map(([section, data]) => ({
    section,
    label: labels[section],
    correct: data.correct,
    total: data.total,
    average: data.total ? (data.time / data.total).toFixed(1) : "0.0"
  }));

  return {
    score,
    correct,
    incorrect,
    timeouts,
    averageTime: average.toFixed(1),
    breakdown
  };
});

const resultTitle = computed(() => {
  if (resultStats.value.score >= 80) return "Excellent work!";
  if (resultStats.value.score >= 60) return "Good progress — keep practising!";
  return "Keep going — speed and accuracy will improve.";
});

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

function persistState() {
  if (!sessionId.value || !attemptId.value) return;

  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 3,
      screen: screen.value,
      studentName: studentName.value,
      sessionId: sessionId.value,
      attemptId: attemptId.value,
      questionIndex: questionIndex.value,
      answers: answers.value,
      questionStates: questionStates.value,
      timeSpent: timeSpent.value,
      results: results.value,
      submittedBlocks: submittedBlocks.value,
      blockStartedAt: blockStartedAt.value,
      questionOpenedAt
    }));
  } catch (error) {
    console.warn("Could not persist quiz session", error);
  }
}

function clearPersistedState() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn("Could not clear quiz session", error);
  }
}

function showFeedbackForCurrentQuestion() {
  const result = currentQuestion.value ? results.value[currentQuestion.value.id] : null;
  feedback.value = result?.feedback || null;
}

function clearTimer() {
  if (timerHandle) clearInterval(timerHandle);
  timerHandle = null;
}

function clearQuestionPolling() {
  if (questionPollHandle) clearInterval(questionPollHandle);
  questionPollHandle = null;
}

async function refreshGeneratedQuestions() {
  if (!sessionId.value) return;

  try {
    const response = await api(
      "/api/questions?year=9&session_id=" + encodeURIComponent(sessionId.value)
    );

    if (!Array.isArray(response.questions)) return;

    if (response.questions.length > questions.value.length) {
      questions.value = response.questions;
    }

    generatingQuestions.value = response.questions.length < totalQuestions;

    if (response.ready) clearQuestionPolling();

    if (screen.value === "restoring" && questions.value.length > questionIndex.value) {
      screen.value = "quiz";
      showFeedbackForCurrentQuestion();
    }
  } catch (error) {
    console.error("Question generation polling failed", error);
  }
}

function startQuestionPolling() {
  clearQuestionPolling();
  generatingQuestions.value = questions.value.length < totalQuestions;

  if (!generatingQuestions.value) return;

  questionPollHandle = setInterval(refreshGeneratedQuestions, 1500);
  refreshGeneratedQuestions();
}

function startBlockTimer(startTime = Date.now()) {
  clearTimer();

  blockStartedAt.value = Number(startTime) || Date.now();

  const elapsed = Math.floor((Date.now() - blockStartedAt.value) / 1000);
  remaining.value = Math.max(0, currentBlock.value.duration - elapsed);

  timerHandle = setInterval(() => {
    const elapsedNow = Math.floor((Date.now() - blockStartedAt.value) / 1000);
    remaining.value = Math.max(0, currentBlock.value.duration - elapsedNow);

    if (remaining.value <= 0) {
      clearTimer();
      handleBlockTimeout();
    }
  }, 1000);

  if (remaining.value <= 0) {
    clearTimer();
    handleBlockTimeout();
  }
}

async function startTest() {
  const name = studentName.value.trim();

  if (!name) {
    startError.value = "Please enter the student's name.";
    return;
  }

  startError.value = "";
  starting.value = true;
  clearTimer();
  clearPersistedState();

  try {
    sessionId.value = crypto.randomUUID();

    const response = await api(
      "/api/questions?year=9&session_id=" + encodeURIComponent(sessionId.value)
    );

    if (!Array.isArray(response.questions) || response.questions.length < 10) {
      throw new Error("The server did not return the first 10 questions.");
    }

    const attempt = await api("/api/attempts", {
      method: "POST",
      body: JSON.stringify({
        session_id: sessionId.value,
        session_name: name,
        year_level: "9",
        section: "quantitative + mathematics, then reading + verbal",
        difficulty: "all",
        question_count: totalQuestions
      })
    });

    studentName.value = name;
    attemptId.value = attempt.id;
    questions.value = response.questions;
    answers.value = {};
    questionStates.value = {};
    timeSpent.value = {};
    results.value = {};
    submittedBlocks.value = {};
    feedback.value = null;
    questionIndex.value = 0;
    screen.value = "quiz";
    blockStartedAt.value = Date.now();
    questionOpenedAt = Date.now();
    persistState();
    startBlockTimer(blockStartedAt.value);
    startQuestionPolling();
  } catch (error) {
    console.error(error);
    startError.value = "The test could not start. Please try again.";
  } finally {
    starting.value = false;
  }
}

async function saveCurrentResponse(timedOut = false) {
  const question = currentQuestion.value;
  if (!question || !attemptId.value) return false;

  const answer = answers.value[question.id];

  if (answer === undefined || answer === null) {
    return false;
  }

  if (results.value[question.id]) {
    showFeedbackForCurrentQuestion();
    return true;
  }

  const elapsed = Math.max(0, (Date.now() - questionOpenedAt) / 1000);
  timeSpent.value[question.id] = elapsed;
  savingResponse.value = true;

  try {
    const response = await api("/api/responses", {
      method: "POST",
      body: JSON.stringify({
        attempt_id: attemptId.value,
        session_id: sessionId.value,
        question_id: question.id,
        selected_answer: answer,
        timed_out: timedOut,
        response_seconds: Number(elapsed.toFixed(3))
      })
    });

    const resultFeedback = {
      correct: Boolean(response.correct),
      correctAnswer: Number(response.correct_answer),
      explanation: response.explanation || ""
    };

    results.value[question.id] = {
      question,
      selected: answer,
      correct: Boolean(response.correct),
      timeout: Boolean(timedOut),
      time: elapsed,
      feedback: resultFeedback
    };

    questionStates.value[question.id] = "answered";
    feedback.value = resultFeedback;
    persistState();
    return true;
  } catch (error) {
    console.error("Response save failed", error);
    startError.value = "Your answer could not be recorded. Please try again.";
    return false;
  } finally {
    savingResponse.value = false;
  }
}

async function selectAnswer(index) {
  if (!currentQuestion.value || savingResponse.value) return;
  if (results.value[currentQuestion.value.id]) return;

  answers.value[currentQuestion.value.id] = index;
  questionStates.value[currentQuestion.value.id] = "selected";
  persistState();
}

async function moveTo(index) {
  if (submittedBlocks.value[currentBlockIndex.value]) return;
  if (index < currentBlock.value.start || index > currentBlock.value.end) return;
  if (index >= questions.value.length) return;

  const current = currentQuestion.value;

  if (
    current &&
    answers.value[current.id] !== undefined &&
    answers.value[current.id] !== null &&
    !results.value[current.id]
  ) {
    const saved = await saveCurrentResponse(false);
    if (!saved) return;
  }

  questionIndex.value = index;
  showFeedbackForCurrentQuestion();
  questionOpenedAt = Date.now();
  persistState();
}

async function nextQuestion() {
  if (!currentQuestion.value || submittedBlocks.value[currentBlockIndex.value]) return;

  const id = currentQuestion.value.id;

  // First click records the answer and shows the correct answer/explanation.
  if (!results.value[id]) {
    const answer = answers.value[id];
    if (answer === undefined || answer === null) return;

    const saved = await saveCurrentResponse(false);
    if (!saved) return;

    return;
  }

  // Second click continues after the response has been locked.
  if (questionIndex.value >= currentBlock.value.end) return;

  questionIndex.value += 1;
  feedback.value = null;
  questionOpenedAt = Date.now();
  persistState();
}

async function skipQuestion() {
  if (!currentQuestion.value || savingResponse.value) return;
  if (results.value[currentQuestion.value.id]) return;

  const question = currentQuestion.value;
  const answer = answers.value[question.id];

  if (answer !== undefined && answer !== null) return;

  // Skipping records neither the answer nor the time spent.
  questionStates.value[question.id] = "skipped";

  if (questionIndex.value >= currentBlock.value.end) return;

  questionIndex.value += 1;
  feedback.value = null;
  questionOpenedAt = Date.now();
  persistState();
}

async function previousQuestion() {
  if (questionIndex.value <= currentBlock.value.start) return;
  await moveTo(questionIndex.value - 1);
}

async function goToQuestion(index) {
  await moveTo(index);
}

async function waitForNextQuestion() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (questions.value.length > questionIndex.value) {
      generatingQuestions.value = questions.value.length < totalQuestions;
      return true;
    }

    await refreshGeneratedQuestions();

    if (questions.value.length > questionIndex.value) return true;

    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return questions.value.length > questionIndex.value;
}

async function submitBlock() {
  const blockIndex = currentBlockIndex.value;

  if (submittedBlocks.value[blockIndex] || !currentQuestion.value) return;

  const id = currentQuestion.value.id;

  // First click on the final question records it and shows feedback.
  if (!results.value[id]) {
    const answer = answers.value[id];
    if (answer === undefined || answer === null) return;

    const saved = await saveCurrentResponse(false);
    if (!saved) return;

    return;
  }

  // The actual section submission happens only after every question is answered.
  if (!sectionComplete.value) return;

  clearTimer();
  submittedBlocks.value[blockIndex] = true;

  if (blockIndex === 0) {
    questionIndex.value = blocks[1].start;

    const ready = await waitForNextQuestion();
    if (!ready || !currentQuestion.value) return;

    feedback.value = null;
    questionOpenedAt = Date.now();
    blockStartedAt.value = Date.now();
    persistState();
    startBlockTimer(blockStartedAt.value);
    return;
  }

  clearQuestionPolling();
  await finishAttempt();
  screen.value = "results";
  persistState();
}

async function handleBlockTimeout() {
  const blockIndex = currentBlockIndex.value;

  if (submittedBlocks.value[blockIndex]) return;

  clearTimer();

  const current = currentQuestion.value;

  if (
    current &&
    answers.value[current.id] !== undefined &&
    answers.value[current.id] !== null &&
    !results.value[current.id]
  ) {
    await saveCurrentResponse(false);
  }

  // Timer expiry permanently locks the entire section, including skipped questions.
  submittedBlocks.value[blockIndex] = true;

  if (blockIndex === 0) {
    questionIndex.value = blocks[1].start;

    const ready = await waitForNextQuestion();
    if (!ready || !currentQuestion.value) return;

    feedback.value = null;
    questionOpenedAt = Date.now();
    blockStartedAt.value = Date.now();
    persistState();
    startBlockTimer(blockStartedAt.value);
    return;
  }

  clearQuestionPolling();
  await finishAttempt();
  screen.value = "results";
  persistState();
}

async function finishAttempt() {
  const stats = resultStats.value;

  try {
    await api("/api/attempts/" + attemptId.value, {
      method: "PATCH",
      body: JSON.stringify({
        completed_at: new Date().toISOString(),
        score: stats.score,
        correct_count: stats.correct,
        wrong_count: stats.incorrect,
        timeout_count: stats.timeouts,
        average_response_seconds: Number(stats.averageTime),
        session_id: sessionId.value
      })
    });
  } catch (error) {
    console.error("Attempt finalisation failed", error);
  }
}

async function restoreSession() {
  let raw = null;

  try {
    raw = sessionStorage.getItem(STORAGE_KEY);
  } catch (error) {
    console.warn("Could not read saved quiz session", error);
  }

  if (!raw) return;

  try {
    const saved = JSON.parse(raw);

    if (
      saved?.version !== 3 ||
      !saved.sessionId ||
      !saved.attemptId ||
      !saved.screen
    ) {
      clearPersistedState();
      return;
    }

    restoring.value = true;
    screen.value = "restoring";
    studentName.value = saved.studentName || "";
    sessionId.value = saved.sessionId;
    attemptId.value = saved.attemptId;
    questionIndex.value = Number.isInteger(saved.questionIndex) ? saved.questionIndex : 0;
    answers.value = saved.answers || {};
    questionStates.value = saved.questionStates || {};
    timeSpent.value = saved.timeSpent || {};
    results.value = saved.results || {};
    submittedBlocks.value = saved.submittedBlocks || {};
    blockStartedAt.value = Number(saved.blockStartedAt) || Date.now();
    questionOpenedAt = Number(saved.questionOpenedAt) || Date.now();

    if (saved.screen === "results") {
      screen.value = "results";
      restoring.value = false;
      return;
    }

    const response = await api(
      "/api/questions?year=9&session_id=" + encodeURIComponent(sessionId.value)
    );

    if (!Array.isArray(response.questions) || response.questions.length <= questionIndex.value) {
      questions.value = Array.isArray(response.questions) ? response.questions : [];
      startQuestionPolling();
      restoring.value = false;
      return;
    }

    questions.value = response.questions;
    screen.value = "quiz";
    showFeedbackForCurrentQuestion();
    startBlockTimer(blockStartedAt.value);
    startQuestionPolling();
  } catch (error) {
    console.error("Could not restore quiz session", error);
    clearPersistedState();
    screen.value = "start";
  } finally {
    restoring.value = false;
  }
}

function confirmRestart() {
  return window.confirm("Are you sure you want to restart the assessment? Your current progress will be lost.");
}

function abortAssessment() {
  if (!window.confirm("Are you sure you want to abort the assessment? Your current progress will be lost.")) {
    return;
  }
  reset();
}

function restartAssessment() {
  if (!confirmRestart()) {
    return;
  }
  reset();
}

function reset() {
  clearTimer();
  clearQuestionPolling();
  clearPersistedState();
  generatingQuestions.value = false;
  screen.value = "start";
  questions.value = [];
  results.value = {};
  submittedBlocks.value = {};
  feedback.value = null;
  answers.value = {};
  questionStates.value = {};
  timeSpent.value = {};
  questionIndex.value = 0;
  remaining.value = 0;
  blockStartedAt.value = 0;
  sessionId.value = "";
  attemptId.value = "";
  studentName.value = "";
  startError.value = "";
}

onMounted(restoreSession);

onBeforeUnmount(() => {
  clearTimer();
  clearQuestionPolling();
});
</script>
