import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import {
  finishAttempt as finishAttemptApi,
  getQuestions,
  saveResponse as saveResponseApi,
  saveWritingResponse,
  startAssessment
} from "../services/quizApi";
import { buildHumanitiesStimulusGroups } from "../utils/humanitiesStimuli";
import { buildMathScienceStimulusGroups } from "../utils/mathScienceStimuli";

export const totalQuestions = 72;

export const labels = {
  humanities: "Humanities",
  mathematics_science: "Mathematics & Science"
};

export const blocks = [
  {
    key: "humanities",
    type: "mcq",
    label: "Test 1 · Humanities",
    subtitle: "40 minutes · 40 questions",
    start: 0,
    end: 39,
    size: 40,
    duration: 40 * 60
  },
  {
    key: "mathematics-science",
    type: "mcq",
    label: "Test 2 · Mathematics & Science",
    subtitle: "40 minutes · 32 questions",
    start: 40,
    end: 71,
    size: 32,
    duration: 40 * 60
  },
  {
    key: "writing-1",
    type: "writing",
    label: "Test 3 · Written Expression",
    subtitle: "25 minutes · Writing Task 1",
    taskIndex: 0,
    start: 0,
    end: 0,
    size: 1,
    duration: 25 * 60
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

const STORAGE_KEY = "acer-level2-year10-quiz-v12";

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
  const previousFeedback = ref(null);
  const stimulusIndex = ref(0);
  const reviewedStimuli = ref({});
  const mathSciencePageIndex = ref(0);
  const reviewedMathSciencePages = ref({});
  const questionOpenedAtById = ref({});

  let timerHandle = null;
  let questionOpenedAt = 0;
  let writingOpenedAt = 0;

  const currentBlock = computed(() => blocks[currentStage.value]);
  const currentQuestion = computed(() =>
    currentBlock.value.type === "mcq" ? questions.value[questionIndex.value] || null : null
  );
  const isHumanitiesBlock = computed(() =>
    currentBlock.value.type === "mcq" && currentBlock.value.key === "humanities"
  );
  const isMathematicsScienceBlock = computed(() =>
    currentBlock.value.type === "mcq" && currentBlock.value.key === "mathematics-science"
  );
  const currentMathScienceGroups = computed(() =>
    isMathematicsScienceBlock.value
      ? buildMathScienceStimulusGroups(currentBlockQuestions.value)
      : []
  );
  const currentMathScienceQuestions = computed(() =>
    currentMathScienceGroups.value[mathSciencePageIndex.value]?.questions || []
  );
  const currentMathScienceAnsweredCount = computed(() =>
    currentMathScienceQuestions.value.filter(question => {
      const answer = answers.value[question.id];
      return answer !== undefined && answer !== null;
    }).length
  );
  const currentMathScienceUnansweredCount = computed(() =>
    currentMathScienceQuestions.value.length - currentMathScienceAnsweredCount.value
  );
  const currentMathScienceReviewed = computed(() => {
    const group = currentMathScienceGroups.value[mathSciencePageIndex.value];
    return Boolean(group && reviewedMathSciencePages.value[group.key]);
  });
  const currentMathScienceComplete = computed(() => {
    const group = currentMathScienceGroups.value[mathSciencePageIndex.value];
    if (!group || !group.questions.length) return false;
    return Boolean(reviewedMathSciencePages.value[group.key]) &&
      group.questions.every(question => Boolean(results.value[question.id]));
  });
  const mathScienceQuestionStart = computed(() => {
    const first = currentMathScienceQuestions.value[0];
    if (!first) return 1;
    const index = currentBlockQuestions.value.findIndex(question => question?.id === first.id);
    return index + 1;
  });
  const mathScienceQuestionEnd = computed(() =>
    mathScienceQuestionStart.value + Math.max(0, currentMathScienceQuestions.value.length - 1)
  );
  const currentStimulusGroups = computed(() =>
    isHumanitiesBlock.value
      ? buildHumanitiesStimulusGroups(currentBlockQuestions.value)
      : []
  );
  const currentStimulusQuestions = computed(() =>
    currentStimulusGroups.value[stimulusIndex.value]?.questions || []
  );
  const currentStimulusPassage = computed(() =>
    currentStimulusGroups.value[stimulusIndex.value]?.passage || ""
  );
  const currentStimulusImage = computed(() =>
    currentStimulusGroups.value[stimulusIndex.value]?.image || ""
  );
  const currentStimulusAnsweredCount = computed(() =>
    currentStimulusQuestions.value.filter(q => {
      const answer = answers.value[q.id];
      return answer !== undefined && answer !== null;
    }).length
  );
  const currentStimulusUnansweredCount = computed(() =>
    currentStimulusQuestions.value.length - currentStimulusAnsweredCount.value
  );
  const currentStimulusComplete = computed(() => {
    const group = currentStimulusGroups.value[stimulusIndex.value];
    if (!group || !group.questions.length) return false;

    // Explicit page review state is the source of truth for the Review -> Next
    // transition. Results are still required so a page can never be marked
    // reviewed before every answer has actually been saved.
    return Boolean(reviewedStimuli.value[group.key]) &&
      group.questions.every(question => Boolean(results.value[question.id]));
  });
  const currentStimulusReviewed = computed(() => {
    const group = currentStimulusGroups.value[stimulusIndex.value];
    return Boolean(group && reviewedStimuli.value[group.key]);
  });
  const stimulusQuestionStart = computed(() => {
    const first = currentStimulusQuestions.value[0];
    if (!first) return 1;
    return currentBlockQuestions.value.findIndex(q => q?.id === first.id) + 1;
  });
  const stimulusQuestionEnd = computed(() =>
    stimulusQuestionStart.value + Math.max(0, currentStimulusQuestions.value.length - 1)
  );
  const currentWritingTask = computed(() =>
    currentBlock.value.type === "writing"
      ? writingTasks.value[currentBlock.value.taskIndex] || null
      : null
  );
  const currentBlockQuestions = computed(() => {
    if (currentBlock.value.type !== "mcq") return [];
    if (currentBlock.value.key === "humanities" || currentBlock.value.key === "mathematics-science") {
      return questions.value
        .slice(currentBlock.value.start, currentBlock.value.end + 1)
        .filter(Boolean);
    }
    return questionManifest.value.slice(currentBlock.value.start, currentBlock.value.end + 1);
  });
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
      : (isHumanitiesBlock.value || isMathematicsScienceBlock.value)
        ? (answeredCount.value / currentBlock.value.size) * 100
        : (blockQuestionNumber.value / currentBlock.value.size) * 100;
    return Math.min(100, complete);
  });
  const answeredCount = computed(() =>
    currentBlock.value.type === "mcq"
      ? currentBlockQuestions.value.filter(q => {
          const answer = answers.value[q.id];
          return answer !== undefined && answer !== null;
        }).length
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
        version: 13,
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
        writingOpenedAt,
        previousFeedback: previousFeedback.value,
        stimulusIndex: stimulusIndex.value,
        reviewedStimuli: reviewedStimuli.value,
        mathSciencePageIndex: mathSciencePageIndex.value,
        reviewedMathSciencePages: reviewedMathSciencePages.value,
        questionOpenedAtById: questionOpenedAtById.value
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

  async function ensureBlockQuestionsLoaded(block = currentBlock.value) {
    if (block.type !== "mcq") return true;
    for (let index = block.start; index <= block.end; index += 10) {
      if (!(await loadQuestionBatch(index))) return false;
    }
    return true;
  }

  function prepareStimulusQuestionTimers() {
    if (!isHumanitiesBlock.value) return;
    const next = { ...questionOpenedAtById.value };
    currentStimulusQuestions.value.forEach(question => {
      if (!next[question.id] && !results.value[question.id]) next[question.id] = Date.now();
    });
    questionOpenedAtById.value = next;
  }

  function prepareMathSciencePageTimers() {
    if (!isMathematicsScienceBlock.value) return;
    const next = { ...questionOpenedAtById.value };
    currentMathScienceQuestions.value.forEach(question => {
      if (!next[question.id] && !results.value[question.id]) next[question.id] = Date.now();
    });
    questionOpenedAtById.value = next;
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
      questionOpenedAtById.value = {};
      stimulusIndex.value = 0;
      reviewedStimuli.value = {};
      mathSciencePageIndex.value = 0;
      reviewedMathSciencePages.value = {};
      questionIndex.value = 0;
      currentStage.value = 0;
      feedback.value = null;
      previousFeedback.value = null;

      // Humanities is presented as complete stimulus pages, so all 40
      // Humanities questions must be loaded before the first page is rendered.
      if (!(await ensureBlockQuestionsLoaded(blocks[0]))) {
        throw new Error("Could not load the Humanities questions.");
      }

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

  async function saveQuestionResponse(question, timedOut = false) {
    if (!question || !attemptId.value) return false;
    const answer = answers.value[question.id];
    if (answer === undefined || answer === null) return false;
    if (results.value[question.id]) return true;

    savingResponse.value = true;
    const openedAt = Number(questionOpenedAtById.value[question.id]) || questionOpenedAt || Date.now();
    const elapsed = Math.max(0, (Date.now() - openedAt) / 1000);
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

  async function saveCurrentResponse(timedOut = false) {
    const question = currentQuestion.value;
    if (!question) return false;
    const saved = await saveQuestionResponse(question, timedOut);
    if (saved) feedback.value = results.value[question.id]?.feedback || null;
    return saved;
  }

  async function saveStimulusQuestion(payload, timedOut = false) {
    const question = payload?.question || payload;
    const selectedIndex = payload?.index;
    if (!question) return false;

    // The grouped Humanities UI keeps a local selection so the button reacts
    // immediately. Re-apply that selection here before persisting it so the
    // composable remains the single source of truth.
    if (
      selectedIndex !== undefined &&
      selectedIndex !== null &&
      !results.value[question.id]
    ) {
      answers.value[question.id] = selectedIndex;
      questionStates.value[question.id] = "selected";
      if (!questionOpenedAtById.value[question.id]) {
        questionOpenedAtById.value = {
          ...questionOpenedAtById.value,
          [question.id]: Date.now()
        };
      }
    }

    return saveQuestionResponse(question, timedOut);
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
    previousFeedback.value = null;
    stimulusIndex.value = 0;
    if (currentBlock.value.type === "mcq") {
      const ready = (currentBlock.value.key === "humanities" || currentBlock.value.key === "mathematics-science")
        ? await ensureBlockQuestionsLoaded(currentBlock.value)
        : await ensureQuestionLoaded(currentBlock.value.start);
      if (!ready) return;
      questionIndex.value = currentBlock.value.start;
      questionOpenedAt = Date.now();
      if (currentBlock.value.key === "humanities") {
        prepareStimulusQuestionTimers();
      } else if (currentBlock.value.key === "mathematics-science") {
        prepareMathSciencePageTimers();
      }
    } else {
      writingOpenedAt = Date.now();
    }
    feedback.value = null;
    blockStartedAt.value = Date.now();
    persistState();
    startBlockTimer(blockStartedAt.value);
  }

  async function nextStimulus() {
    if (!isHumanitiesBlock.value) return;
    if (!currentStimulusComplete.value) return;
    if (stimulusIndex.value >= currentStimulusGroups.value.length - 1) {
      if (!sectionComplete.value) return;
      await advanceStage();
      return;
    }
    stimulusIndex.value += 1;
    const group = currentStimulusQuestions.value;
    questionIndex.value = currentBlockQuestions.value.findIndex(q => q?.id === group[0]?.id) + currentBlock.value.start;
    prepareStimulusQuestionTimers();
    feedback.value = null;
    previousFeedback.value = null;
    persistState();
  }

  async function previousStimulus() {
    if (!isHumanitiesBlock.value || stimulusIndex.value <= 0) return;
    stimulusIndex.value -= 1;
    const group = currentStimulusQuestions.value;
    questionIndex.value = currentBlockQuestions.value.findIndex(q => q?.id === group[0]?.id) + currentBlock.value.start;
    prepareStimulusQuestionTimers();
    feedback.value = null;
    previousFeedback.value = null;
    persistState();
  }

  async function goToStimulus(index) {
    if (!isHumanitiesBlock.value) return;
    if (index < 0 || index >= currentStimulusGroups.value.length) return;
    stimulusIndex.value = index;
    const group = currentStimulusGroups.value[index]?.questions || [];
    questionIndex.value = currentBlockQuestions.value.findIndex(q => q?.id === group[0]?.id) + currentBlock.value.start;
    prepareStimulusQuestionTimers();
    feedback.value = null;
    previousFeedback.value = null;
    persistState();
  }

  async function nextMathSciencePage() {
    if (!isMathematicsScienceBlock.value) return;
    if (!currentMathScienceComplete.value) return;
    if (mathSciencePageIndex.value >= currentMathScienceGroups.value.length - 1) {
      if (!sectionComplete.value) return;
      await advanceStage();
      return;
    }
    mathSciencePageIndex.value += 1;
    const group = currentMathScienceQuestions.value;
    questionIndex.value = currentBlockQuestions.value.findIndex(question => question?.id === group[0]?.id) + currentBlock.value.start;
    prepareMathSciencePageTimers();
    feedback.value = null;
    previousFeedback.value = null;
    persistState();
  }

  async function previousMathSciencePage() {
    if (!isMathematicsScienceBlock.value || mathSciencePageIndex.value <= 0) return;
    mathSciencePageIndex.value -= 1;
    const group = currentMathScienceQuestions.value;
    questionIndex.value = currentBlockQuestions.value.findIndex(question => question?.id === group[0]?.id) + currentBlock.value.start;
    prepareMathSciencePageTimers();
    feedback.value = null;
    previousFeedback.value = null;
    persistState();
  }

  async function goToMathSciencePage(index) {
    if (!isMathematicsScienceBlock.value) return;
    if (index < 0 || index >= currentMathScienceGroups.value.length || index > mathSciencePageIndex.value) return;
    mathSciencePageIndex.value = index;
    const group = currentMathScienceGroups.value[index]?.questions || [];
    questionIndex.value = currentBlockQuestions.value.findIndex(question => question?.id === group[0]?.id) + currentBlock.value.start;
    prepareMathSciencePageTimers();
    feedback.value = null;
    previousFeedback.value = null;
    persistState();
  }

  function selectMathScienceAnswer(question, index) {
    if (!isMathematicsScienceBlock.value || savingResponse.value) return;
    if (results.value[question.id]) return;
    answers.value[question.id] = index;
    questionStates.value[question.id] = "selected";
    if (!questionOpenedAtById.value[question.id]) {
      questionOpenedAtById.value = {
        ...questionOpenedAtById.value,
        [question.id]: Date.now()
      };
    }
    persistState();
  }

  function selectStimulusAnswer(question, index) {
    if (!isHumanitiesBlock.value || savingResponse.value) return;
    if (results.value[question.id]) return;
    answers.value[question.id] = index;
    questionStates.value[question.id] = "selected";
    if (!questionOpenedAtById.value[question.id]) {
      questionOpenedAtById.value = { ...questionOpenedAtById.value, [question.id]: Date.now() };
    }
    persistState();
  }

  function skipStimulusQuestion(question) {
    if (!isHumanitiesBlock.value || savingResponse.value) return;
    if (results.value[question.id]) return;
    if (answers.value[question.id] !== undefined && answers.value[question.id] !== null) return;
    questionStates.value[question.id] = "skipped";
    persistState();
  }

  async function nextQuestion() {
    if (isHumanitiesBlock.value) return nextStimulus();
    if (currentBlock.value.type !== "mcq") return advanceStage();
    const id = currentQuestion.value?.id;
    if (!id) return;

    // First click records the answer and shows feedback on the same question.
    if (!results.value[id]) {
      const saved = await saveCurrentResponse(false);
      if (!saved) return;
      previousFeedback.value = null;
      persistState();
      return;
    }

    // Second click moves to the next question.
    if (questionIndex.value >= currentBlock.value.end) return;

    const nextIndex = questionIndex.value + 1;
    if (!(await ensureQuestionLoaded(nextIndex))) return;

    questionIndex.value = nextIndex;
    feedback.value = null;
    previousFeedback.value = null;
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
    previousFeedback.value = null;
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
      previousFeedback.value = null;
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
      previousFeedback.value = null;
      questionOpenedAt = Date.now();
      persistState();
    }
  }

  async function submitHumanitiesAnswers() {
    if (!isHumanitiesBlock.value || savingResponse.value) return false;
    if (currentStimulusReviewed.value) return true;

    const selectedQuestions = currentStimulusQuestions.value.filter(question => {
      const answer = answers.value[question.id];
      return answer !== undefined && answer !== null && !results.value[question.id];
    });

    for (const question of selectedQuestions) {
      const saved = await saveQuestionResponse(question, false);
      if (!saved) return false;
    }

    const group = currentStimulusGroups.value[stimulusIndex.value];
    if (!group || !group.questions.every(question => Boolean(results.value[question.id]))) {
      return false;
    }

    reviewedStimuli.value = {
      ...reviewedStimuli.value,
      [group.key]: true
    };
    persistState();
    return true;
  }

  async function submitMathSciencePage() {
    if (!isMathematicsScienceBlock.value || savingResponse.value) return false;
    if (currentMathScienceReviewed.value) return true;

    const selectedQuestions = currentMathScienceQuestions.value.filter(question => {
      const answer = answers.value[question.id];
      return answer !== undefined && answer !== null && !results.value[question.id];
    });

    for (const question of selectedQuestions) {
      const saved = await saveQuestionResponse(question, false);
      if (!saved) return false;
    }

    const group = currentMathScienceGroups.value[mathSciencePageIndex.value];
    if (!group || !group.questions.every(question => Boolean(results.value[question.id]))) {
      return false;
    }

    reviewedMathSciencePages.value = {
      ...reviewedMathSciencePages.value,
      [group.key]: true
    };
    persistState();
    return true;
  }

  async function submitBlock() {
    if (isHumanitiesBlock.value) {
      const saved = await submitHumanitiesAnswers();
      if (!saved) return;
      persistState();
      return;
    }

    if (isMathematicsScienceBlock.value) {
      const saved = await submitMathSciencePage();
      if (!saved) return;
      persistState();
      return;
    }

    if (currentBlock.value.type === "writing") {
      const saved = await saveCurrentWriting();
      if (saved) await advanceStage();
      return;
    }

    const id = currentQuestion.value?.id;
    if (!id) return;

    // First click records the final answer and shows feedback on the same question.
    if (!results.value[id]) {
      const saved = await saveCurrentResponse(false);
      if (!saved) return;
      previousFeedback.value = null;
      persistState();
      return;
    }

    // Second click submits the completed test component.
    if (!sectionComplete.value) return;
    await advanceStage();
  }

  async function handleBlockTimeout() {
    if (submittedBlocks.value[currentStage.value]) return;
    if (isHumanitiesBlock.value || isMathematicsScienceBlock.value) {
      for (const question of currentBlockQuestions.value) {
        const id = question?.id;
        if (id && !results.value[id] && answers.value[id] !== undefined && answers.value[id] !== null) {
          await saveQuestionResponse(question, true);
        }
      }
    } else if (currentBlock.value.type === "mcq" && currentQuestion.value) {
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
    previousFeedback.value = null;
    stimulusIndex.value = 0;
    reviewedStimuli.value = {};
    mathSciencePageIndex.value = 0;
    reviewedMathSciencePages.value = {};
    questionOpenedAtById.value = {};
  }

  async function restoreSession() {
    let raw = null;
    try { raw = sessionStorage.getItem(STORAGE_KEY); }
    catch (error) { console.warn("Could not read saved quiz session", error); }
    if (!raw) return;

    try {
      const saved = JSON.parse(raw);
      if (saved?.version !== 13 || !saved.sessionId || !saved.attemptId) {
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
      reviewedStimuli.value = saved.reviewedStimuli || {};
      writingTasks.value = saved.writingTasks || [];
      writingDrafts.value = saved.writingDrafts || {};
      writingSubmitted.value = saved.writingSubmitted || {};
      blockStartedAt.value = Number(saved.blockStartedAt) || Date.now();
      questionOpenedAt = Number(saved.questionOpenedAt) || Date.now();
      writingOpenedAt = Number(saved.writingOpenedAt) || Date.now();
      previousFeedback.value = saved.previousFeedback || null;
      stimulusIndex.value = Number.isInteger(saved.stimulusIndex) ? saved.stimulusIndex : 0;
      mathSciencePageIndex.value = Number.isInteger(saved.mathSciencePageIndex) ? saved.mathSciencePageIndex : 0;
      reviewedMathSciencePages.value = saved.reviewedMathSciencePages || {};
      questionOpenedAtById.value = saved.questionOpenedAtById || {};

      if (saved.screen === "results") {
        screen.value = "results";
        return;
      }

      questions.value = Array.from({ length: totalQuestions }, () => null);
      if (currentBlock.value.type === "mcq") {
        const loaded = (currentBlock.value.key === "humanities" || currentBlock.value.key === "mathematics-science")
          ? await ensureBlockQuestionsLoaded(currentBlock.value)
          : await loadQuestionBatch(questionIndex.value);
        if (!loaded) throw new Error("Could not restore question");
      }
      screen.value = "quiz";
      if (currentBlock.value.key === "humanities") {
        const groups = currentStimulusGroups.value;
        if (stimulusIndex.value >= groups.length) stimulusIndex.value = 0;
        const group = groups[stimulusIndex.value]?.questions || [];
        if (group[0]) {
          questionIndex.value = currentBlockQuestions.value.findIndex(q => q?.id === group[0].id) + currentBlock.value.start;
        }
        prepareStimulusQuestionTimers();
        feedback.value = null;
      } else if (currentBlock.value.key === "mathematics-science") {
        const groups = currentMathScienceGroups.value;
        if (mathSciencePageIndex.value >= groups.length) mathSciencePageIndex.value = 0;
        const group = groups[mathSciencePageIndex.value]?.questions || [];
        if (group[0]) {
          questionIndex.value = currentBlockQuestions.value.findIndex(question => question?.id === group[0].id) + currentBlock.value.start;
        }
        prepareMathSciencePageTimers();
        feedback.value = null;
      } else {
        feedback.value = results.value[questions.value[questionIndex.value]?.id]?.feedback || null;
      }
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
    stimulusIndex,
    isHumanitiesBlock,
    isMathematicsScienceBlock,
    currentMathScienceGroups,
    currentMathScienceQuestions,
    mathScienceQuestionStart,
    mathScienceQuestionEnd,
    currentMathScienceAnsweredCount,
    currentMathScienceUnansweredCount,
    currentMathScienceComplete,
    currentMathScienceReviewed,
    mathSciencePageIndex,
    currentStimulusGroups,
    currentStimulusQuestions,
    currentStimulusPassage,
    currentStimulusImage,
    stimulusQuestionStart,
    stimulusQuestionEnd,
    currentStimulusAnsweredCount,
    currentStimulusUnansweredCount,
    currentStimulusComplete,
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
    feedback,
    previousFeedback,
    currentStimulusReviewed,
    reviewedStimuli,
    resultStats,
    resultTitle,
    startTest,
    selectAnswer,
    selectStimulusAnswer,
    selectMathScienceAnswer,
    updateWriting,
    nextQuestion,
    nextStimulus,
    previousStimulus,
    goToStimulus,
    nextMathSciencePage,
    previousMathSciencePage,
    goToMathSciencePage,
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
