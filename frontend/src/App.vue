<template>
  <main class="app-shell">
    <header class="topbar">
      <div>
        <div class="eyebrow">SCHOLARSHIP TEST PRACTICE</div>
        <h1>ACER-Style Year 9 Test Practice</h1>
        <p class="subtitle">Original questions designed around publicly described reasoning-test characteristics. The test runs in sections: Numerical Reasoning, then Verbal Reasoning, then Mathematics, then Reading Comprehension. Questions are not mixed.</p>
      </div>
    </header>

    <StartScreen v-if="screen === 'start'" v-model:student-name="studentName" :loading="starting" :error="startError" @start="startTest" />

    <section v-else-if="screen === 'quiz'" class="quiz-screen">
      <div class="quiz-meta">
        <div><span>{{ sectionLabel }}</span><strong>Question {{ questionIndex + 1 }} of {{ questions.length }}</strong></div>
        <Timer :remaining="remaining" />
      </div>
      <div class="progress"><div :style="{ width: progressPercent + '%' }"></div></div>

      <QuestionCard
        :question="currentQuestion"
        :section-label="sectionLabel"
        :selected="selected"
        :submitted="submitted"
        :correct-answer="feedback ? feedback.correctAnswer : null"
        :feedback="feedback"
        :is-last="questionIndex === questions.length - 1"
        @select="selectAnswer"
        @submit="submitAnswer(false)"
        @next="nextQuestion"
      />
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
  numerical: "Numerical Reasoning",
  verbal: "Verbal Reasoning",
  reading: "Reading Comprehension"
};

const screen = ref("start");
const studentName = ref("");
const startError = ref("");
const starting = ref(false);
const sessionId = ref("");
const attemptId = ref("");
const questions = ref([]);
const questionIndex = ref(0);
const selected = ref(null);
const submitted = ref(false);
const remaining = ref(0);
const feedback = ref(null);
const results = ref([]);
let timerHandle = null;
let startedAt = 0;

const currentQuestion = computed(() => questions.value[questionIndex.value] || null);
const sectionLabel = computed(() => labels[currentQuestion.value?.section] || "");
const progressPercent = computed(() => questions.value.length ? (questionIndex.value / questions.value.length) * 100 : 0);

const resultStats = computed(() => {
  const total = results.value.length;
  const correct = results.value.filter(item => item.correct).length;
  const timeouts = results.value.filter(item => item.timeout).length;
  const incorrect = total - correct - timeouts;
  const score = total ? Math.round((correct / total) * 100) : 0;
  const average = total ? results.value.reduce((sum, item) => sum + item.time, 0) / total : 0;
  const grouped = {};

  results.value.forEach(item => {
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
    average: (data.time / data.total).toFixed(1)
  }));

  return { score, correct, incorrect, timeouts, averageTime: average.toFixed(1), breakdown };
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

    if (!Array.isArray(response.questions) || response.questions.length !== 20) {
      throw new Error("The server did not return a complete 20-question test.");
    }

    const attempt = await api("/api/attempts", {
      method: "POST",
      body: JSON.stringify({
        session_id: sessionId.value,
        session_name: name,
        year_level: "9",
        section: "numerical, verbal, maths, reading",
        difficulty: "all",
        question_count: 20
      })
    });

    attemptId.value = attempt.id;
    questions.value = response.questions;
    results.value = [];
    questionIndex.value = 0;
    screen.value = "quiz";
    renderQuestion();
  } catch (error) {
    console.error(error);
    startError.value = "The test could not start. Please try again.";
  } finally {
    starting.value = false;
  }
}

function renderQuestion() {
  clearTimer();
  selected.value = null;
  submitted.value = false;
  feedback.value = null;
  remaining.value = currentQuestion.value.time;
  startedAt = performance.now();

  timerHandle = setInterval(() => {
    if (submitted.value) return;
    if (remaining.value <= 0) {
      submitAnswer(true);
      return;
    }
    remaining.value -= 1;
  }, 1000);
}

function selectAnswer(index) {
  if (!submitted.value) selected.value = index;
}

async function submitAnswer(timeout) {
  if (submitted.value) return;
  submitted.value = true;
  clearTimer();

  const question = currentQuestion.value;
  const elapsed = Math.min(question.time, Math.max(0, (performance.now() - startedAt) / 1000));

  try {
    const response = await api("/api/responses", {
      method: "POST",
      body: JSON.stringify({
        attempt_id: attemptId.value,
        session_id: sessionId.value,
        question_id: question.id,
        selected_answer: selected.value,
        timed_out: timeout,
        response_seconds: elapsed
      })
    });

    feedback.value = {
      correct: response.correct,
      timeout,
      correctAnswer: response.correct_answer,
      explanation: response.explanation
    };

    results.value.push({
      question,
      selected: selected.value,
      correct: response.correct,
      timeout,
      time: elapsed
    });
  } catch (error) {
    console.error(error);
    submitted.value = false;
    startError.value = "Your answer could not be recorded. Please try again.";
  }
}

async function nextQuestion() {
  if (!submitted.value) return;

  if (questionIndex.value === questions.value.length - 1) {
    await finishAttempt();
    screen.value = "results";
    return;
  }

  questionIndex.value += 1;
  renderQuestion();
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
    console.error(error);
  }
}

function reset() {
  clearTimer();
  screen.value = "start";
  questions.value = [];
  results.value = [];
  questionIndex.value = 0;
  selected.value = null;
  submitted.value = false;
  feedback.value = null;
  sessionId.value = "";
  attemptId.value = "";
  startError.value = "";
}

onBeforeUnmount(clearTimer);
</script>