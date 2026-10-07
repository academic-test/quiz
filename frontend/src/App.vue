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

    <section v-else-if="screen === 'section-select'" class="card start-card section-select-card">
      <div class="hero-icon">📚</div>
      <div class="eyebrow">SELECT YOUR TEST</div>
      <h2>Which test would you like to practise?</h2>
      <p>
        Choose a subject to begin. Your selected test keeps its existing page grouping, review and timing exactly as configured.
        You can come back here after finishing a subject to choose the other one.
      </p>

      <div class="section-choice-grid">
        <button
          class="section-choice"
          type="button"
          :disabled="starting || Boolean(completedPracticeSections.humanities)"
          @click="selectPracticeSection('humanities')"
        >
          <strong>Humanities</strong>
          <span>40 questions · 40 minutes</span>
          <small v-if="completedPracticeSections.humanities">Completed in this assessment</small>
          <small v-else>Stimulus pages with multiple questions</small>
        </button>

        <button
          class="section-choice"
          type="button"
          :disabled="starting || Boolean(completedPracticeSections['mathematics-science'])"
          @click="selectPracticeSection('mathematics-science')"
        >
          <strong>Mathematics &amp; Science</strong>
          <span>32 questions · 40 minutes</span>
          <small v-if="completedPracticeSections['mathematics-science']">Completed in this assessment</small>
          <small v-else>Shared-topic pages with multiple questions</small>
        </button>
      </div>

      <p v-if="bothSubjectsComplete" class="timer-note">Both subjects are complete.</p>
      <p v-else-if="starting" class="timer-note">Loading your selected test…</p>
      <p v-if="startError" class="start-error">{{ startError }}</p>
    </section>

    <section v-else-if="screen === 'quiz'" class="quiz-screen">
      <div class="quiz-meta">
        <div>
          <span>{{ currentBlock.label }}</span>
          <strong v-if="currentBlock.type === 'writing'">{{ currentBlock.subtitle }}</strong>
          <strong v-else-if="isHumanitiesBlock">
            Stimulus {{ stimulusIndex + 1 }} of {{ currentStimulusGroups.length }} ·
            Questions {{ stimulusQuestionStart }}–{{ stimulusQuestionEnd }} of {{ currentBlock.size }}
          </strong>
          <strong v-else-if="isMathematicsScienceBlock">
            Problem page {{ mathSciencePageIndex + 1 }} of {{ currentMathScienceGroups.length }} ·
            Questions {{ mathScienceQuestionStart }}–{{ mathScienceQuestionEnd }} of {{ currentBlock.size }}
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
        <span v-if="currentBlock.type === 'mcq' && (isHumanitiesBlock || isMathematicsScienceBlock)">{{ answeredCount }} of {{ currentBlock.size }} answered</span>
        <span v-else-if="currentBlock.type === 'mcq'">{{ answeredCount }} answered · {{ skippedCount }} skipped</span>
        <span v-else>{{ answeredCount ? 'Writing submitted' : 'Writing in progress' }}</span>
      </div>

      <div class="progress">
        <div :style="{ width: progressPercent + '%' }"></div>
      </div>

      <nav
        v-if="isHumanitiesBlock && currentStimulusGroups.length"
        class="stimulus-set-navigation"
        aria-label="Humanities stimulus pages"
      >
        <span class="stimulus-set-navigation-label">Stimulus pages:</span>
        <button
          v-for="(group, index) in currentStimulusGroups"
          :key="group.key"
          type="button"
          class="stimulus-set-nav"
          :class="{
            current: index === stimulusIndex,
            complete: group.questions.every(question => Boolean(results?.[question.id]))
          }"
          :disabled="savingResponse || index > stimulusIndex"
          @click="goToStimulus(index)"
        >
          {{ index + 1 }} · Q{{ currentBlock.start + currentStimulusGroups
            .slice(0, index)
            .reduce((total, item) => total + item.questions.length, 0) + 1 }}–{{
            currentBlock.start + currentStimulusGroups
              .slice(0, index + 1)
              .reduce((total, item) => total + item.questions.length, 0)
          }}
        </button>
      </nav>

      <nav
        v-if="isMathematicsScienceBlock && currentMathScienceGroups.length"
        class="stimulus-set-navigation"
        aria-label="Mathematics and Science problem pages"
      >
        <span class="stimulus-set-navigation-label">Problem pages:</span>
        <button
          v-for="(group, index) in currentMathScienceGroups"
          :key="group.key"
          type="button"
          class="stimulus-set-nav"
          :class="{
            current: index === mathSciencePageIndex,
            complete: group.questions.every(question => Boolean(results?.[question.id]))
          }"
          :disabled="savingResponse || index > mathSciencePageIndex"
          @click="goToMathSciencePage(index)"
        >
          {{ index + 1 }} · Q{{ currentMathScienceGroups
            .slice(0, index)
            .reduce((total, item) => total + item.questions.length, 0) + 1 }}–{{ 
            currentMathScienceGroups
              .slice(0, index + 1)
              .reduce((total, item) => total + item.questions.length, 0)
          }}
        </button>
      </nav>

      <MathematicsScienceGroup
        v-if="isMathematicsScienceBlock && currentMathScienceQuestions.length"
        :questions="currentMathScienceQuestions"
        :page-number="mathSciencePageIndex + 1"
        :question-start="mathScienceQuestionStart"
        :question-end="mathScienceQuestionEnd"
        :total-questions="currentBlock.size"
        :answers="answers"
        :saving="savingResponse"
        :is-last="mathSciencePageIndex === currentMathScienceGroups.length - 1"
        :page-reviewed="currentMathScienceReviewed"
        :results="results"
        :answered-count="currentMathScienceAnsweredCount"
        :unanswered-count="currentMathScienceUnansweredCount"
        @select="({ question, index }) => selectMathScienceAnswer(question, index)"
        @next="nextMathSciencePage"
        @submit="submitBlock"
      />

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
        :saving="savingResponse"
        :is-first="stimulusIndex === 0"
        :is-last="stimulusIndex === currentStimulusGroups.length - 1"
        :section-complete="sectionComplete"
        :page-complete="currentStimulusComplete"
        :page-reviewed="currentStimulusReviewed"
        :results="results"
        :answered-count="currentStimulusAnsweredCount"
        :unanswered-count="currentStimulusUnansweredCount"
        @select="({ question, index }) => selectStimulusAnswer(question, index)"
        @previous="previousStimulus"
        @next="nextStimulus"
        @submit="submitBlock"
      />

      <QuestionCard
        v-else-if="!isHumanitiesBlock && !isMathematicsScienceBlock && currentQuestion"
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
        :is-last="currentStage === 3"
        @update:text="updateWriting"
        @submit="submitBlock"
      />

      <div v-else-if="currentBlock.type === 'mcq' && !isHumanitiesBlock && !isMathematicsScienceBlock" class="question-grid">
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
import MathematicsScienceGroup from "./components/MathematicsScienceGroup.vue";
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
  isMathematicsScienceBlock,
  mathSciencePageIndex,
  currentMathScienceGroups,
  currentMathScienceQuestions,
  mathScienceQuestionStart,
  mathScienceQuestionEnd,
  currentMathScienceAnsweredCount,
  currentMathScienceUnansweredCount,
  currentMathScienceReviewed,
  completedPracticeSections,
  bothSubjectsComplete,
  currentStimulusGroups,
  currentStimulusQuestions,
  currentStimulusPassage,
  currentStimulusImage,
  stimulusQuestionStart,
  stimulusQuestionEnd,
  currentStimulusAnsweredCount,
  currentStimulusUnansweredCount,
  currentStimulusReviewed,
  results,
  answers,
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
  selectPracticeSection,
  selectAnswer,
  updateWriting,
  nextQuestion,
  nextStimulus,
  previousStimulus,
  goToStimulus,
  selectStimulusAnswer,
  nextMathSciencePage,
  previousMathSciencePage,
  goToMathSciencePage,
  selectMathScienceAnswer,
  skipQuestion,
  previousQuestion,
  goToQuestion,
  submitBlock,
  abortAssessment,
  restartAssessment
} = useAssessment();
</script>
