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
      <img v-if="image" class="stimulus-image" :src="image" alt="Humanities stimulus" />
      <div v-if="passage" class="passage">{{ passage }}</div>
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

        <div class="question-text">{{ question.q }}</div>

        <div class="options">
          <button
            v-for="(option, index) in question.o"
            :key="index"
            class="option"
            :class="{ selected: selectedAnswer(question) === index }"
            :disabled="saving"
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
          <strong>{{ results[question.id].correct ? "Correct" : "Incorrect" }}</strong>
          <span v-if="!results[question.id].correct">
            Correct answer: {{ String.fromCharCode(65 + Number(results[question.id].feedback?.correctAnswer ?? 0)) }}
          </span>
          <p v-if="results[question.id].feedback?.explanation">
            {{ results[question.id].feedback.explanation }}
          </p>
        </div>
      </section>
    </div>

    <div class="stimulus-navigation">
      <button
        v-if="!pageComplete"
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
        {{ isLast ? "Finish Humanities →" : "Next Page →" }}
      </button>
    </div>

    <div class="question-state">
      <span v-if="pageComplete">Your answers for this page have been saved. Explanations are shown below each question. Click Next Page to continue.</span>
      <span v-else>Answer every question on this page, then select Save Answer & Review.</span>
    </div>
  </article>
</template>

<script setup>
import { ref } from "vue";

const localSelections = ref({});

const props = defineProps({
  questions: { type: Array, required: true },
  passage: { type: String, default: "" },
  image: { type: String, default: "" },
  stimulusNumber: { type: Number, required: true },
  questionStart: { type: Number, required: true },
  questionEnd: { type: Number, required: true },
  totalQuestions: { type: Number, required: true },
  answers: { type: Object, required: true },
  saving: { type: Boolean, default: false },
  isFirst: { type: Boolean, default: false },
  isLast: { type: Boolean, default: false },
  sectionComplete: { type: Boolean, default: false },
  answeredCount: { type: Number, default: 0 },
  unansweredCount: { type: Number, default: 0 },
  pageComplete: { type: Boolean, default: false },
  results: { type: Object, default: () => ({}) }
});

const emit = defineEmits(["select", "previous", "next", "submit"]);

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
