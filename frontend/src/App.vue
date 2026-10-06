<template>
  <main class="app-shell">
    <header class="topbar">
      <div>
        <div class="eyebrow">SCHOLARSHIP TEST PRACTICE</div>
        <h1>ACER Level 2 · Year 10 Entry Practice</h1>
        <p class="subtitle">Original practice questions built around the reasoning patterns in the supplied ACER Years 9–10 practice booklet. The assessment runs Humanities, Mathematics & Science, then Written Expression.</p>
      </div>
    </header>

    <section v-if="screen === 'restoring'" class="card start-card">
      <div class="hero-icon">⏳</div>
      <div class="eyebrow">ASSESSMENT IN PROGRESS</div>
      <h2>Restoring your test…</h2>
      <p>Your current task, answers, writing and timer are being restored. Refreshing the page will not start a new assessment.</p>
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
          <strong v-if="currentBlock.type === 'writing'">{{ currentBlock.subtitle }}</strong>
          <strong v-else-if="isHumanitiesBlock">
            Stimulus {{ stimulusIndex + 1 }} of {{ currentStimulusGroups.length }} ·
            Questions {{ stimulusQuestionStart }}–{{ stimulusQuestionEnd }} of {{ currentBlock.size }}
          </strong>
          <strong v-else>Question {{ blockQuestionNumber }} of {{ currentBlock.size }}</strong>
        </div>
        <div class="assessment-actions">
          <button class="ghost-btn" type="button" @click="abortAssessment">Abort Assessment</button>
          <Timer :remaining="remaining" />
        </div>
      </div>

      <div class="block-meta">
        <span>{{ currentBlock.subtitle }}</span>
        <span v-if="currentBlock.type === 'mcq'">{{ answeredCount }} answered · {{ skippedCount }} skipped</span>
        <span v-else>{{ answeredCount ? 'Writing submitted' : 'Writing in progress' }}</span>
      </div>

      <div class="progress">
        <div :style="{ width: progressPercent + '%' }"></div>
      </div>

      <StimulusGroup
        v-if="isHumanitiesBlock && currentStimulusQuestions.length"
        :questions="currentStimulusQuestions"
        :passage="currentStimulusPassage"
        :image="currentStimulusImage"
        :stimulus-number="stimulusIndex + 1"
        :question-start="stimulusQuestionStart"
        :question-end="stimulusQuestionEnd"
        :total-questions="currentBlock.size"
        :answers="answers"
        :question-states="questionStates"
        :results="results"
        :saving="savingResponse"
        :is-first="stimulusIndex === 0"
        :is-last="stimulusIndex === currentStimulusGroups.length - 1"
        :section-complete="sectionComplete"
        :answered-count="currentStimulusAnsweredCount"
        :unanswered-count="currentStimulusUnansweredCount"
        @select="({ question, index }) => selectStimulusAnswer(question, index)"
        @save="saveStimulusQuestion"
        @skip="skipStimulusQuestion"
        @previous="previousStimulus"
        @next="nextStimulus"
        @submit="submitBlock"
      />

      <QuestionCard
        v-else-if="currentQuestion"
        :question="currentQuestion"
        :section-label="sectionLabel"
        :selected="selected"
        :locked="Boolean(results?.[currentQuestion.id])"
        :feedback="feedback"
        :previous-feedback="previousFeedback"
        :is-first="questionIndex === currentBlock.start"
        :is-last="questionIndex === totalQuestions - 1"
        :is-last-in-block="questionIndex === currentBlock.end"
        :waiting-for-questions="!currentQuestion"
        :saving="savingResponse"
        :section-complete="sectionComplete"
        :unanswered-count="unansweredCount"
        @select="selectAnswer"
        @next="nextQuestion"
        @skip="skipQuestion"
        @previous="previousQuestion"
        @submit="submitBlock"
      />

      <WritingCard
        v-else-if="currentWritingTask"
        :task="currentWritingTask"
        :text="writingDrafts[currentWritingTask.id] || ''"
        :locked="Boolean(writingSubmitted[currentWritingTask.id])"
        :saving="savingResponse"
        :is-last="currentStage === 2"
        @update:text="updateWriting"
        @submit="submitBlock"
      />

      <div v-if="isHumanitiesBlock" class="stimulus-grid">
        <button
          v-for="(group, index) in currentStimulusGroups"
          :key="group.key"
          type="button"
          class="question-nav stimulus-nav"
          :class="{
            current: index === stimulusIndex,
            answered: group.questions.length > 0 && group.questions.every(q => results?.[q.id]),
            skipped: group.questions.some(q => questionStates?.[q.id] === 'skipped' && !results?.[q.id])
          }"
          :disabled="savingResponse"
          @click="goToStimulus(index)"
        >
          S{{ index + 1 }}
        </button>
      </div>

      <div v-else-if="currentBlock.type === 'mcq'" class="question-grid">
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
          :disabled="savingResponse"
          @click="goToQuestion(offset + currentBlock.start)"
        >
          {{ offset + 1 }}
        </button>
      </div>

      <p v-if="startError" class="generation-message">{{ startError }}</p>
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
      :writing-completed="resultStats.writingCompleted"
      @restart="restartAssessment"
    />

    <footer>Questions are original and are not ACER questions. This practice tool is not affiliated with ACER.</footer>
  </main>
</template>

<script setup>
import StartScreen from "./components/StartScreen.vue";
import Timer from "./components/Timer.vue";
import QuestionCard from "./components/QuestionCard.vue";
import StimulusGroup from "./components/StimulusGroup.vue";
import WritingCard from "./components/WritingCard.vue";
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
  stimulusIndex,
  isHumanitiesBlock,
  currentStimulusGroups,
  currentStimulusQuestions,
  currentStimulusPassage,
  currentStimulusImage,
  stimulusQuestionStart,
  stimulusQuestionEnd,
  currentStimulusAnsweredCount,
  currentStimulusUnansweredCount,
  results,
  questionStates,
  remaining,
  currentStage,
  currentBlock,
  feedback,
  previousFeedback,
  currentBlockQuestions,
  currentQuestion,
  currentWritingTask,
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
  nextStimulus,
  previousStimulus,
  goToStimulus,
  selectStimulusAnswer,
  saveStimulusQuestion,
  skipStimulusQuestion,
  skipQuestion,
  previousQuestion,
  goToQuestion,
  submitBlock,
  abortAssessment,
  restartAssessment
} = useAssessment();
</script>
