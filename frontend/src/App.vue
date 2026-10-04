<template>
  <main class="app-shell">
    <header class="topbar">
      <div>
        <div class="eyebrow">SCHOLARSHIP TEST PRACTICE</div>
        <h1>ACER-Style Year 9 Test Practice</h1>
        <p class="subtitle">Original questions designed around publicly described reasoning-test characteristics. The test runs in two timed blocks: Quantitative + Mathematics, then Reading + Verbal.</p>
      </div>
    </header>

    <StartScreen
      v-if="screen === 'start'"
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
        <Timer :remaining="remaining" />
      </div>

      <div class="block-meta">
        <span>{{ currentBlock.subtitle }}</span>
        <span>{{ answeredCount }} answered · {{ skippedCount }} skipped</span>
      </div>

      <div class="progress">
        <div :style="{ width: progressPercent + '%' }"></div>
      </div>

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

      <QuestionCard
        v-if="currentQuestion"
        :question="currentQuestion"
        :section-label="sectionLabel"
        :selected="selected"
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
      @restart="reset"
    />

    <footer>Questions are original and are not ACER questions. This practice tool is not affiliated with ACER.</footer>
  </main>
</template>

<script setup>
import { computed, onBeforeUnmount, ref } from "vue";
import StartScreen from "./components/StartScreen.vue";
import Timer from "./components/Timer.vue";
import QuestionCard from "./components/QuestionCard.vue";
import ResultsScreen from "./components/ResultsScreen.vue";

const labels = {
  maths: "Mathematics",
  numerical: "Quantitative Reasoning",
  verbal: "Verbal Reasoning",
  reading: "Reading Comprehension"
};

const blocks = [
  { label: "Block 1 · Quantitative + Mathematics", subtitle: "60 minutes · 60 Quantitative/Numerical + 60 Mathematics", start: 0, end: 119, size: 120, duration: 60 * 60 },
  { label: "Block 2 · Reading + Verbal", subtitle: "55 minutes · 55 Reading + 55 Verbal", start: 120, end: 229, size: 110, duration: 55 * 60 }
];

const totalQuestions = 230;
const screen = ref("start");
const studentName = ref("");
const startError = ref("");
const starting = ref(false);
const savingResponse = ref(false);
const sessionId = ref("");
const attemptId = ref("");
const questions = ref([]);
const questionIndex = ref(0);
const answers = ref({});
const questionStates = ref({});
const timeSpent = ref({});
const results = ref({});
const remaining = ref(0);
const generatingQuestions = ref(false);
let questionPollHandle = null;
let timerHandle = null;
let questionOpenedAt = 0;

const currentQuestion = computed(() => questions.value[questionIndex.value] || null);
const currentBlockIndex = computed(() => questionIndex.value >= blocks[1].start ? 1 : 0);
const currentBlock = computed(() => blocks[currentBlockIndex.value]);
const currentBlockQuestions = computed(() => questions.value.slice(currentBlock.value.start, Math.min(currentBlock.value.end + 1, questions.value.length)));
const selected = computed(() => {
  if (!currentQuestion.value) return null;
  return answers.value[currentQuestion.value.id] ?? null;
});
const sectionLabel = computed(() => labels[currentQuestion.value?.section] || "");
const blockQuestionNumber = computed(() => questionIndex.value - currentBlock.value.start + 1);
const progressPercent = computed(() => {
  if (!currentBlock.value.size) return 0;
  return Math.min(100, (blockQuestionNumber.value / currentBlock.value.size) * 100);
});
const answeredCount = computed(() => currentBlockQuestions.value.filter(q => questionStates.value[q.id] === "answered").length);
const skippedCount = computed(() => currentBlockQuestions.value.filter(q => questionStates.value[q.id] === "skipped").length);
const sectionComplete = computed(() =>
  currentBlockQuestions.value.length === currentBlock.value.size &&
  answeredCount.value === currentBlock.value.size
);
const unansweredCount = computed(() => currentBlock.value.size - answeredCount.value);
const generationMessage = computed(() => {
  if (!generatingQuestions.value) return "";
  return "More questions are being prepared in the background. You can continue as they become available.";
});

const resultList = computed(() => Object.values(results.value));
const resultStats = computed(() => {
  const total = resultList.value.length;
  const correct = resultList.value.filter(item => item.correct).length;
  const timeouts = resultList.value.filter(item => item.timeout).length;
  const incorrect = Math.max(0, total - correct - timeouts);
  const score = total ? Math.round((correct / total) * 100) : 0;
  const average = total ? resultList.value.reduce((sum, item) => sum + item.time, 0) / total : 0;
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
    const response = await api("/api/questions?year=9&session_id=" + encodeURIComponent(sessionId.value));
    if (!Array.isArray(response.questions)) return;
    if (response.questions.length > questions.value.length) questions.value = response.questions;
    generatingQuestions.value = response.questions.length < totalQuestions;
    if (response.ready) clearQuestionPolling();
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

async function startTest() {
  const name = studentName.value.trim();
  if (!name) {
    startError.value = "Please enter the student's name.";
    return;
  }

  startError.value = "";
  starting.value = true;
  clearTimer();

  try {
    sessionId.value = crypto.randomUUID();
    const response = await api("/api/questions?year=9&session_id=" + encodeURIComponent(sessionId.value));

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

    attemptId.value = attempt.id;
    questions.value = response.questions;
    answers.value = {};
    questionStates.value = {};
    timeSpent.value = {};
    results.value = {};
    questionIndex.value = 0;
    screen.value = "quiz";
    startBlockTimer();
    startQuestionPolling();
  } catch (error) {
    console.error(error);
    startError.value = "The test could not start. Please try again.";
  } finally {
    starting.value = false;
  }
}

function startBlockTimer() {
  clearTimer();
  remaining.value = currentBlock.value.duration;
  questionOpenedAt = performance.now();

  timerHandle = setInterval(() => {
    if (remaining.value <= 0) {
      handleBlockTimeout();
      return;
    }
    remaining.value -= 1;
  }, 1000);
}

function recordQuestionTime() {
  if (!currentQuestion.value) return 0;
  const elapsed = Math.max(0, (performance.now() - questionOpenedAt) / 1000);
  const id = currentQuestion.value.id;
  timeSpent.value[id] = (timeSpent.value[id] || 0) + elapsed;
  return elapsed;
}

async function saveCurrentResponse(timedOut = false) {
  const question = currentQuestion.value;
  if (!question || !attemptId.value) return false;

  const answer = answers.value[question.id];
  if (answer === undefined || answer === null) {
    // Skipped/unanswered questions are intentionally not recorded.
    return false;
  }

  const elapsed = Math.max(0, (performance.now() - questionOpenedAt) / 1000);
  timeSpent.value[question.id] = (timeSpent.value[question.id] || 0) + elapsed;
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
        response_seconds: Number(timeSpent.value[question.id].toFixed(3))
      })
    });

    results.value[question.id] = {
      question,
      selected: answer,
      correct: Boolean(response.correct),
      timeout: Boolean(timedOut),
      time: timeSpent.value[question.id]
    };
    questionStates.value[question.id] = "answered";
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
  answers.value[currentQuestion.value.id] = index;
  questionStates.value[currentQuestion.value.id] = "answered";
}

async function moveTo(index) {
  if (index < 0 || index >= questions.value.length) return;
  const previousBlockIndex = currentBlockIndex.value;
  const current = currentQuestion.value;
  if (current && answers.value[current.id] !== undefined && answers.value[current.id] !== null) {
    const saved = await saveCurrentResponse(false);
    if (!saved) return;
  }

  questionIndex.value = index;

  if (currentBlockIndex.value !== previousBlockIndex) {
    startBlockTimer();
  } else {
    questionOpenedAt = performance.now();
  }
}

async function nextQuestion() {
  if (!currentQuestion.value) return;
  const answer = answers.value[currentQuestion.value.id];
  if (answer === undefined || answer === null) return;
  if (questionIndex.value >= currentBlock.value.end) return;

  const saved = await saveCurrentResponse(false);
  if (!saved) return;

  questionIndex.value += 1;
  questionOpenedAt = performance.now();
}

async function submitBlock() {
  if (!currentQuestion.value || !sectionComplete.value) return;

  const saved = await saveCurrentResponse(false);
  if (!saved) return;

  clearTimer();

  if (currentBlockIndex.value === 0) {
    questionIndex.value = blocks[1].start;
    const ready = await waitForNextQuestion();
    if (!ready) return;
    startBlockTimer();
    questionOpenedAt = performance.now();
    return;
  }

  await finishAttempt();
  screen.value = "results";
}

async function skipQuestion() {
  if (!currentQuestion.value || savingResponse.value) return;
  const question = currentQuestion.value;
  const answer = answers.value[question.id];

  if (answer !== undefined && answer !== null) return;

  questionStates.value[question.id] = "skipped";

  if (questionIndex.value === totalQuestions - 1) {
    await submitTest();
    return;
  }

  const previousBlockIndex = currentBlockIndex.value;
  questionIndex.value += 1;

  if (currentBlockIndex.value !== previousBlockIndex) {
    startBlockTimer();
  } else {
    questionOpenedAt = performance.now();
  }
}

async function previousQuestion() {
  if (questionIndex.value <= currentBlock.value.start) return;
  await moveTo(questionIndex.value - 1);
}

async function goToQuestion(index) {
  if (index < currentBlock.value.start || index > currentBlock.value.end) return;
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

async function handleBlockTimeout() {
  clearTimer();

  const current = currentQuestion.value;
  if (current && answers.value[current.id] !== undefined && answers.value[current.id] !== null) {
    // A selected answer is still a normal answer when the block clock expires.
    await saveCurrentResponse(false);
  }

  if (currentBlockIndex.value === 0) {
    questionIndex.value = blocks[1].start;
    await waitForNextQuestion();
    if (!currentQuestion.value) return;
    startBlockTimer();
    questionOpenedAt = performance.now();
    return;
  }

  await submitTest(true);
}


async function submitTest(fromTimeout = false) {
  clearTimer();
  clearQuestionPolling();

  if (currentQuestion.value && answers.value[currentQuestion.value.id] !== undefined && answers.value[currentQuestion.value.id] !== null) {
    const saved = await saveCurrentResponse(fromTimeout);
    if (!saved) return;
  }

  await finishAttempt();
  screen.value = "results";
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

function reset() {
  clearTimer();
  clearQuestionPolling();
  generatingQuestions.value = false;
  screen.value = "start";
  questions.value = [];
  results.value = {};
  answers.value = {};
  questionStates.value = {};
  timeSpent.value = {};
  questionIndex.value = 0;
  remaining.value = 0;
  sessionId.value = "";
  attemptId.value = "";
  startError.value = "";
}

onBeforeUnmount(() => {
  clearTimer();
  clearQuestionPolling();
});
</script>
