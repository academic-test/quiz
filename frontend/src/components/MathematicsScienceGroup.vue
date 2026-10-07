<template>
  <article class="card stimulus-card math-science-card">
    <div class="stimulus-head">
      <div>
        <div class="stimulus-label">Problem page · {{ pageNumber }}</div>
        <div class="stimulus-range">Questions {{ questionStart }}–{{ questionEnd }} of {{ totalQuestions }}</div>
      </div>
      <span class="stimulus-status">{{ answeredCount }} / {{ questions.length }} answered</span>
    </div>

    <div class="stimulus-questions">
      <section
        v-for="question in questions"
        :key="question.id"
        class="stimulus-question"
      >
        <div class="stimulus-question-number">
          Question {{ questionNumber(question) }}
          <span v-if="selectedAnswer(question) !== null && selectedAnswer(question) !== undefined">Answer selected</span>
        </div>

        <div v-if="question.passage" class="passage math-science-passage">
          {{ question.passage }}
        </div>

        <div class="question-text">{{ question.q }}</div>

        <div class="options">
          <button
            v-for="(option, index) in question.o"
            :key="index"
            class="option"
            :class="{ selected: selectedAnswer(question) === index }"
            :disabled="saving || Boolean(results?.[question.id])"
            type="button"
            @click="selectOption(question, index)"
          >
            <span class="letter">{{ String.fromCharCode(65 + index) }}</span>
            <span>{{ option }}</span>
          </button>
        </div>

        <div
          v-if="results?.[question.id]"
          class="stimulus-feedback"
          :class="{ correct: results[question.id].correct, incorrect: !results[question.id].correct }"
        >
          <div class="stimulus-feedback-title">
            {{ results[question.id].correct ? "✓ Correct" : "✕ Incorrect" }}
          </div>
          <div v-if="!results[question.id].correct" class="stimulus-feedback-answer">
            Correct answer:
            <strong>{{ String.fromCharCode(65 + Number(results[question.id].feedback?.correctAnswer ?? 0)) }}</strong>
          </div>
          <div v-if="results[question.id].feedback?.explanation" class="stimulus-feedback-explanation">
            <strong>Explanation:</strong>
            <span>{{ results[question.id].feedback.explanation }}</span>
          </div>
        </div>
      </section>
    </div>

    <div class="stimulus-navigation">
      <button
        v-if="!pageReviewed"
        class="primary-btn review-submit-btn"
        type="button"
        :disabled="saving || unansweredCount > 0"
        @click="$emit('submit')"
      >
        Save Answer & Review →
      </button>

      <button
        v-else
        class="primary-btn review-submit-btn"
        type="button"
        :disabled="saving"
        @click="$emit('next')"
      >
        {{ isLast ? "Finish Mathematics & Science →" : "Next Page →" }}
      </button>
    </div>

    <div class="question-state">
      <span v-if="pageReviewed">Your answers for this page have been saved. Explanations are shown below each question. Click {{ isLast ? "Finish Mathematics & Science" : "Next Page" }} to continue.</span>
      <span v-else>Answer every question on this page, then select Save Answer & Review.</span>
    </div>
  </article>
</template>

<script setup>
import { ref } from "vue";

const localSelections = ref({});
const emit = defineEmits(["select", "next", "submit"]);

const props = defineProps({
  questions: { type: Array, required: true },
  pageNumber: { type: Number, required: true },
  questionStart: { type: Number, required: true },
  questionEnd: { type: Number, required: true },
  totalQuestions: { type: Number, required: true },
  answers: { type: Object, required: true },
  saving: { type: Boolean, default: false },
  isLast: { type: Boolean, default: false },
  answeredCount: { type: Number, default: 0 },
  unansweredCount: { type: Number, default: 0 },
  pageReviewed: { type: Boolean, default: false },
  results: { type: Object, default: () => ({}) }
});

function selectedAnswer(question) {
  const answers = props.answers || {};
  if (Object.prototype.hasOwnProperty.call(localSelections.value, question.id)) {
    return localSelections.value[question.id];
  }
  return Object.prototype.hasOwnProperty.call(answers, question.id)
    ? answers[question.id]
    : null;
}

function selectOption(question, index) {
  localSelections.value = { ...localSelections.value, [question.id]: index };
  emit("select", { question, index });
}

function questionNumber(question) {
  return props.questionStart + props.questions.findIndex(item => item.id === question.id);
}
</script>
