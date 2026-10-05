import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import {
  finishAttempt as finishAttemptApi,
  getQuestions,
  saveResponse as saveResponseApi,
  saveWritingResponse,
  startAssessment
} from "../services/quizApi";

export const totalQuestions = 72;

export const labels = {
  humanities: "Humanities",
  mathematics_science: "Mathematics & Science"
};

export const blocks = [
  {
    key: "writing-1",
    type: "writing",
    label: "Test 1 · Written Expression",
    subtitle: "25 minutes · Writing Task 1",
    taskIndex: 0,
    start: 0,
    end: 0,
    size: 1,
    duration: 25 * 60
  },
  {
    key: "humanities",
    type: "mcq",
    label: "Test 2 · Humanities",
    subtitle: "40 minutes · 40 questions",
    start: 0,
    end: 39,
    size: 40,
    duration: 40 * 60
  },
  {
    key: "mathematics-science",
    type: "mcq",
    label: "Test 3 · Mathematics & Science",
    subtitle: "40 minutes · 32 questions",
    start: 40,
    end: 71,
    size: 32,
    duration: 40 * 60
  },
  {
    key: "writing-2",
    type: "writing",
    label: "Test 4 · Written Expression",
    subtitle: "25 minutes · Writing Task 2",
    taskIndex: 1,
    start: 0,
    end: 0,
    size: 1,
    duration: 25 * 60
  }
];

const STORAGE_KEY = "acer-level2-year10-quiz-v1";

export function useAssessment() {
  const screen = ref("start");
  const studentName = ref("");
  const startError = ref("");
  const starting = ref(false);
  const savingResponse = ref(false);
  const sessionId = ref("");
  const attemptId = ref("");
  const questions = ref([]);
  const questionManifest = ref([]);
  const questionIndex = ref(0);
  const answers = ref({});
  const questionStates = ref({});
  const results = ref({});
  const submittedBlocks = ref({});
  const writingTasks = ref([]);
  const writingDrafts = ref({});
  const writingSubmitted = ref({});
  const currentStage = ref(0);
  const remaining = ref(0);
  const blockStartedAt = ref(0);
  const feedback = ref(null);

  let timerHandle = null;
  let questionOpenedAt = 0;
  let writingOpenedAt = 0;

  const currentBlock = computed(() => blocks[currentStage.value]);
  const currentQuestion = computed(() =>
    currentBlock.value.type === "mcq" ? questions.value[questionIndex.value] || null : null
  );
  const currentWritingTask = computed(() =>
    currentBlock.value.type === "writing"
      ? writingTasks.value[currentBlock.value.taskIndex] || null
      : null
  );
  const currentBlockQuestions = computed(() =>
    currentBlock.value.type === "mcq"
      ? questionManifest.value.slice(currentBlock.value.start, currentBlock.value.end + 1)
      : []
  );
  const selected = computed(() => {
    if (!currentQuestion.value) return null;
    return answers.value[currentQuestion.value.id] ?? null;
  });
  const sectionLabel = computed(() => labels[currentQuestion.value?.section] || currentBlock.value.label);
  const blockQuestionNumber = computed(() =>
    currentBlock.value.type === "mcq"
      ? questionIndex.value - currentBlock.value.start + 1
      : 1
  );
  const progressPercent = computed(() => {
    const complete = currentBlock.value.type === "writing"
      ? (writingSubmitted.value[currentWritingTask.value?.id] ? 100 : 0)
      : (blockQuestionNumber.value / currentBlock.value.size) * 100;
    return Math.min(100, complete);
  });
  const answeredCount = computed(() =>
    currentBlock.value.type === "mcq"
      ? currentBlockQuestions.value.filter(q => Boolean(results.value[q.id])).length
      : (currentWritingTask.value && writingSubmitted.value[currentWritingTask.value.id] ? 1 : 0)
  );
  const skippedCount = computed(() =>
    currentBlock.value.type === "mcq"
      ? currentBlockQuestions.value.filter(q => questionStates.value[q.id] === "skipped" && !results.value[q.id]).length
      : 0
  );
  const sectionComplete = computed(() => {
    if (currentBlock.value.type === "writing") {
      return Boolean(currentWritingTask.value && writingSubmitted.value[currentWritingTask.value.id]);
    }
    return currentBlockQuestions.value.length === currentBlock.value.size &&
      answeredCount.value === currentBlock.value.size;
  });
  const unansweredCount = computed(() =>
    currentBlock.value.type === "mcq"
      ? currentBlock.value.size - answeredCount.value
      : sectionComplete.value ? 0 : 1
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
    return {
      score,
      correct,
      incorrect,
      timeouts,
      averageTime: average.toFixed(1),
      breakdown: Object.entries(grouped).map(([section, data]) => ({
        section,
        label: labels[section] || section,
        correct: data.correct,
        total: data.total,
        average: data.total ? (data.time / data.total).toFixed(1) : "0.0"
      })),
      writingCompleted: Object.values(writingSubmitted.value).filter(Boolean).length
    };
  });

  const resultTitle = computed(() => {
    if (resultStats.value.score >= 80) return "Excellent work!";
    if (resultStats.value.score >= 60) return "Good progress — keep practising!";
    return "Keep going — speed and accuracy will improve.";
  });

  function persistState() {
    if (!sessionId.value || !attemptId.value) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: 1,
        screen: screen.value,
        studentName: studentName.value,
        sessionId: sessionId.value,
        attemptId: attemptId.value,
        currentStage: currentStage.value,
        questionIndex: questionIndex.value,
        answers: answers.value,
        questionStates: questionStates.value,
        results: results.value,
        submittedBlocks: submittedBlocks.value,
        writingTasks: writingTasks.value,
        writingDrafts: writingDrafts.value,
        writingSubmitted: writingSubmitted.value,
        blockStartedAt: blockStartedAt.value,
        questionOpenedAt,
        writingOpenedAt
      }));
    } catch (error) {
      console.warn("Could not persist quiz session", error);
    }
  }

  function clearPersistedState() {
    try { sessionStorage.removeItem(STORAGE_KEY); }
    catch (error) { console.warn("Could not clear quiz session", error); }
  }

  function clearTimer() {
    if (timerHandle) clearInterval(timerHandle);
    timerHandle = null;
  }

  async function loadQuestionBatch(offset = 0) {
    if (!sessionId.value) return false;
    const batchOffset = Math.max(0, Math.floor(offset / 10) * 10);
    try {
      const response = await getQuestions(sessionId.value, batchOffset, 10);
      if (Array.isArray(response.manifest)) questionManifest.value = response.manifest;
      if (!Array.isArray(response.questions)) return false;
      response.questions.forEach((question, index) => {
        questions.value[batchOffset + index] = question;
      });
      return Boolean(questions.value[offset]);
    } catch (error) {
      console.error("Question batch load failed", error);
      startError.value = "The question could not be loaded. Please try again.";
      return false;
    }
  }

  async function ensureQuestionLoaded(index) {
    if (index < 0 || index >= totalQuestions) return false;
    if (questions.value[index]) return true;
    return loadQuestionBatch(index);
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
    clearPersistedState();
    try {
      const response = await startAssessment({
        session_name: name,
        year_level: "10"
      });
      if (!response.session_id || !response.attempt_id || !Array.isArray(response.questions)) {
        throw new Error("The server did not return an assessment.");
      }

      sessionId.value = response.session_id;
      attemptId.value = response.attempt_id;
      questionManifest.value = Array.isArray(response.manifest) ? response.manifest : [];
      questions.value = Array.from({ length: totalQuestions }, () => null);
      response.questions.forEach((question, index) => { questions.value[index] = question; });
      writingTasks.value = Array.isArray(response.writing_tasks) ? response.writing_tasks : [];
      if (writingTasks.value.length !== 2) throw new Error("The server did not return two writing tasks.");

      answers.value = {};
      questionStates.value = {};
      results.value = {};
      submittedBlocks.value = {};
      writingDrafts.value = {};
      writingSubmitted.value = {};
      questionIndex.value = 0;
      currentStage.value = 0;
      feedback.value = null;
      screen.value = "quiz";
      blockStartedAt.value = Date.now();
      writingOpenedAt = Date.now();
      persistState();
      startBlockTimer(blockStartedAt.value);
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
    if (answer === undefined || answer === null) return false;
    if (results.value[question.id]) {
      feedback.value = results.value[question.id].feedback || null;
      return true;
    }

    savingResponse.value = true;
    const elapsed = Math.max(0, (Date.now() - questionOpenedAt) / 1000);
    try {
      const response = await saveResponseApi({
        attempt_id: attemptId.value,
        session_id: sessionId.value,
        question_id: question.id,
        selected_answer: answer,
        timed_out: timedOut,
        response_seconds: Number(elapsed.toFixed(3))
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

  async function saveCurrentWriting() {
    const task = currentWritingTask.value;
    if (!task || !attemptId.value) return false;
    if (writingSubmitted.value[task.id]) return true;
    const text = String(writingDrafts.value[task.id] || "").trim();
    if (!text) return false;

    savingResponse.value = true;
    try {
      await saveWritingResponse({
        attempt_id: attemptId.value,
        session_id: sessionId.value,
        task_id: task.id,
        response_text: text
      });
      writingSubmitted.value[task.id] = true;
      persistState();
      return true;
    } catch (error) {
      console.error("Writing response save failed", error);
      startError.value = "Your writing response could not be recorded. Please try again.";
      return false;
    } finally {
      savingResponse.value = false;
    }
  }

  function selectAnswer(index) {
    if (!currentQuestion.value || savingResponse.value) return;
    if (results.value[currentQuestion.value.id]) return;
    answers.value[currentQuestion.value.id] = index;
    questionStates.value[currentQuestion.value.id] = "selected";
    persistState();
  }

  function updateWriting(text) {
    const task = currentWritingTask.value;
    if (!task || writingSubmitted.value[task.id]) return;
    writingDrafts.value[task.id] = text;
    persistState();
  }

  async function advanceStage() {
    clearTimer();
    submittedBlocks.value[currentStage.value] = true;

    if (currentStage.value >= blocks.length - 1) {
      await finishAttempt();
      screen.value = "results";
      persistState();
      return;
    }

    currentStage.value += 1;
    if (currentBlock.value.type === "mcq") {
      questionIndex.value = currentBlock.value.start;
      const ready = await ensureQuestionLoaded(questionIndex.value);
      if (!ready) return;
      questionOpenedAt = Date.now();
    } else {
      writingOpenedAt = Date.now();
    }
    feedback.value = null;
    blockStartedAt.value = Date.now();
    persistState();
    startBlockTimer(blockStartedAt.value);
  }

  async function nextQuestion() {
    if (currentBlock.value.type !== "mcq") return advanceStage();
    const id = currentQuestion.value?.id;
    if (!id) return;
    if (!results.value[id]) {
      const saved = await saveCurrentResponse(false);
      if (!saved) return;
      return;
    }
    if (questionIndex.value >= currentBlock.value.end) return;
    const nextIndex = questionIndex.value + 1;
    if (!(await ensureQuestionLoaded(nextIndex))) return;
    questionIndex.value = nextIndex;
    feedback.value = null;
    questionOpenedAt = Date.now();
    persistState();
  }

  async function skipQuestion() {
    if (currentBlock.value.type !== "mcq" || !currentQuestion.value || savingResponse.value) return;
    const id = currentQuestion.value.id;
    if (results.value[id]) return;
    const answer = answers.value[id];
    if (answer !== undefined && answer !== null) return;
    questionStates.value[id] = "skipped";
    if (questionIndex.value >= currentBlock.value.end) return;
    const nextIndex = questionIndex.value + 1;
    if (!(await ensureQuestionLoaded(nextIndex))) return;
    questionIndex.value = nextIndex;
    feedback.value = null;
    questionOpenedAt = Date.now();
    persistState();
  }

  async function previousQuestion() {
    if (currentBlock.value.type !== "mcq") return;
    if (questionIndex.value <= currentBlock.value.start) return;
    questionIndex.value -= 1;
    const loaded = await ensureQuestionLoaded(questionIndex.value);
    if (loaded) {
      feedback.value = results.value[currentQuestion.value?.id]?.feedback || null;
      questionOpenedAt = Date.now();
      persistState();
    }
  }

  async function goToQuestion(index) {
    if (currentBlock.value.type !== "mcq") return;
    if (index < currentBlock.value.start || index > currentBlock.value.end) return;
    if (await ensureQuestionLoaded(index)) {
      questionIndex.value = index;
      feedback.value = results.value[questions.value[index]?.id]?.feedback || null;
      questionOpenedAt = Date.now();
      persistState();
    }
  }

  async function submitBlock() {
    if (currentBlock.value.type === "writing") {
      const saved = await saveCurrentWriting();
      if (saved) await advanceStage();
      return;
    }

    const id = currentQuestion.value?.id;
    if (!id) return;
    if (!results.value[id]) {
      const saved = await saveCurrentResponse(false);
      if (!saved) return;
      return;
    }
    if (!sectionComplete.value) return;
    await advanceStage();
  }

  async function handleBlockTimeout() {
    if (submittedBlocks.value[currentStage.value]) return;
    if (currentBlock.value.type === "mcq" && currentQuestion.value) {
      const id = currentQuestion.value.id;
      if (!results.value[id] && answers.value[id] !== undefined && answers.value[id] !== null) {
        await saveCurrentResponse(true);
      }
    }
    if (currentBlock.value.type === "writing" && currentWritingTask.value) {
      const text = String(writingDrafts.value[currentWritingTask.value.id] || "").trim();
      if (text) await saveCurrentWriting();
    }
    await advanceStage();
  }

  async function finishAttempt() {
    try {
      const stats = resultStats.value;
      await finishAttemptApi(attemptId.value, {
        completed_at: new Date().toISOString(),
        score: stats.score,
        correct_count: stats.correct,
        wrong_count: stats.incorrect,
        timeout_count: stats.timeouts,
        average_response_seconds: Number(stats.averageTime),
        session_id: sessionId.value
      });
    } catch (error) {
      console.error("Attempt finalisation failed", error);
    }
  }

  function reset() {
    clearTimer();
    clearPersistedState();
    screen.value = "start";
    studentName.value = "";
    startError.value = "";
    sessionId.value = "";
    attemptId.value = "";
    questions.value = [];
    questionManifest.value = [];
    answers.value = {};
    questionStates.value = {};
    results.value = {};
    submittedBlocks.value = {};
    writingTasks.value = [];
    writingDrafts.value = {};
    writingSubmitted.value = {};
    currentStage.value = 0;
    questionIndex.value = 0;
    remaining.value = 0;
    feedback.value = null;
  }

  async function restoreSession() {
    let raw = null;
    try { raw = sessionStorage.getItem(STORAGE_KEY); }
    catch (error) { console.warn("Could not read saved quiz session", error); }
    if (!raw) return;

    try {
      const saved = JSON.parse(raw);
      if (saved?.version !== 1 || !saved.sessionId || !saved.attemptId) {
        clearPersistedState();
        return;
      }

      screen.value = "restoring";
      studentName.value = saved.studentName || "";
      sessionId.value = saved.sessionId;
      attemptId.value = saved.attemptId;
      currentStage.value = Number.isInteger(saved.currentStage) ? saved.currentStage : 0;
      questionIndex.value = Number.isInteger(saved.questionIndex) ? saved.questionIndex : 0;
      answers.value = saved.answers || {};
      questionStates.value = saved.questionStates || {};
      results.value = saved.results || {};
      submittedBlocks.value = saved.submittedBlocks || {};
      writingTasks.value = saved.writingTasks || [];
      writingDrafts.value = saved.writingDrafts || {};
      writingSubmitted.value = saved.writingSubmitted || {};
      blockStartedAt.value = Number(saved.blockStartedAt) || Date.now();
      questionOpenedAt = Number(saved.questionOpenedAt) || Date.now();
      writingOpenedAt = Number(saved.writingOpenedAt) || Date.now();

      if (saved.screen === "results") {
        screen.value = "results";
        return;
      }

      questions.value = Array.from({ length: totalQuestions }, () => null);
      if (currentBlock.value.type === "mcq") {
        const loaded = await loadQuestionBatch(questionIndex.value);
        if (!loaded) throw new Error("Could not restore question");
      }
      screen.value = "quiz";
      startBlockTimer(blockStartedAt.value);
    } catch (error) {
      console.error("Could not restore quiz session", error);
      clearPersistedState();
      screen.value = "start";
    }
  }

  onMounted(restoreSession);
  onBeforeUnmount(clearTimer);

  return {
    screen,
    studentName,
    startError,
    starting,
    savingResponse,
    questions,
    questionIndex,
    answers,
    questionStates,
    results,
    remaining,
    currentStage,
    currentBlock,
    currentBlockQuestions,
    currentQuestion,
    currentWritingTask,
    writingTasks,
    writingDrafts,
    writingSubmitted,
    selected,
    sectionLabel,
    blockQuestionNumber,
    progressPercent,
    answeredCount,
    skippedCount,
    sectionComplete,
    unansweredCount,
    resultStats,
    resultTitle,
    startTest,
    selectAnswer,
    updateWriting,
    nextQuestion,
    skipQuestion,
    previousQuestion,
    goToQuestion,
    submitBlock,
    abortAssessment: () => {
      if (window.confirm("Are you sure you want to abort the assessment? Your current progress will be lost.")) reset();
    },
    restartAssessment: () => {
      if (window.confirm("Are you sure you want to restart the assessment? Your current result will be discarded.")) reset();
    }
  };
}
