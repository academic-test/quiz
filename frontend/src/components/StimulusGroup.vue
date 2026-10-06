<template>
  <article class="card stimulus-card">
    <div class="stimulus-head">
      <div>
        <div class="stimulus-label">Stimulus · {{ stimulusNumber }}</div>
        <div class="stimulus-range">Questions {{ questionStart }}–{{ questionEnd }} of {{ totalQuestions }}</div>
      </div>
      <span class="stimulus-status">{{ answeredCount }} / {{ questions.length }} answered</span>
    </div>

    <div class="stimulus-panel stimulus-panel-large">
      <div class="passage">{{ passage }}</div>
    </div>

    <div class="stimulus-questions">
      <section
        v-for="question in questions"
        :key="question.id"
        class="stimulus-question"
        :class="{ locked: Boolean(results?.[question.id]) }"
      >
        <div class="stimulus-question-number">
          Question {{ questionNumber(question) }}
          <span v-if="questionStates?.[question.id] === 'skipped' && !results?.[question.id]">Skipped</span>
          <span v-else-if="results?.[question.id]">Answered</span>
        </div>

        <div class="question-text">{{ question.q }}</div>

        <div class="options">
          <button
            v-for="(option, index) in question.o"
            :key="index"
            class="option"
            :class="{
              selected: selectedAnswer(question) === index,
              correct: results?.[question.id] && index === results?.[question.id].feedback.correctAnswer,
              incorrect: results?.[question.id] && selectedAnswer(question) === index && index !== results?.[question.id].feedback.correctAnswer
            }"
            :disabled="Boolean(results?.[question.id]) || saving"
            type="button"
            @click="$emit('select', { question, index })"
          >
            <span class="letter">{{ String.fromCharCode(65 + index) }}</span>
            <span>{{ option }}</span>
          </button>
        </div>

        <div v-if="results?.[question.id]" class="feedback" :class="results?.[question.id].correct ? 'good' : 'bad'">
          <strong>{{ results?.[question.id].correct ? "Correct!" : "Answer recorded." }}</strong>
          <span> Correct answer: {{ String.fromCharCode(65 + Number(results?.[question.id].feedback.correctAnswer)) }}.</span>
          <div>{{ results?.[question.id].feedback.explanation }}</div>
        </div>

        <div v-else class="stimulus-question-actions">
          <button
            class="secondary-btn"
            type="button"
            :disabled="saving || !hasSelectedAnswer(question)"
            @click="$emit('save', question)"
          >
            Save Answer & Review →
          </button>
          <button
            class="ghost-btn"
            type="button"
            :disabled="saving || hasSelectedAnswer(question)"
            @click="$emit('skip', question)"
          >
            Skip for now
          </button>
        </div>
      </section>
    </div>

    <div class="stimulus-navigation">
      <button
        class="ghost-btn"
        type="button"
        :disabled="isFirst || saving"
        @click="$emit('previous')"
      >
        ← Previous Stimulus
      </button>

      <div class="stimulus-navigation-note">
        <strong v-if="unansweredCount === 0">All questions in this stimulus are answered.</strong>
        <span v-else>{{ unansweredCount }} question{{ unansweredCount === 1 ? "" : "s" }} still unanswered.</span>
      </div>

      <button
        v-if="!isLast"
        class="primary-btn"
        type="button"
        :disabled="saving"
        @click="$emit('next')"
      >
        Next Stimulus →
      </button>
      <button
        v-else
        class="primary-btn"
        type="button"
        :disabled="saving || !sectionComplete"
        @click="$emit('submit')"
      >
        Submit Humanities →
      </button>
    </div>

    <div class="question-state">
      <span v-if="sectionComplete">All 40 Humanities questions are answered.</span>
      <span v-else>Answers are saved individually. You can move between stimuli and return to unanswered questions.</span>
    </div>
  </article>
</template>

<script setup>
const props = defineProps({
  questions: { type: Array, required: true },
  passage: { type: String, default: "" },
  stimulusNumber: { type: Number, required: true },
  questionStart: { type: Number, required: true },
  questionEnd: { type: Number, required: true },
  totalQuestions: { type: Number, required: true },
  answers: { type: Object, required: true },
  questionStates: { type: Object, required: true },
  results: { type: Object, required: true },
  saving: { type: Boolean, default: false },
  isFirst: { type: Boolean, default: false },
  isLast: { type: Boolean, default: false },
  sectionComplete: { type: Boolean, default: false },
  answeredCount: { type: Number, default: 0 },
  unansweredCount: { type: Number, default: 0 }
});

defineEmits(["select", "save", "skip", "previous", "next", "submit"]);

function selectedAnswer(question) {
  const answers = props.answers || {};
  return Object.prototype.hasOwnProperty.call(answers, question.id)
    ? answers[question.id]
    : null;
}

function hasSelectedAnswer(question) {
  const answer = selectedAnswer(question);
  return answer !== null && answer !== undefined;
}

function questionNumber(question) {
  return props.questionStart + props.questions.findIndex(item => item.id === question.id);
}
</script>
