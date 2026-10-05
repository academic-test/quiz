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
import StartScreen from "./components/StartScreen.vue";
import Timer from "./components/Timer.vue";
import QuestionCard from "./components/QuestionCard.vue";
import ResultsScreen from "./components/ResultsScreen.vue";
import { useAssessment, totalQuestions } from "./composables/useAssessment";

const {
  screen,
  studentName,
  startError,
  starting,
  savingResponse,
  questions,
  questionIndex,
  results,
  questionStates,
  remaining,
  generatingQuestions,
  feedback,
  currentQuestion,
  currentBlock,
  currentBlockQuestions,
  selected,
  sectionLabel,
  blockQuestionNumber,
  progressPercent,
  answeredCount,
  skippedCount,
  sectionComplete,
  unansweredCount,
  generationMessage,
  resultStats,
  resultTitle,
  startTest,
  selectAnswer,
  nextQuestion,
  skipQuestion,
  previousQuestion,
  goToQuestion,
  submitBlock,
  abortAssessment,
  restartAssessment
} = useAssessment();
</script>
